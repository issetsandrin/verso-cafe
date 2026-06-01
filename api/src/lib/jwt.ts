import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface TokenPayload {
  sub: string; // user id
  role: "ADMIN" | "MEMBER";
}

export function signToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}

export const COOKIE_NAME = "versocafe_token";

export const cookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: env.cookieSecure,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
};
