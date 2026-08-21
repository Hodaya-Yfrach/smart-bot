// =============================================================================
// app/api/guest/route.ts — POST /api/guest
// מנפיק cookie חתום (HMAC-SHA256) לגישת אורח חד-פעמית.
//
// זרימה:
//   1. בדיקה שאין כבר cookie תקף → אם יש, מחזיר ok ישר.
//   2. בדיקת IP — כל IP מקבל אסימון אחד בלבד (per-process).
//   3. יצירת token חתום + הגדרתו כ-httpOnly cookie (TTL: 24 שעות).
//
// DEV NOTE: issuedGuestIps ו-consumedGuestTokens הם in-memory —
//           ב-production עם מספר instances יש להשתמש ב-Redis.
// =============================================================================
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'guest_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret() {
  return process.env.GUEST_COOKIE_SECRET ?? 'guest-cookie-secret-fallback-upgrade-ai';
}

function sign(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function createToken() {
  const payload = `${randomUUID()}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function isValidToken(token: string | undefined) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const provided = Buffer.from(parts[2]);
  const validSignature = provided.length === expected.length && timingSafeEqual(provided, Buffer.from(expected));
  const createdAt = Number(parts[1]);

  return validSignature && Number.isFinite(createdAt) && Date.now() - createdAt < SESSION_TTL_MS;
}

export async function POST(req: Request) {
  try {
    const existingToken = req.headers.get('cookie')?.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1];
    if (isValidToken(existingToken)) return NextResponse.json({ ok: true });

    // IP-based limiting הוסר — ב-Vercel serverless כל instance הוא נפרד
    // האבטחה מסתמכת על ה-cookie החתום + צריכה חד-פעמית ב-/api/chat
    const token = createToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS / 1000,
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'שירות האורח אינו מוגדר בשרת.' }, { status: 503 });
  }
}

export async function GET(req: Request) {
  try {
    const guestToken = req.headers.get('cookie')?.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1];
    return NextResponse.json({ isGuest: isValidToken(guestToken) });
  } catch {
    return NextResponse.json({ isGuest: false });
  }
}

export { COOKIE_NAME, isValidToken };
