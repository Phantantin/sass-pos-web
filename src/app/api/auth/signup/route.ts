import { NextResponse } from "next/server";

const sessionCookie = "sass_pos_session";

export async function POST(request: Request) {
  const apiUrl = process.env.SPRING_API_URL;
  if (!apiUrl) return NextResponse.json({ message: "SPRING_API_URL chưa được cấu hình" }, { status: 500 });

  const body = await request.json();
  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Không kết nối được backend. Dịch vụ có thể đang khởi động, hãy đợi rồi thử đăng ký lại." },
      { status: 503 },
    );
  }

  const rawBody = await upstream.text();
  let data: unknown = {};
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          message: `Backend trả về phản hồi không phải JSON (HTTP ${upstream.status}). Hãy kiểm tra dịch vụ Render rồi thử lại.`,
        },
        { status: 502 },
      );
    }
  }
  if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });

  const token =
    typeof data === "object" && data !== null && "jwt" in data && typeof data.jwt === "string" ? data.jwt : null;
  if (!token) return NextResponse.json({ message: "Backend không trả JWT hợp lệ" }, { status: 502 });

  const safeData =
    typeof data === "object" && data !== null
      ? { user: "user" in data ? data.user : undefined, message: "message" in data ? data.message : undefined }
      : { message: "Đăng ký thành công" };
  const response = NextResponse.json(safeData, { status: 201 });
  response.cookies.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8400,
    path: "/",
  });
  return response;
}
