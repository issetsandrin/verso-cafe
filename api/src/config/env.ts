import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function parseWeekdays(raw: string): number[] {
  const days = raw
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return days.length > 0 ? days : [1, 2, 3, 4];
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  isProd: optional("NODE_ENV", "development") === "production",
  port: Number(optional("PORT", "4000")),

  databaseUrl: required("DATABASE_URL"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),
  // Cookie Secure: por padrão segue NODE_ENV; pode ser forçado via COOKIE_SECURE.
  // Em acesso local por http://localhost, deve ser false (senão o navegador descarta o cookie).
  cookieSecure:
    process.env.COOKIE_SECURE === "true"
      ? true
      : process.env.COOKIE_SECURE === "false"
        ? false
        : optional("NODE_ENV", "development") === "production",

  admin: {
    name: optional("ADMIN_NAME", "Administrador"),
    email: optional("ADMIN_EMAIL", "admin@versocafe.local"),
    password: optional("ADMIN_PASSWORD", "changeme123"),
  },

  s3: {
    endpoint: optional("S3_ENDPOINT", "http://minio:9000"),
    region: optional("S3_REGION", "us-east-1"),
    bucket: optional("S3_BUCKET", "versocafe-uploads"),
    accessKey: optional("S3_ACCESS_KEY", "versocafe"),
    secretKey: optional("S3_SECRET_KEY", "versocafe"),
    // Base pública das imagens; vazio = mesma origem (servidas em /api/uploads).
    publicUrl: optional("S3_PUBLIC_URL", ""),
  },

  vapid: {
    publicKey: optional("VAPID_PUBLIC_KEY"),
    privateKey: optional("VAPID_PRIVATE_KEY"),
    subject: optional("VAPID_SUBJECT", "mailto:admin@versocafe.local"),
  },

  corsOrigins: optional("CORS_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  coffeeWeekdays: parseWeekdays(optional("COFFEE_WEEKDAYS", "1,2,3,4")),
  // Instruções do café enviadas no aviso das 06:00 e exibidas no app.
  coffeeInstructions: optional("COFFEE_INSTRUCTIONS", "150g de café na térmica grande"),
  tz: optional("TZ", "America/Sao_Paulo"),
};

export type Env = typeof env;
