import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { COOKIE_NAME, cookieOptions, signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

// POST /api/auth/register — cria conta PENDING (aguarda aprovação do admin)
authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { name, email, passwordHash, status: "PENDING", role: "MEMBER" },
  });

  return res.status(201).json({
    message: "Cadastro recebido! Aguarde a aprovação do administrador para acessar.",
  });
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }

  if (user.status === "PENDING") {
    return res.status(403).json({ error: "Cadastro aguardando aprovação do administrador." });
  }
  if (user.status === "DISABLED") {
    return res.status(403).json({ error: "Conta desativada. Procure o administrador." });
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(COOKIE_NAME, token, cookieOptions);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      eligible: user.eligible,
    },
  });
});

// POST /api/auth/logout
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  return res.json({ message: "Sessão encerrada." });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// PATCH /api/auth/password — troca de senha do próprio usuário
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres."),
});

authRouter.patch("/password", requireAuth, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return res.status(401).json({ error: "Senha atual incorreta." });
  }
  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return res.json({ message: "Senha alterada com sucesso." });
});
