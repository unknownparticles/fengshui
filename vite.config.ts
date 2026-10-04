import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execFileSync } from "node:child_process";

const base = process.env.DEPLOY_BASE_PATH || "/fengshui/";
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
  throw new Error("部署基路径必须以斜线开始和结束");
const build =
  process.env.BUILD_REVISION ||
  execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  }).trim();
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: false,
      registerType: "prompt",
      manifest: {
        id: base,
        name: "堪舆手记 · 现场罗盘",
        short_name: "堪舆手记",
        description: "记录方位，复核坐向。现场资料保存在本机。",
        lang: "zh-Hans",
        start_url: base,
        scope: base,
        display: "standalone",
        theme_color: "#F6F3EB",
        background_color: "#F6F3EB",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
    __BUILD_REVISION__: JSON.stringify(build),
  },
});
