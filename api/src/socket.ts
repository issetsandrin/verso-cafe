import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME, verifyToken } from "./lib/jwt.js";
import { prisma } from "./lib/prisma.js";
import { env } from "./config/env.js";

const GROUP_ROOM = "group";

let io: Server | null = null;

// presença: userId -> { name, nº de conexões }
const online = new Map<string, { name: string; count: number }>();

function presenceList(): { userId: string; name: string }[] {
  return [...online.entries()].map(([userId, v]) => ({ userId, name: v.name }));
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: env.corsOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      let token: string | undefined;
      if (rawCookie) token = parseCookie(rawCookie)[COOKIE_NAME];
      if (!token && typeof socket.handshake.auth?.token === "string") {
        token = socket.handshake.auth.token;
      }
      if (!token) return next(new Error("unauthorized"));

      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, status: true },
      });
      if (!user || user.status !== "ACTIVE") return next(new Error("unauthorized"));

      socket.data.user = { id: user.id, name: user.name };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(GROUP_ROOM);
    const u = socket.data.user as { id: string; name: string } | undefined;

    // presença online
    if (u) {
      const cur = online.get(u.id) ?? { name: u.name, count: 0 };
      cur.count++;
      online.set(u.id, cur);
      io?.to(GROUP_ROOM).emit("presence:update", presenceList());
    }

    // "digitando..." — repassa para os demais do grupo (menos o próprio)
    socket.on("typing", (isTyping: boolean) => {
      if (!u) return;
      socket.to(GROUP_ROOM).emit("typing:update", {
        userId: u.id,
        name: u.name,
        typing: !!isTyping,
      });
    });

    socket.on("disconnect", () => {
      if (!u) return;
      const cur = online.get(u.id);
      if (cur) {
        cur.count--;
        if (cur.count <= 0) online.delete(u.id);
        else online.set(u.id, cur);
      }
      io?.to(GROUP_ROOM).emit("presence:update", presenceList());
    });
  });

  return io;
}

export interface BroadcastMessage {
  id: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
  user: { id: string; name: string };
  replyTo?: {
    id: string;
    text: string | null;
    hasImage: boolean;
    authorName: string;
  } | null;
}

/** Emite uma nova mensagem do chat para todos os usuários conectados. */
export function emitNewMessage(message: BroadcastMessage): void {
  io?.to(GROUP_ROOM).emit("message:new", message);
}

export interface ReadUpdate {
  userId: string;
  name: string;
  lastReadAt: string;
}

/** Avisa todos que um usuário leu o chat até determinado momento. */
export function emitReadUpdate(update: ReadUpdate): void {
  io?.to(GROUP_ROOM).emit("read:update", update);
}

export interface ReactionUpdate {
  messageId: string;
  reactions: { emoji: string; userIds: string[] }[];
}

/** Atualiza as reações de uma mensagem para todos. */
export function emitReactionUpdate(update: ReactionUpdate): void {
  io?.to(GROUP_ROOM).emit("reaction:update", update);
}

/** Mensagem editada/apagada — envia a versão serializada atualizada. */
export function emitMessageUpdate(message: BroadcastMessage): void {
  io?.to(GROUP_ROOM).emit("message:update", message);
}

export interface RatingUpdate {
  messageId: string;
  ratings: { userId: string; stars: number }[];
}

/** Atualiza as avaliações (estrelas) de uma prova de café. */
export function emitRatingUpdate(update: RatingUpdate): void {
  io?.to(GROUP_ROOM).emit("rating:update", update);
}
