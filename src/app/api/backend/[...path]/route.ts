import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const apiUrl = process.env.SPRING_API_URL;
  const token = (await cookies()).get("sass_pos_session")?.value;
  if (!apiUrl) return NextResponse.json({ message: "SPRING_API_URL chưa được cấu hình" }, { status: 500 });
  if (!token) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn" }, { status: 401 });
  const { path } = await context.params;
  const url = new URL(`${apiUrl.replace(/\/$/, "")}/${path.join("/")}`);
  url.search = new URL(request.url).search;
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept-Language", request.headers.get("accept-language")?.startsWith("en") ? "en" : "vi");
  if (request.headers.get("content-type")) headers.set("Content-Type", request.headers.get("content-type")!);
  if (request.headers.get("idempotency-key")) headers.set("Idempotency-Key", request.headers.get("idempotency-key")!);
  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });
  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
  if (upstream.status === 401) response.cookies.delete("sass_pos_session");
  return response;
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
