import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@features': path.resolve(__dirname, './src/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@config': path.resolve(__dirname, './src/config'),
      // Belt-and-suspenders: alias all VoiceCoach imports to the safe file
      '@/components/voice/VoiceCoachControls': path.resolve(__dirname, './src/components/voice/VoiceCoachControls.tsx'),
      '@/components/VoiceCoachControls': path.resolve(__dirname, './src/components/voice/VoiceCoachControls.tsx'),
      '@/voice/VoiceCoachControls': path.resolve(__dirname, './src/components/voice/VoiceCoachControls.tsx'),
      '@/voice/VoiceCoachOverlay': path.resolve(__dirname, './src/components/voice/VoiceCoachOverlay.tsx'),
    },
  },
  define: {
    'process.env': {},
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,                     // so DevTools shows .tsx lines
  },
  esbuild: { 
    keepNames: true,                     // keep component names in prod stacks
    minifyIdentifiers: false,            // preserve variable names for debugging
  },
}) 