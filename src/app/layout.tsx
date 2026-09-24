import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "SaaS POS",
  description: "Nền tảng quản lý điểm bán hàng đa cửa hàng",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
