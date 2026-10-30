import process from 'node:process';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// GitHub Pages serves 404.html for anything unknown
			adapter : adapter({fallback : '404.html'}),
			// Served from /mousse on GitHub Pages : the workflow sets BASE_PATH
			paths : {base : process.argv.includes('dev') ? '' : (process.env.BASE_PATH ?? '') as '' | `/${string}`}
		})
	]
});
