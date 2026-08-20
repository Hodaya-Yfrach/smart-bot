import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'guest_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const issuedGuestIps = new Set<string>();

function getSecret() {
  const secret = process.env.GUEST_COOKIE_SECRET;
  if (!secret) throw new Error('GUEST_COOKIE_SECRET is not configured');
  return secret;
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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous';
    if (issuedGuestIps.has(ip)) {
      return NextResponse.json({ error: 'כבר הופעלה גישת אורח מהמכשיר הזה.' }, { status: 403 });
    }

    const token = createToken();
    issuedGuestIps.add(ip);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_TTL_MS / 1000,
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'שירות האורח אינו מוגדר בשרת.' }, { status: 503 });
  }
}

export { COOKIE_NAME, isValidToken };
