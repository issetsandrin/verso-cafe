FROM node:20-slim

WORKDIR /app

# Prisma precisa do openssl
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm ci

COPY . .
RUN npx prisma generate

EXPOSE 4000

# Aplica migrations, garante o admin (seed) e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm run start"]
