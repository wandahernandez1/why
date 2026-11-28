// Solo para el build (frontmatter de .astro): busca imágenes en src/assets/
// a partir de la ruta corta que se escribe en los JSON ("demos/pizzeria/muzzarella.jpg").
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

const assets = import.meta.glob<{ default: ImageMetadata }>('/src/assets/**/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

export function buscarAsset(ruta: string | null | undefined): ImageMetadata | undefined {
  if (!ruta) return undefined;
  return assets['/src/assets/' + ruta.replace(/^\/?(src\/assets\/)?/, '')]?.default;
}

/** URL optimizada (WebP) de una imagen de src/assets para usar desde JS en el navegador. */
export async function urlOptimizada(ruta: string | null | undefined, ancho: number): Promise<string | null> {
  const asset = buscarAsset(ruta);
  if (!asset) return ruta ?? null;
  const img = await getImage({ src: asset, width: ancho, format: 'webp' });
  return img.src;
}
