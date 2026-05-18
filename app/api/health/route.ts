/**
 * Simple client health check endpoint
 * Used by server health checks to verify client is responding
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}
