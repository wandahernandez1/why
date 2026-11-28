// Sitemap para Google. Solo páginas indexables (las demos y /prueba llevan noindex).
import type { APIRoute } from 'astro';

const paginas = ['/', '/privacidad'];

export const GET: APIRoute = ({ site }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const urls = paginas
    .map((p) => `  <url><loc>${new URL(p, site).href}</loc><lastmod>${hoy}</lastmod></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
