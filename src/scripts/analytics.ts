// Envía eventos a GA4 si está cargado. Si no (placeholder, bloqueador de
// anuncios, etc.) no hace nada y nunca rompe la página.

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track(nombre: string, params: Params = {}): void {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', nombre, params);
    }
    if (import.meta.env.DEV) console.debug('[track]', nombre, params);
  } catch {
    /* silencioso a propósito */
  }
}

/**
 * Delegación global para links/botones que no son de WhatsApp:
 *   <a data-evento="demo_open" data-evento-params='{"demo":"pizzeria"}'>
 * No frena la navegación.
 */
export function iniciarEventos(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-evento]');
    if (!el?.dataset.evento) return;
    let params: Params = {};
    try {
      params = JSON.parse(el.dataset.eventoParams || '{}');
    } catch {
      /* params inválidos: se manda el evento igual */
    }
    track(el.dataset.evento, params);
  });
}
