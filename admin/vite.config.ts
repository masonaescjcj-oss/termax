import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The console talks to the same backend the app does. In development that
// is another origin, so requests are proxied rather than fighting CORS;
// in production VITE_API_URL points at the deployed backend.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
        proxy: {
            '/api': {
                target: process.env.VITE_API_URL || 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
    build: { outDir: 'dist', sourcemap: false },
});
