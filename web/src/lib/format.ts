import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Converte "yyyy-MM-dd" em Date local (meia-noite local). */
function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Ex.: "Hoje", "Amanhã" ou "seg, 02 jun". */
export function formatCoffeeDate(ymd: string): string {
  const date = ymdToLocalDate(ymd);
  if (isToday(date)) return "Hoje";
  if (isTomorrow(date)) return "Amanhã";
  return format(date, "EEE, dd MMM", { locale: ptBR });
}

/** Ex.: "segunda-feira, 2 de junho". */
export function formatCoffeeDateLong(ymd: string): string {
  const date = ymdToLocalDate(ymd);
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
}

/** Hora curta para mensagens do chat (HH:mm). */
export function formatTime(iso: string): string {
  return format(parseISO(iso), "HH:mm", { locale: ptBR });
}

/** Cabeçalho de dia no chat ("Hoje", "Ontem" ou data). */
export function formatDayHeader(iso: string): string {
  const date = parseISO(iso);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/** Chave de data local (yyyy-MM-dd) para agrupar mensagens por dia. */
export function dayKey(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
