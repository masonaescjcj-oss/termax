import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The terminal talks to the same backend the mobile app does. In development
// that is another origin, so REST and the socket are proxied rather than
// fighting CORS; in production VITE_API_URL points at the deployed backend.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5175,
        proxy: {
            '/api': { target: process.env.VITE_API_URL || 'http://localhost:5000', changeOrigin: true },
            '/socket.io': { target: process.env.VITE_API_URL || 'http://localhost:5000', changeOrigin: true, ws: true },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            output: {
                // The chart engine is the one big dependency; keep it in its
                // own chunk so an app change does not re-download it.
                manualChunks: { chart: ['klinecharts'], vendor: ['react', 'react-dom', 'react-router-dom', 'socket.io-client'] },
            },
        },
    },
});
