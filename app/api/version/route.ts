export function GET() {
  return Response.json({
    version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    apiVersion: process.env.NEXT_PUBLIC_API_VERSION || "unknown",
  });
}
