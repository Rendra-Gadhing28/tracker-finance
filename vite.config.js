import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Neko Dompet',
				short_name: 'NekoDompet',
				description: 'Finance tracker mingguan bertema kucing Ghibli-inspired',
				theme_color: '#F8F0E0',
				background_color: '#F8F0E0',
				display: 'standalone',
				icons: [
					{
						src: '/pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				],
				share_target: {
					action: '/',
					method: 'GET',
					params: {
						title: 'title',
						text: 'text',
						url: 'url'
					}
				}
			}
		})
	]
});
