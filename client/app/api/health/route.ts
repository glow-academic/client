import { NextResponse } from 'next/server';

export const dynamic = 'force-static';   // no data fetching

export function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
