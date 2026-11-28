// Carga diferida de los iframes de demo dentro de los iPhone (ver Iphone.astro).
// Así la landing pinta rápido y la demo llega después.

export function cargarIframe(contenedor: HTMLElement, src?: string) {
  const iframe = contenedor.querySelector('iframe');
  if (!iframe) return;
  const destino = src ?? iframe.dataset.src;
  if (!destino || iframe.getAttribute('src') === destino) return;
  iframe.classList.remove('cargado');
  iframe.addEventListener('load', () => iframe.classList.add('cargado'), { once: true });
  iframe.src = destino;
}

// La pantalla de la demo mide 393 px de ancho; el iframe se escala para ocupar el ancho real.
function ajustarEscala(telefono: HTMLElement) {
  const pantalla = telefono.querySelector<HTMLElement>('.pantalla');
  if (pantalla) telefono.style.setProperty('--escala', (pantalla.clientWidth / 393).toFixed(4));
}

export function iniciarIphones() {
  const telefonos = [...document.querySelectorAll<HTMLElement>('[data-iphone]')];

  telefonos.forEach((t) => {
    ajustarEscala(t);
    if ('ResizeObserver' in window) new ResizeObserver(() => ajustarEscala(t)).observe(t);
  });

  // Hero: después de que la página terminó de cargar y el navegador está libre
  const idle = telefonos.filter((t) => t.dataset.carga === 'idle');
  const cuandoLibre = () =>
    ('requestIdleCallback' in window ? window.requestIdleCallback : (cb: () => void) => setTimeout(cb, 300))(() =>
      idle.forEach((t) => cargarIframe(t)),
    );
  if (document.readyState === 'complete') cuandoLibre();
  else window.addEventListener('load', cuandoLibre, { once: true });

  // Sección Demos: cuando el teléfono se acerca a la pantalla
  const visibles = telefonos.filter((t) => t.dataset.carga === 'visible');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            cargarIframe(e.target as HTMLElement);
            obs.unobserve(e.target);
          }
        }),
      { rootMargin: '300px 0px' },
    );
    visibles.forEach((t) => obs.observe(t));
  } else visibles.forEach((t) => cargarIframe(t));
}
