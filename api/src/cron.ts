import cron from "node-cron";
import { env } from "./config/env.js";
import { ensureUpcomingSchedule, getTodayMemberIds } from "./services/rotationService.js";
import { notifyTodayTurn } from "./services/push.js";

async function dailyRoutine(): Promise<void> {
  try {
    const result = await ensureUpcomingSchedule();
    if (result.generated > 0) {
      console.log(`[cron] Novo round gerado: ${result.generated} dia(s).`);
    }
    const todayMembers = await getTodayMemberIds();
    if (todayMembers.length > 0) {
      await notifyTodayTurn(todayMembers);
      console.log(`[cron] Push "sua vez" enviado para ${todayMembers.length} pessoa(s).`);
    }
  } catch (err) {
    console.error("[cron] Erro na rotina diária:", err);
  }
}

export function startCron(): void {
  // Todo dia às 06:00 (no fuso configurado): mantém a escala e avisa os escalados.
  cron.schedule("0 6 * * *", dailyRoutine, { timezone: env.tz });
  console.log(`[cron] Agendador ativo (06:00 ${env.tz}).`);
}

/** Executa a manutenção da escala uma vez no boot (garante escala inicial). */
export async function runStartupSchedule(): Promise<void> {
  try {
    const result = await ensureUpcomingSchedule();
    if (result.generated > 0) {
      console.log(`[startup] Escala inicial gerada: ${result.generated} dia(s).`);
    }
  } catch (err) {
    console.error("[startup] Erro ao preparar a escala:", err);
  }
}
