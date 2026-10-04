import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isProd } from "@/lib/env";

/**
 * Player sessions.
 *
 * Every visitor who plays gets a profile row (anonymous at first). The
 * browser only holds an HMAC-signed, httpOnly cookie: `<profileId>.<version>`.
 * Bumping `profiles.session_version` revokes all outstanding cookies.
 *
 * Supabase Auth (email / Google / Apple) is layered on top: signing in links
 * `auth_user_id` to the profile — see `lib/auth/link.ts`.
 */
export const SESSION_COOKIE = "fa_sid";
export const ADMIN_COOKIE = "fa_admin";
const SESSION_MAX_AGE = 60 * 60 * 24 * 400; // ~13 months (browser cap)
const ADMIN_MAX_AGE = 60 * 60 * 12;
const DEV_SECRET = "dev-only-insecure-session-secret-change-me";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16 && (!isProd || s !== DEV_SECRET)) return s;
  if (isProd) throw new Error("SESSION_SECRET must be set to a strong random value in production");
  return DEV_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export interface SessionClaims {
  playerId: string;
  version: number;
}

export function encodeSession(claims: SessionClaims): string {
  const payload = Buffer.from(`${claims.playerId}.${claims.version}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined | null): SessionClaims | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  const [playerId, version] = Buffer.from(payload, "base64url").toString().split(".");
  if (!/^[0-9a-f-]{36}$/.test(playerId ?? "") || !Number.isInteger(Number(version))) return null;
  return { playerId, version: Number(version) };
}

export async function readSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export async function writeSession(claims: SessionClaims) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(claims), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/* ── admin bootstrap cookie (ADMIN_SECRET login) ─────────────────────────── */

export function encodeAdmin(issuedAt = Date.now()): string {
  const payload = Buffer.from(`admin.${issuedAt}`).toString("base64url");
  return `${payload}.${sign(`admin:${payload}`)}`;
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sign(`admin:${payload}`), sig)) return false;
  const issued = Number(Buffer.from(payload, "base64url").toString().split(".")[1]);
  return Number.isFinite(issued) && Date.now() - issued < ADMIN_MAX_AGE * 1000;
}

export async function writeAdminCookie() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, encodeAdmin(), { httpOnly: true, sameSite: "strict", secure: isProd, path: "/", maxAge: ADMIN_MAX_AGE });
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function hasAdminCookie(): Promise<boolean> {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export function checkAdminSecret(candidate: string): boolean {
  const expected = process.env.ADMIN_SECRET || (isProd ? "" : "dev-admin");
  if (!expected || expected.length < 6) return false;
  return safeEqual(sign(`s:${candidate}`), sign(`s:${expected}`));
}
