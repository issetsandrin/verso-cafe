import { formatInTimeZone } from "date-fns-tz";

/**
 * Datas de café são representadas como Date em meia-noite UTC correspondente
 * à data de calendário (coluna @db.Date no Prisma). O dia da semana é obtido
 * com getUTCDay() para manter consistência independente do fuso do servidor.
 */

/** Data de hoje (calendário no fuso informado) como meia-noite UTC. */
export function getZonedToday(tz: string): Date {
  const ymd = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Constrói uma data (meia-noite UTC) a partir de "yyyy-MM-dd". */
export function dateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Formata uma data de café como "yyyy-MM-dd". */
export function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isCoffeeDay(date: Date, weekdays: number[]): boolean {
  return weekdays.includes(date.getUTCDay());
}

export function addUTCDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Retorna as próximas `count` datas de café a partir de `from` (inclusive,
 * se `from` cair num dia de café), considerando apenas os dias da semana
 * em `weekdays` (0=Dom ... 6=Sáb). Função pura — testável.
 */
export function nextCoffeeDates(from: Date, weekdays: number[], count: number): Date[] {
  if (weekdays.length === 0 || count <= 0) return [];
  const result: Date[] = [];
  let cursor = new Date(from);
  // Limite de segurança para evitar laço infinito.
  let guard = 0;
  while (result.length < count && guard < count * 14 + 14) {
    if (weekdays.includes(cursor.getUTCDay())) {
      result.push(new Date(cursor));
    }
    cursor = addUTCDays(cursor, 1);
    guard++;
  }
  return result;
}
