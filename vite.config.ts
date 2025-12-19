import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600, // Tăng giới hạn cảnh báo lên 1600kB (mặc định là 500kB)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Tách riêng Firebase vì thư viện này thường rất nặng
            if (id.includes('firebase')) {
              return 'firebase';
            }
            // Tách React Core để cache hiệu quả hơn
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Các thư viện bên thứ 3 khác gộp vào vendor
            return 'vendor';
          }
        },
      },
    },
  },
});