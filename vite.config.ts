import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 중엔 /api를 백엔드로 넘겨서 CORS 설정 없이 붙는다. 홈서버에 붙일 땐 .env.local에 API_URL
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    // gateway Nginx에서 https://<gateway>/option/ 아래로 서빙한다
    base: '/option/',
    plugins: [react()],
    server: {
      proxy: {
        '/api': env.API_URL || 'http://localhost:8080',
      },
    },
  }
})
