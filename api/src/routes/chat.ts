import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { isAllowedImageType, publicUrlForKey, uploadImage } from "../services/storage.js";
import { getTodayMemberIds, markTodayCoffeeDone } from "../services/rotationService.js";
import {
  emitMessageUpdate,
  emitNewMessage,
  emitRatingUpdate,
  emitReactionUpdate,
  emitReadUpdate,
} from "../socket.js";
import { notifyCoffeeProof, notifyCoffeeRequest, notifyNewMessage } from "../services/push.js";

export const chatRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

const COFFEE_REQUEST_TEXT = "☕ Pedido de café! Alguém pode passar?";
const COFFEE_REQUEST_COOLDOWN_MS = 30 * 60 * 1000; // 30 min

const messageInclude = {
  user: { select: { id: true, name: true } },
  replyTo: {
    select: { id: true, text: true, imageKey: true, user: { select: { name: true } } },
  },
  reactions: { select: { emoji: true, userId: true } },
  ratings: { select: { userId: true, stars: true } },
} as const;

interface MessageWithRelations {
  id: string;
  text: string | null;
  imageKey: string | null;
  createdAt: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  isCoffeeProof?: boolean;
  isCoffeeRequest?: boolean;
  user: { id: string; name: string };
  replyTo?: { id: string; text: string | null; imageKey: string | null; user: { name: string } } | null;
  reactions?: { emoji: string; userId: string }[];
  ratings?: { userId: string; stars: number }[];
}

function groupReactions(reactions: { emoji: string; userId: string }[] = []) {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    const arr = map.get(r.emoji) ?? [];
    arr.push(r.userId);
    map.set(r.emoji, arr);
  }
  return [...map.entries()].map(([emoji, userIds]) => ({ emoji, userIds }));
}

function serialize(message: MessageWithRelations) {
  const deleted = !!message.deletedAt;
  return {
    id: message.id,
    text: deleted ? null : message.text,
    imageUrl: deleted ? null : publicUrlForKey(message.imageKey),
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt ? message.editedAt.toISOString() : null,
    deleted,
    isCoffeeProof: !deleted && !!message.isCoffeeProof,
    isCoffeeRequest: !deleted && !!message.isCoffeeRequest,
    user: message.user,
    replyTo:
      !deleted && message.replyTo
        ? {
            id: message.replyTo.id,
            text: message.replyTo.text,
            hasImage: !!message.replyTo.imageKey,
            authorName: message.replyTo.user.name,
          }
        : null,
    reactions: deleted ? [] : groupReactions(message.reactions),
    ratings: deleted ? [] : (message.ratings ?? []),
  };
}

// GET /api/chat/messages?before=<ISO>&limit=30 — mais recentes primeiro
chatRouter.get("/messages", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;

  const messages = await prisma.chatMessage.findMany({
    where: before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: messageInclude,
  });

  const serialized = messages.map(serialize);
  const nextBefore = messages.length === limit ? messages[messages.length - 1].createdAt.toISOString() : null;

  return res.json({ messages: serialized, nextBefore });
});

// GET /api/chat/unread-count — nº de mensagens novas (de outros) desde a última leitura
chatRouter.get("/unread-count", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { chatLastReadAt: true },
  });
  const since = user?.chatLastReadAt ?? new Date(0);
  const count = await prisma.chatMessage.count({
    where: { createdAt: { gt: since }, userId: { not: req.user!.id } },
  });
  return res.json({ count });
});

// GET /api/chat/reads — até onde cada membro ativo leu o chat
chatRouter.get("/reads", requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, chatLastReadAt: true },
  });
  const reads = users.map((u) => ({
    userId: u.id,
    name: u.name,
    lastReadAt: u.chatLastReadAt ? u.chatLastReadAt.toISOString() : null,
  }));
  return res.json({ reads });
});

// POST /api/chat/read — marca que o usuário leu o chat até agora
chatRouter.post("/read", requireAuth, async (req, res) => {
  const now = new Date();
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { chatLastReadAt: now },
  });
  emitReadUpdate({ userId: req.user!.id, name: req.user!.name, lastReadAt: now.toISOString() });
  return res.json({ lastReadAt: now.toISOString() });
});

// POST /api/chat/messages — texto e/ou foto (multipart)
chatRouter.post("/messages", requireAuth, upload.single("image"), async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  const file = req.file;

  if (!text && !file) {
    return res.status(400).json({ error: "Envie um texto ou uma imagem." });
  }

  let imageKey: string | null = null;
  if (file) {
    if (!isAllowedImageType(file.mimetype)) {
      return res.status(400).json({ error: "Formato de imagem não suportado." });
    }
    imageKey = await uploadImage(file.buffer, file.mimetype);
  }

  // Valida a mensagem citada (se houver)
  let replyToId: string | null = null;
  if (typeof req.body.replyToId === "string" && req.body.replyToId) {
    const target = await prisma.chatMessage.findUnique({ where: { id: req.body.replyToId } });
    if (target) replyToId = target.id;
  }

  // Prova de café: só vale se o usuário está escalado hoje
  let isCoffeeProof = false;
  if (req.body.coffeeProof === "true" || req.body.coffeeProof === true) {
    const todayMembers = await getTodayMemberIds();
    isCoffeeProof = todayMembers.includes(req.user!.id);
  }

  const created = await prisma.chatMessage.create({
    data: { userId: req.user!.id, text: text || null, imageKey, replyToId, isCoffeeProof },
    include: messageInclude,
  });

  const payload = serialize(created);
  emitNewMessage(payload);

  if (isCoffeeProof) {
    // Encerra a dupla de hoje e avisa todo mundo p/ avaliar
    await markTodayCoffeeDone();
    void notifyCoffeeProof({ authorId: req.user!.id, authorName: req.user!.name });
  } else {
    void notifyNewMessage({
      authorId: req.user!.id,
      authorName: req.user!.name,
      preview: text ? text.slice(0, 120) : "📷 Enviou uma foto",
    });
  }

  return res.status(201).json({ message: payload });
});

// POST /api/chat/request-coffee — pede um café (mensagem no grupo + aviso geral)
chatRouter.post("/request-coffee", requireAuth, async (req, res) => {
  // limite: 1 pedido a cada 30 min por usuário
  const since = new Date(Date.now() - COFFEE_REQUEST_COOLDOWN_MS);
  const recent = await prisma.chatMessage.findFirst({
    where: { userId: req.user!.id, text: COFFEE_REQUEST_TEXT, createdAt: { gt: since } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const mins = Math.max(
      1,
      Math.ceil((COFFEE_REQUEST_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 60000),
    );
    return res
      .status(429)
      .json({ error: `Você já pediu café há pouco. Tente de novo em ${mins} min.` });
  }

  const created = await prisma.chatMessage.create({
    data: { userId: req.user!.id, text: COFFEE_REQUEST_TEXT, isCoffeeRequest: true },
    include: messageInclude,
  });
  const payload = serialize(created);
  emitNewMessage(payload);
  void notifyCoffeeRequest({ requesterId: req.user!.id, requesterName: req.user!.name });
  return res.status(201).json({ message: payload });
});

// GET /api/chat/media — todas as fotos do grupo (mais recentes primeiro)
chatRouter.get("/media", requireAuth, async (_req, res) => {
  const items = await prisma.chatMessage.findMany({
    where: { imageKey: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { id: true, name: true } } },
  });
  return res.json({
    media: items.map((m) => ({
      id: m.id,
      imageUrl: publicUrlForKey(m.imageKey),
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
  });
});

// POST /api/chat/messages/:id/react — alterna (toggle) uma reação de emoji
chatRouter.post("/messages/:id/react", requireAuth, async (req, res) => {
  const emoji = typeof req.body.emoji === "string" ? req.body.emoji.slice(0, 16) : "";
  if (!emoji) return res.status(400).json({ error: "Emoji inválido." });

  const messageId = req.params.id;
  const userId = req.user!.id;

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    // garante que a mensagem existe
    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) return res.status(404).json({ error: "Mensagem não encontrada." });
    await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
  }

  const all = await prisma.messageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });
  const reactions = groupReactions(all);
  emitReactionUpdate({ messageId, reactions });
  return res.json({ messageId, reactions });
});

// PATCH /api/chat/messages/:id — edita o texto (somente o autor)
chatRouter.patch("/messages/:id", requireAuth, async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "Texto não pode ser vazio." });

  const msg = await prisma.chatMessage.findUnique({ where: { id: req.params.id } });
  if (!msg || msg.deletedAt) return res.status(404).json({ error: "Mensagem não encontrada." });
  if (msg.isCoffeeProof || msg.isCoffeeRequest) {
    return res.status(403).json({ error: "Esta mensagem não pode ser editada." });
  }
  if (msg.userId !== req.user!.id) {
    return res.status(403).json({ error: "Você só pode editar suas mensagens." });
  }
  if (Date.now() - msg.createdAt.getTime() > 5 * 60 * 1000) {
    return res.status(403).json({ error: "Só é possível editar nos primeiros 5 minutos." });
  }

  const updated = await prisma.chatMessage.update({
    where: { id: msg.id },
    data: { text, editedAt: new Date() },
    include: messageInclude,
  });
  const payload = serialize(updated);
  emitMessageUpdate(payload);
  return res.json({ message: payload });
});

// DELETE /api/chat/messages/:id — apaga (soft delete); autor ou admin
chatRouter.delete("/messages/:id", requireAuth, async (req, res) => {
  const msg = await prisma.chatMessage.findUnique({ where: { id: req.params.id } });
  if (!msg) return res.status(404).json({ error: "Mensagem não encontrada." });
  if (msg.isCoffeeProof || msg.isCoffeeRequest) {
    return res.status(403).json({ error: "Esta mensagem não pode ser apagada." });
  }
  const isOwner = msg.userId === req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Sem permissão para apagar." });
  }
  // só dá para apagar nos primeiros 5 minutos (admin pode sempre)
  if (isOwner && !isAdmin && Date.now() - msg.createdAt.getTime() > 5 * 60 * 1000) {
    return res.status(403).json({ error: "Só é possível apagar nos primeiros 5 minutos." });
  }

  const updated = await prisma.chatMessage.update({
    where: { id: msg.id },
    data: { deletedAt: new Date(), text: null, imageKey: null, isCoffeeProof: false },
    include: messageInclude,
  });
  await prisma.messageReaction.deleteMany({ where: { messageId: msg.id } });
  await prisma.coffeeRating.deleteMany({ where: { messageId: msg.id } });

  const payload = serialize(updated);
  emitMessageUpdate(payload);
  return res.json({ message: payload });
});

// POST /api/chat/messages/:id/rate — avalia uma prova de café (1 a 5)
chatRouter.post("/messages/:id/rate", requireAuth, async (req, res) => {
  const stars = Number(req.body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: "Nota inválida (1 a 5)." });
  }
  const messageId = req.params.id;
  const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.deletedAt) return res.status(404).json({ error: "Mensagem não encontrada." });
  if (!msg.isCoffeeProof) {
    return res.status(400).json({ error: "Só é possível avaliar provas de café." });
  }
  if (msg.userId === req.user!.id) {
    return res.status(403).json({ error: "O autor não pode avaliar o próprio café." });
  }

  await prisma.coffeeRating.upsert({
    where: { messageId_userId: { messageId, userId: req.user!.id } },
    create: { messageId, userId: req.user!.id, stars },
    update: { stars },
  });
  const ratings = await prisma.coffeeRating.findMany({
    where: { messageId },
    select: { userId: true, stars: true },
  });
  emitRatingUpdate({ messageId, ratings });
  return res.json({ messageId, ratings });
});
