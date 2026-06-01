import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { removeSubscription, saveSubscription } from "../services/push.js";

export const pushRouter = Router();

// GET /api/push/public-key — chave VAPID pública para o navegador
pushRouter.get("/public-key", (_req, res) => {
  return res.json({ publicKey: env.vapid.publicKey || null });
});

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

// POST /api/push/subscribe
pushRouter.post("/subscribe", requireAuth, async (req, res) => {
  const parsed = subSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Assinatura inválida." });
  }
  await saveSubscription(req.user!.id, parsed.data);
  return res.status(201).json({ message: "Notificações ativadas." });
});

// POST /api/push/unsubscribe
pushRouter.post("/unsubscribe", requireAuth, async (req, res) => {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : null;
  if (!endpoint) return res.status(400).json({ error: "Endpoint ausente." });
  await removeSubscription(endpoint);
  return res.json({ message: "Notificações desativadas." });
});
