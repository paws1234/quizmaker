import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

/**
 * Liveness probe used by the compose healthcheck: it proves both the web
 * container and its database connection are actually working.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const connection = await connectDB();
    await connection.connection.db?.admin().command({ ping: 1 });
    return NextResponse.json({ ok: true, database: 'up' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, database: 'down', error: error instanceof Error ? error.message : 'unknown error' },
      { status: 503 },
    );
  }
}
