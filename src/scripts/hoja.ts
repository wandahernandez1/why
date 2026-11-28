// Hojas inferiores (bottom sheets) sobre <dialog>:
// - showModal() → foco atrapado y el resto de la página inerte (aria-modal implícito)
// - cierre animado con: botón [data-cerrar], Esc, tocar afuera o arrastrar hacia abajo
// - al cerrar, el foco vuelve al elemento que la abrió

const disparadores = new WeakMap<HTMLDialogElement, HTMLElement | null>();

const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function abrirHoja(hoja: HTMLDialogElement) {
  if (hoja.open) return;
  disparadores.set(hoja, document.activeElement as HTMLElement);
  hoja.classList.remove('cerrando');
  hoja.style.transform = '';
  hoja.showModal();
}

export function cerrarHoja(hoja: HTMLDialogElement) {
  if (!hoja.open || hoja.classList.contains('cerrando')) return;
  if (sinMovimiento()) {
    hoja.close();
    return;
  }
  hoja.classList.add('cerrando');
  const terminar = () => {
    hoja.classList.remove('cerrando');
    hoja.style.transform = '';
    hoja.close();
  };
  hoja.addEventListener('animationend', terminar, { once: true });
  setTimeout(() => hoja.open && hoja.classList.contains('cerrando') && terminar(), 400); // red de seguridad
}

function habilitarArrastre(hoja: HTMLDialogElement) {
  let inicioY = 0;
  let ultimoY = 0;
  let ultimoT = 0;
  let velocidad = 0;
  let arrastrando = false;

  hoja.querySelectorAll<HTMLElement>('[data-arrastre]').forEach((zona) => {
    zona.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button, a, input')) return;
      arrastrando = true;
      inicioY = ultimoY = e.clientY;
      ultimoT = performance.now();
      velocidad = 0;
      zona.setPointerCapture(e.pointerId);
      hoja.style.transition = 'none';
    });
    zona.addEventListener('pointermove', (e) => {
      if (!arrastrando) return;
      const dy = Math.max(0, e.clientY - inicioY);
      const ahora = performance.now();
      velocidad = (e.clientY - ultimoY) / Math.max(1, ahora - ultimoT);
      ultimoY = e.clientY;
      ultimoT = ahora;
      hoja.style.transform = `translateY(${dy}px)`;
    });
    const soltar = (e: PointerEvent) => {
      if (!arrastrando) return;
      arrastrando = false;
      const dy = Math.max(0, e.clientY - inicioY);
      hoja.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
      if (dy > 120 || velocidad > 0.6) {
        hoja.style.transition = 'transform 200ms ease-in';
        hoja.style.transform = 'translateY(100%)';
        setTimeout(() => {
          hoja.close();
          hoja.style.transform = '';
          hoja.style.transition = '';
        }, 200);
      } else {
        hoja.style.transform = '';
        setTimeout(() => (hoja.style.transition = ''), 300);
      }
    };
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
  });
}

export function iniciarHojas() {
  document.querySelectorAll<HTMLDialogElement>('dialog[data-hoja]').forEach((hoja) => {
    hoja.addEventListener('close', () => disparadores.get(hoja)?.focus?.({ preventScroll: true }));

    // Esc → cierre animado
    hoja.addEventListener('cancel', (e) => {
      e.preventDefault();
      cerrarHoja(hoja);
    });
    // Tocar afuera (el backdrop es el propio <dialog>) o un [data-cerrar]
    hoja.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === hoja || t.closest('[data-cerrar]')) cerrarHoja(hoja);
    });
    habilitarArrastre(hoja);
  });
}
