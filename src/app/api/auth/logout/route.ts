import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Đã đăng xuất" });
  response.cookies.set("sass_pos_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return response;
}
