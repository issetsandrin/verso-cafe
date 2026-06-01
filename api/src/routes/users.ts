import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const usersRouter = Router();

const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  eligible: true,
  createdAt: true,
} as const;

// GET /api/users — lista todos (admin), com filtro opcional por status
usersRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  const status = req.query.status as string | undefined;
  const where =
    status && ["PENDING", "ACTIVE", "DISABLED"].includes(status)
      ? { status: status as "PENDING" | "ACTIVE" | "DISABLED" }
      : {};
  const users = await prisma.user.findMany({
    where,
    select: publicUser,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return res.json({ users });
});

// GET /api/users/members — membros ativos (visível a qualquer usuário logado)
usersRouter.get("/members", requireAuth, async (_req, res) => {
  const members = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, eligible: true, role: true },
    orderBy: { name: "asc" },
  });
  return res.json({ members });
});

// POST /api/users/:id/approve — aprova cadastro pendente
usersRouter.post("/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: "ACTIVE" },
    select: publicUser,
  });
  return res.json({ user: updated });
});

// POST /api/users/:id/disable — desativa um usuário
usersRouter.post("/:id/disable", requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: "Você não pode desativar a própria conta." });
  }
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: "DISABLED" },
    select: publicUser,
  });
  return res.json({ user: updated });
});

const patchSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  eligible: z.boolean().optional(),
});

// PATCH /api/users/:id — altera papel e/ou elegibilidade
usersRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos." });
  }
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

  // Impede o admin de remover o próprio papel de admin (evita travar o sistema)
  if (req.params.id === req.user!.id && parsed.data.role === "MEMBER") {
    return res.status(400).json({ error: "Você não pode remover o próprio acesso de admin." });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: publicUser,
  });
  return res.json({ user: updated });
});
