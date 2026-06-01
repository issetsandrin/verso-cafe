import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { rotationRouter } from "./routes/rotation.js";
import { chatRouter } from "./routes/chat.js";
import { uploadsRouter } from "./routes/uploads.js";
import { pushRouter } from "./routes/push.js";
import { initSocket } from "./socket.js";
import { ensureBucket } from "./services/storage.js";
import { initPush } from "./services/push.js";
import { runStartupSchedule, startCron } from "./cron.js";

const app = express();

app.set("trust proxy", 1); // atrás do Caddy
app.use(
  cors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/rotation", rotationRouter);
app.use("/api/chat", chatRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/push", pushRouter);

// Tratamento de erros (inclui limites do multer)
app.use(
  (
    err: Error & { code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Imagem muito grande (máx. 8 MB)." });
    }
    console.error("[api] Erro não tratado:", err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  },
);

const httpServer = createServer(app);
initSocket(httpServer);

async function bootstrap() {
  initPush();
  await ensureBucket();
  await runStartupSchedule();
  startCron();

  httpServer.listen(env.port, () => {
    console.log(`[api] VersoCafé API rodando na porta ${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("[api] Falha ao iniciar:", err);
  process.exit(1);
});
