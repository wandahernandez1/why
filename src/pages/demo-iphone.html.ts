/**
 * Sirve la demo de iPhone (herramientas/demo-iphone.html) como página propia,
 * para que el iPhone del hero la cargue en un iframe con ?embed=1.
 */
import demoIphone from '../../herramientas/demo-iphone.html?raw';

export const prerender = true;

export function GET() {
  return new Response(demoIphone, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
