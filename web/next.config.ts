import type { NextConfig } from "next";

/**
 * Telegram Mini App HTTPS statik hosting (GitHub Pages, Netlify, Vercel)
 * ustida ishlaydi, shuning uchun to'liq statik eksport qilinadi.
 *
 * GitHub Pages'da repo nomi yo'lga qo'shiladi — masalan
 * https://user.github.io/bus225/ — buning uchun BASE_PATH ni bering:
 *     BASE_PATH=/bus225 npm run build
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  typedRoutes: true,
};

export default nextConfig;
