import {fileURLToPath, URL} from 'node:url'

import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path from 'path';
const dotenv = require('dotenv');
dotenv.config()

// https 인증서 경로 설정
const keyPath = path.resolve(__dirname, process.env.SSL_KEY_PATH);
const certPath = path.resolve(__dirname, process.env.SSL_CERT_PATH);

export default defineConfig({
    plugins: [vue()],
    server: {
        https: {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
        },
        proxy: {
            '/api': {
                target: process.env.BACKEND_SERVER_URL,
                changeOrigin: true,
                secure: false,
            },
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }

})
// https://vitejs.dev/config/