import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SaaS POS",
    short_name: "SaaS POS",
    description: "Nền tảng quản lý điểm bán hàng đa cửa hàng",
    id: "/",
    start_url: "/vi/login",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
