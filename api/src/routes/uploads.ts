import { Router } from "express";
import { getObject } from "../services/storage.js";

export const uploadsRouter = Router();

// GET /api/uploads/<chave> — faz streaming da imagem a partir do MinIO
uploadsRouter.get("/*", async (req, res) => {
  const key = (req.params as Record<string, string>)[0];
  if (!key) return res.status(400).json({ error: "Chave inválida." });

  const object = await getObject(key);
  if (!object) return res.status(404).json({ error: "Imagem não encontrada." });

  if (object.contentType) res.setHeader("Content-Type", object.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  object.body.pipe(res);
});
