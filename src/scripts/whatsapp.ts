// Todo lo de WhatsApp pasa por acá: armar links y abrirlos con tracking.
import site from '../data/site.json';
import { track } from './analytics';

/** Deja solo dígitos. Un placeholder tipo "[549XXXX]" queda vacío
 *  (wa.me sin número deja elegir el contacto, en vez de ir a uno inválido). */
export function limpiarNumero(numero: string): string {
  if (!numero || /[\[\]xX]/.test(numero)) return '';
  return numero.replace(/\D/g, '');
}

/** Arma https://wa.me/{numero}?text={mensaje}. Sirve en build y en el navegador. */
export function linkWhatsapp(mensaje: string, numero: string = site.whatsapp): string {
  const n = limpiarNumero(numero);
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`;
}

/** Única función para abrir WhatsApp desde cualquier botón: trackea y abre. */
export function abrirWhatsapp(
  mensaje: string,
  ubicacion: string,
  extra: Record<string, string | number> = {},
  numero?: string,
): void {
  track('click_whatsapp', { ubicacion, ...extra });
  window.open(linkWhatsapp(mensaje, numero), '_blank', 'noopener');
}

/**
 * Delegación global: cualquier elemento con `data-wa-mensaje` abre WhatsApp
 * usando abrirWhatsapp(). El `href` del <a> queda como respaldo sin JS.
 *   data-wa-mensaje="Hola!"   data-wa-ubicacion="hero"   data-wa-plan="turnos"
 */
export function iniciarBotonesWhatsapp(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-wa-mensaje]');
    if (!el) return;
    e.preventDefault();
    const { waMensaje = '', waUbicacion = 'desconocida', waPlan, waNumero } = el.dataset;
    if (waPlan) track('plan_click', { plan: waPlan });
    abrirWhatsapp(waMensaje, waUbicacion, waPlan ? { plan: waPlan } : {}, waNumero);
  });
}
