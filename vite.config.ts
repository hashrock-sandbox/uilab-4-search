import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages のプロジェクトページ配下 (/uilab-4-search/) で配信する
  base: '/uilab-4-search/',
  plugins: [react()],
})
