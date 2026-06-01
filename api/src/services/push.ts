import webpush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

let configured = false;

export function initPush(): void {
  if (env.vapid.publicKey && env.vapid.privateKey) {
    webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
    configured = true;
    console.log("[push] Web Push habilitado (VAPID configurado).");
  } else {
    console.log("[push] Web Push desabilitado (VAPID não configurado).");
  }
}

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendToUserIds(userIds: string[], payload: PushPayload): Promise<void> {
  if (!configured || userIds.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // Assinatura expirada/inválida → remove
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        }
      }
    }),
  );
}

/** Notifica todos os membros ativos (exceto o autor) sobre nova mensagem. */
export async function notifyNewMessage(opts: {
  authorId: string;
  authorName: string;
  preview: string;
}): Promise<void> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", id: { not: opts.authorId } },
    select: { id: true },
  });
  await sendToUserIds(
    users.map((u) => u.id),
    {
      title: `💬 ${opts.authorName}`,
      body: opts.preview,
      url: "/chat",
      tag: "chat",
    },
  );
}

/** Aviso geral a todos (exceto o autor) quando o café é comprovado. */
export async function notifyCoffeeProof(opts: {
  authorId: string;
  authorName: string;
}): Promise<void> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", id: { not: opts.authorId } },
    select: { id: true },
  });
  await sendToUserIds(
    users.map((u) => u.id),
    {
      title: "☕ Café passado!",
      body: `${opts.authorName} acabou de passar o café. Toque para avaliar!`,
      url: "/chat",
      tag: "coffee-proof",
    },
  );
}

/** Aviso geral quando alguém solicita um café. */
export async function notifyCoffeeRequest(opts: {
  requesterId: string;
  requesterName: string;
}): Promise<void> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", id: { not: opts.requesterId } },
    select: { id: true },
  });
  await sendToUserIds(
    users.map((u) => u.id),
    {
      title: "☕ Pedido de café",
      body: `${opts.requesterName} está pedindo um café!`,
      url: "/chat",
      tag: "coffee-request",
    },
  );
}

/** Notifica os escalados de hoje que é a vez deles, com as instruções do café. */
export async function notifyTodayTurn(userIds: string[]): Promise<void> {
  await sendToUserIds(userIds, {
    title: "☕ Hoje é a sua vez de fazer o café!",
    body: `📋 ${env.coffeeInstructions}`,
    url: "/",
    tag: "coffee-turn",
  });
}
