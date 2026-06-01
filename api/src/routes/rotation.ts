import { Router } from "express";
import { env } from "../config/env.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  getHistory,
  getNext,
  getRanking,
  getRoundProgress,
  getToday,
  getUpcoming,
  regenerateSchedule,
} from "../services/rotationService.js";

export const rotationRouter = Router();

// GET /api/rotation/today — dupla de hoje + progresso do round
rotationRouter.get("/today", requireAuth, async (req, res) => {
  const [today, progress, next] = await Promise.all([getToday(), getRoundProgress(), getNext()]);
  const isMyTurn = today?.members.some((m) => m.id === req.user!.id) ?? false;
  return res.json({ today, progress, isMyTurn, next, instructions: env.coffeeInstructions });
});

// GET /api/rotation/upcoming — próximos dias
rotationRouter.get("/upcoming", requireAuth, async (_req, res) => {
  const upcoming = await getUpcoming();
  return res.json({ upcoming });
});

// GET /api/rotation/history — dias anteriores
rotationRouter.get("/history", requireAuth, async (_req, res) => {
  const history = await getHistory();
  return res.json({ history });
});

// GET /api/rotation/ranking — 2 modalidades: byCount e byRating
rotationRouter.get("/ranking", requireAuth, async (_req, res) => {
  const ranking = await getRanking();
  return res.json(ranking);
});

// POST /api/rotation/regenerate — admin regera a escala a partir de hoje
rotationRouter.post("/regenerate", requireAuth, requireAdmin, async (_req, res) => {
  const result = await regenerateSchedule();
  return res.json({ message: `Escala regenerada (${result.generated} dia(s)).`, ...result });
});
