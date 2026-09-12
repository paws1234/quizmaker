import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminToken, sessionFor } from '@/lib/graphql/context';

/**
 * Builder sign-in.
 *
 * The admin token is exchanged for an httpOnly, SameSite=strict cookie, so it
 * is never readable by page scripts and never sent from another site.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function GET(request: Request) {
  const { isAdmin, configured } = sessionFor(request);
  return NextResponse.json({ authenticated: isAdmin, configured });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';

  if (!process.env.ADMIN_TOKEN?.trim()) {
    return NextResponse.json(
      { error: 'The server has no ADMIN_TOKEN configured, so the builder is locked.' },
      { status: 503 },
    );
  }

  if (!isAdminToken(token)) {
    return NextResponse.json({ error: 'That token is not correct.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
      // Required over HTTPS (any platform deployment, or a TLS proxy in front of
      // the container) and fatal over plain http, where the browser would drop it.
      secure: isHttps(request),
  });
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, '', {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
        secure: isHttps(request),
    });
  return response;
}

/** TLS is usually terminated before the app, so the scheme comes from the proxy header. */
function isHttps(request: Request): boolean {
    const forwarded = request.headers.get('x-forwarded-proto');
    if (forwarded) return forwarded.split(',')[0].trim() === 'https';
    return new URL(request.url).protocol === 'https:';
}
