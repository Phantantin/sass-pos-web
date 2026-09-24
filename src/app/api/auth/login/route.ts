import { NextResponse } from "next/server";

const sessionCookie = "sass_pos_session";

export async function POST(request: Request) {
  const apiUrl = process.env.SPRING_API_URL;
  if (!apiUrl) return NextResponse.json({ message: "SPRING_API_URL chưa được cấu hình" }, { status: 500 });
  const body = await request.json();
  const upstream = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data: unknown = await upstream.json().catch(() => ({ message: "Backend trả về dữ liệu không hợp lệ" }));
  if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });
  const token =
    typeof data === "object" && data !== null && "jwt" in data && typeof data.jwt === "string" ? data.jwt : null;
  if (!token) return NextResponse.json({ message: "Backend không trả JWT hợp lệ" }, { status: 502 });
  const safeData =
    typeof data === "object" && data !== null
      ? { user: "user" in data ? data.user : undefined, message: "message" in data ? data.message : undefined }
      : { message: "Đăng nhập thành công" };
  const response = NextResponse.json(safeData);
  response.cookies.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8400,
    path: "/",
  });
  return response;
}
