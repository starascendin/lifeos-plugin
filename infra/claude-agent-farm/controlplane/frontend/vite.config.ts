import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const buildTimestamp = new Date().toISOString();

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
	},
	server: {
		proxy: {
			// Use VITE_API_URL env var or default to localhost
			// For cluster: VITE_API_URL=http://claude-farm-master.tail05d28.ts.net:30080 npm run dev
			'/api': process.env.VITE_API_URL || 'http://localhost:8080'
		}
	}
});
