import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

const s3 = new S3Client({
  endpoint: env.s3.endpoint,
  region: env.s3.region,
  forcePathStyle: true, // necessário para o MinIO
  credentials: {
    accessKeyId: env.s3.accessKey,
    secretAccessKey: env.s3.secretKey,
  },
});

/** Garante que o bucket de uploads existe (idempotente). */
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.s3.bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: env.s3.bucket }));
      console.log(`[storage] Bucket criado: ${env.s3.bucket}`);
    } catch (err) {
      console.error("[storage] Falha ao criar bucket:", err);
    }
  }
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isAllowedImageType(mime: string): boolean {
  return mime in ALLOWED_IMAGE_TYPES;
}

/** Faz upload de uma imagem e retorna a chave (key) do objeto. */
export async function uploadImage(buffer: Buffer, mime: string): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[mime] ?? "bin";
  const key = `chat/${randomUUID()}.${ext}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
    }),
  );
  return key;
}

/** Recupera um objeto para streaming (usado pela rota /api/uploads/:key). */
export async function getObject(key: string): Promise<{ body: Readable; contentType?: string } | null> {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    return { body: out.Body as Readable, contentType: out.ContentType };
  } catch {
    return null;
  }
}

/** Monta a URL pública de uma imagem a partir da chave. */
export function publicUrlForKey(key: string | null): string | null {
  if (!key) return null;
  const base = env.s3.publicUrl?.replace(/\/$/, "") ?? "";
  return `${base}/api/uploads/${key}`;
}
