// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Cambiá esto por tu URL de Vercel cuando publiques (sirve para SEO/OG)
  site: 'https://web-freelance.vercel.app',
  vite: {
    plugins: [tailwindcss()],
  },
});
