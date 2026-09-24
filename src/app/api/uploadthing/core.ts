import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

function readCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export const uploadRouter = {
  productImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const token = readCookie(req, "sass_pos_session");
      const apiUrl = process.env.SPRING_API_URL;
      if (!token || !apiUrl) throw new UploadThingError("Bạn cần đăng nhập để tải ảnh lên.");
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const user = (await response.json().catch(() => null)) as { id?: number; role?: string } | null;
      if (
        !response.ok ||
        !user?.id ||
        !["ROLE_ADMIN", "ROLE_STORE_ADMIN", "ROLE_STORE_MANAGER"].includes(user.role ?? "")
      ) {
        throw new UploadThingError("Bạn không có quyền tải ảnh sản phẩm.");
      }
      return { userId: String(user.id) };
    })
    .onUploadComplete(async ({ file }) => ({ url: file.ufsUrl })),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
