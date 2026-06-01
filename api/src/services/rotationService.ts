import type { CoffeeDay, CoffeeAssignment, User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { addUTCDays, getZonedToday, nextCoffeeDates, toYmd } from "../lib/dates.js";
import { planRound } from "./rotationLogic.js";

type DayWithMembers = CoffeeDay & {
  assignments: (CoffeeAssignment & { user: Pick<User, "id" | "name"> })[];
};

const dayInclude = {
  assignments: {
    include: { user: { select: { id: true, name: true } } },
  },
} as const;

function serializeDay(day: DayWithMembers, today: Date) {
  const passed = day.status === "DONE" || day.date < today;
  return {
    id: day.id,
    date: toYmd(day.date),
    roundNumber: day.roundNumber,
    status: day.status,
    isToday: toYmd(day.date) === toYmd(today),
    passed,
    members: day.assignments.map((a) => ({ id: a.user.id, name: a.user.name })),
  };
}

async function getEligibleUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", eligible: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => u.id);
}

/**
 * Gera o próximo round de café (duplas distribuídas nos próximos dias de café),
 * criando os CoffeeDay + assignments. Não repete ninguém dentro do round.
 */
export async function generateNextRound(opts?: { from?: Date }): Promise<number> {
  const eligibleIds = await getEligibleUserIds();
  if (eligibleIds.length === 0) return 0;

  const maxRound = await prisma.coffeeDay.aggregate({ _max: { roundNumber: true } });
  const roundNumber = (maxRound._max.roundNumber ?? 0) + 1;

  const today = getZonedToday(env.tz);
  let start = opts?.from ?? today;
  if (!opts?.from) {
    const last = await prisma.coffeeDay.findFirst({ orderBy: { date: "desc" } });
    if (last) {
      const dayAfter = addUTCDays(last.date, 1);
      start = dayAfter > today ? dayAfter : today;
    }
  }

  const pairs = planRound(eligibleIds);
  const dates = nextCoffeeDates(start, env.coffeeWeekdays, pairs.length);

  await prisma.$transaction(
    pairs.map((pair, i) =>
      prisma.coffeeDay.create({
        data: {
          date: dates[i],
          roundNumber,
          assignments: { create: pair.map((userId) => ({ userId })) },
        },
      }),
    ),
  );

  return pairs.length;
}

/**
 * Mantém a escala em dia (chamado pelo agendador): marca dias passados como
 * concluídos e gera um novo round quando não há mais dias agendados à frente.
 */
export async function ensureUpcomingSchedule(): Promise<{ generated: number }> {
  const today = getZonedToday(env.tz);

  await prisma.coffeeDay.updateMany({
    where: { status: "SCHEDULED", date: { lt: today } },
    data: { status: "DONE" },
  });

  const upcoming = await prisma.coffeeDay.count({
    where: { status: "SCHEDULED", date: { gte: today } },
  });

  if (upcoming === 0) {
    const generated = await generateNextRound();
    return { generated };
  }
  return { generated: 0 };
}

/** Admin: descarta dias agendados futuros e gera um novo round a partir de hoje. */
export async function regenerateSchedule(): Promise<{ generated: number }> {
  const today = getZonedToday(env.tz);
  await prisma.coffeeDay.deleteMany({
    where: { status: "SCHEDULED", date: { gte: today } },
  });
  const generated = await generateNextRound({ from: today });
  return { generated };
}

export async function getToday() {
  const today = getZonedToday(env.tz);
  const day = await prisma.coffeeDay.findUnique({
    where: { date: today },
    include: dayInclude,
  });
  return day ? serializeDay(day, today) : null;
}

/** Próxima dupla agendada (estritamente após hoje). */
export async function getNext() {
  const today = getZonedToday(env.tz);
  const day = await prisma.coffeeDay.findFirst({
    where: { date: { gt: today } },
    orderBy: { date: "asc" },
    include: dayInclude,
  });
  return day ? serializeDay(day, today) : null;
}

/** Marca o café de hoje como concluído (quando alguém comprova). */
export async function markTodayCoffeeDone() {
  const today = getZonedToday(env.tz);
  await prisma.coffeeDay.updateMany({
    where: { date: today, status: "SCHEDULED" },
    data: { status: "DONE" },
  });
}

export async function getUpcoming(limit = 12) {
  const today = getZonedToday(env.tz);
  const days = await prisma.coffeeDay.findMany({
    where: { date: { gte: today } },
    orderBy: { date: "asc" },
    take: limit,
    include: dayInclude,
  });
  return days.map((d) => serializeDay(d, today));
}

export async function getHistory(limit = 30) {
  const today = getZonedToday(env.tz);
  const days = await prisma.coffeeDay.findMany({
    where: { date: { lt: today } },
    orderBy: { date: "desc" },
    take: limit,
    include: dayInclude,
  });
  return days.map((d) => serializeDay(d, today));
}

/** Progresso do round atual: quantos já passaram x total de elegíveis no round. */
export async function getRoundProgress() {
  const today = getZonedToday(env.tz);

  const nextDay = await prisma.coffeeDay.findFirst({
    where: { date: { gte: today } },
    orderBy: { date: "asc" },
    select: { roundNumber: true },
  });
  const maxRound = await prisma.coffeeDay.aggregate({ _max: { roundNumber: true } });
  const roundNumber = nextDay?.roundNumber ?? maxRound._max.roundNumber ?? 0;
  if (roundNumber === 0) return { roundNumber: 0, total: 0, done: 0 };

  const days = await prisma.coffeeDay.findMany({
    where: { roundNumber },
    include: dayInclude,
  });

  let total = 0;
  let done = 0;
  for (const day of days) {
    const passed = day.status === "DONE" || day.date < today;
    for (const _a of day.assignments) {
      total++;
      if (passed) done++;
    }
  }
  return { roundNumber, total, done };
}

/** Ranking em 2 modalidades: quem mais fez café e os mais bem avaliados. */
export async function getRanking() {
  const today = getZonedToday(env.tz);

  // Quem mais fez (dias concluídos ou já passados)
  const days = await prisma.coffeeDay.findMany({
    where: { OR: [{ status: "DONE" }, { date: { lt: today } }] },
    select: {
      assignments: { select: { userId: true, user: { select: { name: true } } } },
    },
  });
  const counts = new Map<string, { name: string; count: number }>();
  for (const d of days) {
    for (const a of d.assignments) {
      const cur = counts.get(a.userId) ?? { name: a.user.name, count: 0 };
      cur.count++;
      counts.set(a.userId, cur);
    }
  }
  const byCount = [...counts.entries()]
    .map(([userId, v]) => ({ userId, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count);

  // Mais bem avaliados (média das estrelas nas provas de café)
  const proofs = await prisma.chatMessage.findMany({
    where: { isCoffeeProof: true, deletedAt: null },
    select: {
      userId: true,
      user: { select: { name: true } },
      ratings: { select: { stars: true } },
    },
  });
  const rate = new Map<string, { name: string; sum: number; votes: number }>();
  for (const p of proofs) {
    const cur = rate.get(p.userId) ?? { name: p.user.name, sum: 0, votes: 0 };
    for (const r of p.ratings) {
      cur.sum += r.stars;
      cur.votes++;
    }
    rate.set(p.userId, cur);
  }
  const byRating = [...rate.entries()]
    .filter(([, v]) => v.votes > 0)
    .map(([userId, v]) => ({
      userId,
      name: v.name,
      average: Math.round((v.sum / v.votes) * 10) / 10,
      votes: v.votes,
    }))
    .sort((a, b) => b.average - a.average || b.votes - a.votes);

  return { byCount, byRating };
}

/** Ids dos usuários escalados para hoje (usado pelo push "é a sua vez"). */
export async function getTodayMemberIds(): Promise<string[]> {
  const today = getZonedToday(env.tz);
  const day = await prisma.coffeeDay.findUnique({
    where: { date: today },
    include: { assignments: { select: { userId: true } } },
  });
  return day?.assignments.map((a) => a.userId) ?? [];
}
