import type { NextFunction, Request, Response } from "express";
import { COOKIE_NAME, verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "ACTIVE" | "DISABLED";
  eligible: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "Não autenticado." });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Conta não está ativa." });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      eligible: user.eligible,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  next();
}
