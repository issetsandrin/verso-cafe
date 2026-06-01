import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

async function main() {
  const email = env.admin.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`[seed] Admin já existe: ${email}`);
    return;
  }

  const passwordHash = await hashPassword(env.admin.password);
  await prisma.user.create({
    data: {
      name: env.admin.name,
      email,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      eligible: true,
    },
  });
  console.log(`[seed] Admin criado: ${email}`);
}

main()
  .catch((err) => {
    console.error("[seed] Erro:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
