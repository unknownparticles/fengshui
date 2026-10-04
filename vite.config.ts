import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.DEPLOY_BASE_PATH || '/fengshui/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('部署基路径必须以斜线开始和结束');
export default defineConfig({
  base,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify('0.1.0') },
});
