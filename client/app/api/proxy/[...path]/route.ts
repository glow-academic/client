import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND = INTERNAL_HTTP_BASE;

async function forwardHeaders() {
  const incoming = await getHeaders(); // Promise<ReadonlyHeaders>
  const h = new Headers(incoming); // clone into mutable Headers
  h.delete("host");
  h.delete("connection");
  h.delete("content-length");
  return h;
}

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const segs = path ?? [];
  const incoming = new URL(req.url);
  const upstream = new URL("/" + segs.join("/"), BACKEND);
  upstream.search = incoming.search;

  const [h, ck] = await Promise.all([forwardHeaders(), getCookies()]); // both async in Next 15
  const token = ck.get("session")?.value;
  if (token) h.set("authorization", `Bearer ${token}`);

  const res = await fetch(upstream, {
    method: req.method,
    headers: h,
    // @ts-expect-error Node streaming quirk
    duplex: "half",
    body: req.body ?? undefined,
    redirect: "manual",
  });

  const out = new Headers(res.headers);
  out.delete("transfer-encoding");
  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

export {
  handler as DELETE,
  handler as GET,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
