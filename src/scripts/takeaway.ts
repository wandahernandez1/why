// Plantilla take away (v2 "Mostrador claro").
// Lee los datos del negocio del <script type="application/json" id="datos-takeaway">.
// La lógica de precios, carrito y el FORMATO DEL MENSAJE no cambian respecto de v1.
import { abrirWhatsapp, linkWhatsapp } from './whatsapp';
import { track } from './analytics';
import { formatearARS } from './formato';
import { estadoLocal, type Horarios } from './horarios';
import { abrirHoja, cerrarHoja, iniciarHojas } from './hoja';
import { almacenamientoPedidos, nuevoIdDemo } from './persistencia-demo';

// ---------- Tipos ----------
type Opcion = { id: string; nombre: string; precio: number };
type Producto = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imgGrande: string | null;
  disponible: boolean;
  variantes: Opcion[];
  adicionales: Opcion[];
};
type Zona = { id: string; nombre: string; detalle: string; costo: number };
type Pago = { id: string; nombre: string; detalle: string };
type Datos = {
  slug: string;
  numeroWhatsapp: string;
  negocio: { nombreCorto: string; emojiMensaje?: string; horarios: Horarios };
  productos: Producto[];
  envio: { zonas: Zona[]; retiro: { habilitado: boolean; nombre: string }; pedidoMinimo: number };
  pagos: Pago[];
};
type Item = { productoId: string; varianteId: string | null; adicionales: string[]; cantidad: number };

// ---------- Utilidades ----------
const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) =>
  raiz.querySelector<T>(sel) as T;
const $$ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => [
  ...raiz.querySelectorAll<T>(sel),
];
const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pesosMensaje = (n: number) => '$' + new Intl.NumberFormat('es-AR').format(n);
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const vibrar = () => {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* no soportado */
  }
};
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const ICONO_MENOS =
  '<svg viewBox="0 0 256 256" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z"/></svg>';
const ICONO_MAS =
  '<svg viewBox="0 0 256 256" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"/></svg>';
const ICONO_TACHO =
  '<svg viewBox="0 0 256 256" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192Z"/></svg>';
const ICONO_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const datos: Datos = JSON.parse($('#datos-takeaway').textContent || '{}');
const productos = new Map(datos.productos.map((p) => [p.id, p]));

// ---------- Persistencia ----------
const SUFIJO = document.documentElement.classList.contains('embebido') ? ':embed' : '';
const CLAVE_CARRITO = `demo:${datos.slug}${SUFIJO}:carrito`;
const CLAVE_CLIENTE = `demo:${datos.slug}${SUFIJO}:cliente`;

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: funciona igual mientras la página esté abierta */
  }
}
/** Descarta ítems que ya no existen o cambiaron en el JSON. */
function sanear(items: unknown): Item[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((i): Item[] => {
    const p = productos.get(i?.productoId);
    if (!p || !p.disponible) return [];
    const varianteId = p.variantes.some((v) => v.id === i.varianteId) ? i.varianteId : (p.variantes[0]?.id ?? null);
    const adicionales = Array.isArray(i.adicionales)
      ? i.adicionales.filter((a: string) => p.adicionales.some((x) => x.id === a))
      : [];
    const cantidad = Math.min(99, Math.max(1, Math.floor(Number(i.cantidad) || 1)));
    return [{ productoId: p.id, varianteId, adicionales, cantidad }];
  });
}
let carrito: Item[] = sanear(leer(CLAVE_CARRITO, []));
const guardarCarrito = () => guardar(CLAVE_CARRITO, carrito);

// ---------- Cálculos ----------
function precioUnitario(item: Pick<Item, 'productoId' | 'varianteId' | 'adicionales'>): number {
  const p = productos.get(item.productoId)!;
  const base = p.variantes.find((v) => v.id === item.varianteId)?.precio ?? p.precio;
  return base + item.adicionales.reduce((s, id) => s + (p.adicionales.find((a) => a.id === id)?.precio ?? 0), 0);
}
const subtotal = () => carrito.reduce((s, i) => s + precioUnitario(i) * i.cantidad, 0);
const unidades = () => carrito.reduce((s, i) => s + i.cantidad, 0);
const claveItem = (i: Item) => `${i.productoId}|${i.varianteId}|${[...i.adicionales].sort().join(',')}`;
const esSimple = (p: Producto) => p.variantes.length <= 1 && p.adicionales.length === 0;

/** Igual que v1: "Muzzarella (Entera) + Extra muzzarella" */
function descripcionItem(i: Item): string {
  const p = productos.get(i.productoId)!;
  const v = p.variantes.find((x) => x.id === i.varianteId);
  const ads = i.adicionales.map((id) => p.adicionales.find((a) => a.id === id)!.nombre);
  return `${p.nombre}${v && p.variantes.length > 1 ? ` (${v.nombre})` : ''}${ads.length ? ' + ' + ads.join(' + ') : ''}`;
}
function detalleItem(i: Item): string {
  const p = productos.get(i.productoId)!;
  const v = p.variantes.length > 1 ? p.variantes.find((x) => x.id === i.varianteId)?.nombre : null;
  const ads = i.adicionales.map((id) => p.adicionales.find((a) => a.id === id)?.nombre);
  return [v, ...ads].filter(Boolean).join(' + ');
}

// ---------- Microinteracciones ----------
/** Número tipo odómetro: el viejo sale hacia arriba y el nuevo entra desde abajo. */
function odometro(el: HTMLElement, n: number) {
  const actualSpan = el.querySelector('span');
  if (actualSpan?.textContent === String(n)) return;
  const sube = !actualSpan || n > Number(actualSpan.textContent);
  const nuevo = document.createElement('span');
  nuevo.textContent = String(n);
  if (!actualSpan || sinMovimiento()) {
    el.replaceChildren(nuevo);
    return;
  }
  nuevo.style.position = 'absolute';
  nuevo.style.inset = '0';
  el.append(nuevo);
  const d = sube ? 1 : -1;
  const opciones = { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
  actualSpan.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-100 * d}%)`, opacity: 0 }], opciones);
  nuevo
    .animate([{ transform: `translateY(${100 * d}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], opciones)
    .finished.then(() => {
      nuevo.style.position = '';
      nuevo.style.inset = '';
      el.replaceChildren(nuevo);
    });
}

const valoresAnimados = new WeakMap<HTMLElement, number>();
/** Montos que se interpolan en 250ms (con tabular-nums no "bailan"). */
function animarMonto(el: HTMLElement, hasta: number) {
  const desde = valoresAnimados.get(el) ?? hasta;
  valoresAnimados.set(el, hasta);
  if (desde === hasta || sinMovimiento()) {
    el.textContent = formatearARS(hasta);
    return;
  }
  const inicio = performance.now();
  const paso = (t: number) => {
    const k = Math.min(1, (t - inicio) / 250);
    const e = 1 - (1 - k) ** 3;
    el.textContent = formatearARS(Math.round(desde + (hasta - desde) * e));
    if (k < 1 && valoresAnimados.get(el) === hasta) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// Toast con "Deshacer"
const toast = $('[data-toast]');
const toastTexto = $('[data-toast-texto]', toast);
const toastDeshacer = $<HTMLButtonElement>('[data-toast-deshacer]', toast);
let toastTimer: number | undefined;
let deshacer: (() => void) | null = null;
function avisar(texto: string, alDeshacer?: () => void) {
  toastTexto.textContent = texto;
  deshacer = alDeshacer ?? null;
  toastDeshacer.hidden = !alDeshacer;
  toast.classList.add('visible');
  document.documentElement.classList.add('con-toast');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(ocultarToast, 3000);
}
function ocultarToast() {
  toast.classList.remove('visible');
  document.documentElement.classList.remove('con-toast');
}
toastDeshacer.addEventListener('click', () => {
  deshacer?.();
  deshacer = null;
  ocultarToast();
});

/** La foto "vuela" en arco hacia el carrito. */
function volar(img: HTMLImageElement | null) {
  const pildoraEl = $('[data-abrir-carrito]');
  const icono = $('.d-carrito-icono', pildoraEl);
  if (!img || !img.complete || sinMovimiento()) return;
  const r = img.getBoundingClientRect();
  if (!r.width) return;
  // Posición final sin el translate de entrada (offset* ignora transforms)
  const destX = pildoraEl.offsetLeft + icono.offsetLeft + icono.offsetWidth / 2;
  const destY = pildoraEl.offsetTop + icono.offsetTop + icono.offsetHeight / 2;
  const dx = destX - (r.left + r.width / 2);
  const dy = destY - (r.top + r.height / 2);
  const clon = img.cloneNode() as HTMLImageElement;
  Object.assign(clon.style, {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: '0',
    borderRadius: '16px',
    objectFit: 'cover',
    opacity: '1',
    zIndex: '70',
    pointerEvents: 'none',
  });
  document.body.append(clon);
  clon
    .animate(
      [
        { transform: 'translate(0, 0) scale(1)' },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(0.55)`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.5 },
      ],
      { duration: 320, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
    )
    .finished.then(() => clon.remove());
}

// ---------- Fotos: esqueleto hasta que cargan ----------
function marcarFotos(raiz: ParentNode = document) {
  $$<HTMLElement>('.d-foto', raiz).forEach((caja) => {
    const img = caja.querySelector('img');
    if (!img || !img.getAttribute('src')) return;
    const listo = () => caja.classList.add('cargada');
    if (img.complete && img.naturalWidth) listo();
    else img.addEventListener('load', listo, { once: true });
  });
}

// ---------- Estado del local ----------
function pintarEstado() {
  const estado = estadoLocal(datos.negocio.horarios);
  const chip = $('[data-estado]');
  chip.dataset.abierto = String(estado.abierto);
  $('[data-estado-texto]', chip).textContent = estado.abierto ? 'Abierto' : 'Cerrado';
  chip.title = estado.texto;
  const aviso = $('[data-aviso-cerrado]');
  aviso.hidden = estado.abierto;
  aviso.textContent = estado.abierto
    ? ''
    : `El local está cerrado (${estado.texto.replace('Cerrado · ', '')}). Podés dejar tu pedido y te lo confirman cuando abra.`;
}

// ---------- Segmentado claro (role=radiogroup) ----------
function iniciarSeg(grupo: HTMLElement, alCambiar: (valor: string) => void) {
  const botones = $$<HTMLButtonElement>('[role="radio"]', grupo);
  grupo.style.setProperty('--n', String(botones.length));
  const elegir = (i: number, enfocar = false) => {
    grupo.style.setProperty('--i', String(i));
    botones.forEach((b, j) => {
      b.setAttribute('aria-checked', String(i === j));
      b.tabIndex = i === j ? 0 : -1;
    });
    if (enfocar) botones[i].focus();
    alCambiar(botones[i].dataset.valor!);
  };
  const inicial = Math.max(0, botones.findIndex((b) => b.getAttribute('aria-checked') === 'true'));
  grupo.style.setProperty('--i', String(inicial));
  botones.forEach((b, i) => {
    b.tabIndex = i === inicial ? 0 : -1;
    b.addEventListener('click', () => elegir(i));
  });
  grupo.addEventListener('keydown', (e) => {
    const act = botones.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    elegir((act + d + botones.length) % botones.length, true);
  });
  return (valorElegido: string) => {
    const i = botones.findIndex((b) => b.dataset.valor === valorElegido);
    if (i >= 0) elegir(i);
  };
}

// ---------- Carrito: agregar ----------
function agregar(item: Item, imgOrigen: HTMLImageElement | null) {
  const p = productos.get(item.productoId)!;
  const antes = carrito.map((i) => ({ ...i, adicionales: [...i.adicionales] }));
  const existente = carrito.find((i) => claveItem(i) === claveItem(item));
  if (existente) existente.cantidad = Math.min(99, existente.cantidad + item.cantidad);
  else carrito.push(item);
  guardarCarrito();
  track('demo_add_to_cart', { producto: p.id });
  vibrar();
  pintarPildora(true);
  volar(imgOrigen);
  avisar(`Agregado · ${p.nombre}`, () => {
    carrito = antes;
    guardarCarrito();
    pintarPildora();
  });
}

// ---------- Hoja de producto ----------
const hojaProducto = $<HTMLDialogElement>('#hoja-producto');
const hpForm = $<HTMLFormElement>('[data-hp-form]', hojaProducto);
const hpOpciones = $('[data-hp-opciones]', hojaProducto);
const hpCantidad = $('[data-hp-cantidad]', hojaProducto);
const hpAgregar = $('[data-hp-agregar]', hojaProducto);
const hpImg = $<HTMLImageElement>('[data-hp-img]', hojaProducto);
let actual: { producto: Producto; cantidad: number } | null = null;

function seleccionHoja(): Item | null {
  if (!actual) return null;
  const fd = new FormData(hpForm);
  return {
    productoId: actual.producto.id,
    varianteId: (fd.get('variante') as string) ?? actual.producto.variantes[0]?.id ?? null,
    adicionales: fd.getAll('adicional') as string[],
    cantidad: actual.cantidad,
  };
}
function actualizarHoja() {
  const sel = seleccionHoja();
  if (!sel) return;
  odometro(hpCantidad, sel.cantidad);
  hpAgregar.textContent = `Agregar · ${formatearARS(precioUnitario(sel) * sel.cantidad)}`;
}

function abrirProducto(id: string) {
  const p = productos.get(id);
  if (!p || !p.disponible) return;
  actual = { producto: p, cantidad: 1 };
  $('[data-hp-titulo]', hojaProducto).textContent = p.nombre;
  $('[data-hp-desc]', hojaProducto).textContent = p.descripcion;
  $('[data-hp-foto]', hojaProducto).classList.remove('cargada');
  if (p.imgGrande) hpImg.src = p.imgGrande;
  else hpImg.removeAttribute('src');
  marcarFotos(hojaProducto);

  let html = '';
  if (p.variantes.length > 1) {
    html += `<div class="d-bloque"><p class="d-bloque-titulo" id="hp-var">Elegí una opción</p>
      <div class="d-seg" role="radiogroup" aria-labelledby="hp-var" data-hp-seg>
        <span class="d-seg-indicador" aria-hidden="true"></span>
        ${p.variantes
          .map(
            (v, i) =>
              `<button type="button" role="radio" aria-checked="${i === 0}" data-valor="${escapar(v.id)}">${escapar(v.nombre)}</button>`,
          )
          .join('')}
      </div>
      <input type="hidden" name="variante" value="${escapar(p.variantes[0].id)}">
      <p class="mt-2 text-sm tabular-nums" style="color:var(--tinta-2)" data-hp-var-precio></p></div>`;
  } else if (p.variantes.length === 1) {
    html += `<input type="hidden" name="variante" value="${escapar(p.variantes[0].id)}">`;
  }
  if (p.adicionales.length) {
    html += `<div class="d-bloque"><p class="d-bloque-titulo">Adicionales <span class="text-sm font-normal" style="color:var(--tinta-2)">opcional</span></p>
      ${p.adicionales
        .map(
          (a) => `<label class="d-fila-check">
            <input type="checkbox" name="adicional" value="${escapar(a.id)}">
            <span class="d-check">${ICONO_CHECK}</span>
            <span class="flex-1 text-[15px]">${escapar(a.nombre)}</span>
            <span class="text-[15px] tabular-nums" style="color:var(--tinta-2)">+ ${formatearARS(a.precio)}</span>
          </label>`,
        )
        .join('')}</div>`;
  }
  hpOpciones.innerHTML = html;
  const seg = $('[data-hp-seg]', hpOpciones);
  if (seg) {
    const precioVar = $('[data-hp-var-precio]', hpOpciones);
    const pintarVar = (v: string) => {
      ($('input[name="variante"]', hpOpciones) as HTMLInputElement).value = v;
      const variante = p.variantes.find((x) => x.id === v)!;
      precioVar.textContent = `${variante.nombre}: ${formatearARS(variante.precio)}`;
      actualizarHoja();
    };
    iniciarSeg(seg, pintarVar);
    pintarVar(p.variantes[0].id);
  }
  hpCantidad.replaceChildren(Object.assign(document.createElement('span'), { textContent: '1' }));
  actualizarHoja();
  $('.d-hoja-cuerpo', hojaProducto).scrollTop = 0;
  abrirHoja(hojaProducto);
}

hojaProducto.addEventListener('change', actualizarHoja);
$('[data-hp-menos]', hojaProducto).addEventListener('click', () => {
  if (actual && actual.cantidad > 1) actual.cantidad--;
  actualizarHoja();
});
$('[data-hp-mas]', hojaProducto).addEventListener('click', () => {
  if (actual && actual.cantidad < 99) actual.cantidad++;
  actualizarHoja();
});
hpForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const sel = seleccionHoja();
  if (!sel) return;
  // La foto de la fila del menú es el origen del vuelo (la hoja se está cerrando)
  const origen = $<HTMLImageElement>(`[data-cat-seccion] [data-item="${sel.productoId}"] .d-foto img`);
  cerrarHoja(hojaProducto);
  setTimeout(() => agregar(sel, origen), sinMovimiento() ? 0 : 200);
});

// Abrir producto (fila o tarjeta) y "+" rápido
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const abrir = t.closest<HTMLElement>('[data-producto]');
  if (abrir) return abrirProducto(abrir.dataset.producto!);
  const mas = t.closest<HTMLElement>('[data-mas]');
  if (!mas) return;
  const p = productos.get(mas.dataset.mas!);
  if (!p) return;
  if (!esSimple(p)) return abrirProducto(p.id);
  const img = mas.closest('[data-item]')?.querySelector<HTMLImageElement>('.d-foto img') ?? null;
  agregar({ productoId: p.id, varianteId: p.variantes[0]?.id ?? null, adicionales: [], cantidad: 1 }, img);
});

// ---------- Píldora del carrito ----------
const pildora = $<HTMLButtonElement>('[data-abrir-carrito]');
const badge = $('[data-carrito-cantidad]', pildora);
function pintarPildora(rebote = false) {
  const n = unidades();
  const visible = n > 0;
  pildora.classList.toggle('visible', visible);
  pildora.toggleAttribute('inert', !visible);
  document.documentElement.classList.toggle('con-carrito', visible);
  badge.textContent = String(n);
  $('[data-carrito-texto]', pildora).textContent = `${n} ${n === 1 ? 'producto' : 'productos'} · Ver pedido`;
  pildora.setAttribute('aria-label', `Ver pedido: ${n} ${n === 1 ? 'producto' : 'productos'}, ${formatearARS(subtotal())}`);
  animarMonto($('[data-carrito-total]', pildora), subtotal());
  if (rebote && !sinMovimiento()) {
    badge.classList.remove('rebote');
    void badge.offsetWidth;
    badge.classList.add('rebote');
  }
}

// ---------- Checkout ----------
const hojaCarrito = $<HTMLDialogElement>('#hoja-carrito');
const form = $<HTMLFormElement>('[data-checkout]', hojaCarrito);
const lista = $('[data-lista]', hojaCarrito);

function valor(nombre: string): string {
  const el = form.elements.namedItem(nombre) as HTMLInputElement | RadioNodeList | null;
  return (el?.value ?? '').trim();
}
const esEnvio = () => valor('entrega') === 'envio';
const zonaElegida = () => datos.envio.zonas.find((z) => z.id === valor('zona'));
const costoEnvio = () => (esEnvio() ? (zonaElegida()?.costo ?? 0) : 0);

// Reglas de validación (amables). Se usan al enviar y para limpiar errores en vivo.
const reglas: Record<string, () => string | null> = {
  zona: () => (!esEnvio() || zonaElegida() ? null : 'Elegí tu zona para calcular el envío.'),
  pago: () => (valor('pago') ? null : 'Elegí cómo vas a pagar.'),
  nombre: () => (valor('nombre').length >= 2 ? null : 'Contanos tu nombre así sabemos de quién es el pedido.'),
  celular: () => {
    const largo = valor('celular').replace(/\D/g, '').length;
    return largo >= 8 && largo <= 15 ? null : 'Dejanos un celular válido con código de área.';
  },
  direccion: () => (!esEnvio() || valor('direccion').length >= 4 ? null : '¿A qué dirección te lo llevamos?'),
};

function pintarLista() {
  lista.innerHTML = carrito
    .map((i, idx) => {
      const p = productos.get(i.productoId)!;
      const det = detalleItem(i);
      return `<li class="d-linea" data-linea="${idx}">
        <div class="min-w-0 flex-1">
          <p class="text-[15px] font-medium">${escapar(p.nombre)}</p>
          ${det ? `<p class="text-[13px]" style="color:var(--tinta-2)">${escapar(det)}</p>` : ''}
          <p class="mt-1 text-[15px] tabular-nums" data-linea-precio>${formatearARS(precioUnitario(i) * i.cantidad)}</p>
        </div>
        <div class="d-stepper chico" role="group" aria-label="Cantidad de ${escapar(p.nombre)}">
          <button type="button" data-accion="menos" aria-label="${i.cantidad === 1 ? 'Quitar' : 'Uno menos de'} ${escapar(p.nombre)}">${i.cantidad === 1 ? ICONO_TACHO : ICONO_MENOS}</button>
          <span class="d-num" aria-live="polite"><span>${i.cantidad}</span></span>
          <button type="button" data-accion="mas" aria-label="Uno más de ${escapar(p.nombre)}">${ICONO_MAS}</button>
        </div>
      </li>`;
    })
    .join('');
  $('[data-vacio]', hojaCarrito).hidden = carrito.length > 0;
}

function pintarTotales() {
  const sub = subtotal();
  animarMonto($('[data-subtotal]', hojaCarrito), sub);
  $('[data-fila-envio]', hojaCarrito).hidden = !esEnvio();
  const celdaEnvio = $('[data-envio]', hojaCarrito);
  if (zonaElegida()) animarMonto(celdaEnvio, costoEnvio());
  else {
    valoresAnimados.delete(celdaEnvio);
    celdaEnvio.textContent = 'Elegí tu zona';
  }
  animarMonto($('[data-total]', hojaCarrito), sub + costoEnvio());

  const minimo = datos.envio.pedidoMinimo;
  const falta = minimo - sub;
  $('[data-minimo]', hojaCarrito).hidden = falta <= 0 || carrito.length === 0;
  $('[data-minimo-texto]', hojaCarrito).textContent = `Te faltan ${formatearARS(falta)} para el mínimo`;
  $('[data-minimo-barra]', hojaCarrito).style.width = `${Math.min(100, (sub / minimo) * 100)}%`;
  $<HTMLButtonElement>('[data-enviar]', hojaCarrito).disabled = carrito.length === 0;
}

lista.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-accion]');
  if (!b) return;
  const fila = b.closest<HTMLElement>('[data-linea]')!;
  const idx = Number(fila.dataset.linea);
  const item = carrito[idx];
  if (!item) return;
  if (b.dataset.accion === 'mas') item.cantidad = Math.min(99, item.cantidad + 1);
  else if (item.cantidad > 1) item.cantidad--;
  else carrito.splice(idx, 1);
  guardarCarrito();
  vibrar();
  if (carrito.includes(item)) {
    // Actualización en el lugar: número tipo odómetro y precio de la línea
    odometro($('.d-num', fila), item.cantidad);
    $('[data-linea-precio]', fila).textContent = formatearARS(precioUnitario(item) * item.cantidad);
    const menos = $('[data-accion="menos"]', fila);
    const nombre = productos.get(item.productoId)!.nombre;
    menos.innerHTML = item.cantidad === 1 ? ICONO_TACHO : ICONO_MENOS;
    menos.setAttribute('aria-label', `${item.cantidad === 1 ? 'Quitar' : 'Uno menos de'} ${nombre}`);
  } else {
    pintarLista();
    ($$<HTMLButtonElement>('[data-accion]', lista)[0] ?? $('[data-cerrar]', hojaCarrito)).focus();
  }
  pintarTotales();
  pintarPildora();
});

// Entrega: segmentado Envío / Retiro
const inputEntrega = form.elements.namedItem('entrega') as HTMLInputElement;
function sincronizarEntrega() {
  const envio = esEnvio();
  $('[data-grupo-envio]', hojaCarrito).hidden = !envio;
  const retiro = hojaCarrito.querySelector<HTMLElement>('[data-grupo-retiro]');
  if (retiro) retiro.hidden = envio;
  $('[data-campo-direccion]', hojaCarrito).hidden = !envio;
  for (const c of ['zona', 'direccion']) if (!$(`#err-${c}`, hojaCarrito).hidden) marcarError(c, reglas[c]());
  pintarTotales();
}
const segEntrega = hojaCarrito.querySelector<HTMLElement>('[data-seg-entrega]');
const elegirEntrega = segEntrega
  ? iniciarSeg(segEntrega, (v) => {
      inputEntrega.value = v;
      sincronizarEntrega();
      guardarCliente();
    })
  : null;

// Datos del cliente guardados para la próxima
function guardarCliente() {
  guardar(CLAVE_CLIENTE, {
    nombre: valor('nombre'),
    entrega: valor('entrega'),
    direccion: valor('direccion'),
    zona: valor('zona'),
    pago: valor('pago'),
  });
}
const cliente = leer<Record<string, string>>(CLAVE_CLIENTE, {});
for (const [k, v] of Object.entries(cliente)) {
  if (k === 'entrega') {
    if (v === 'retiro' && elegirEntrega) elegirEntrega('retiro');
    continue;
  }
  const el = form.elements.namedItem(k);
  if (el instanceof RadioNodeList) {
    const radio = [...el].find((r) => (r as HTMLInputElement).value === v) as HTMLInputElement | undefined;
    if (radio) radio.checked = true;
  } else if (el instanceof HTMLInputElement) el.value = v;
}
form.addEventListener('change', () => {
  pintarTotales();
  guardarCliente();
});
sincronizarEntrega();

// ---------- Validación ----------
function marcarError(campo: string, mensaje: string | null): boolean {
  const err = $(`#err-${campo}`, hojaCarrito);
  err.textContent = mensaje ?? '';
  err.hidden = !mensaje;
  const el = form.elements.namedItem(campo);
  if (el instanceof HTMLInputElement) el.setAttribute('aria-invalid', String(!!mensaje));
  return !mensaje;
}
function validar(): HTMLElement | null {
  let primero: HTMLElement | null = null;
  for (const [campo, regla] of Object.entries(reglas)) {
    if (!marcarError(campo, regla()) && !primero) {
      const el = form.elements.namedItem(campo);
      primero = (el instanceof RadioNodeList ? el[0] : el) as HTMLElement;
    }
  }
  return primero;
}
// Un error mostrado se limpia apenas el campo queda bien (no se valida antes de tiempo)
const revalidar = (e: Event) => {
  const nombre = (e.target as HTMLInputElement).name;
  const regla = reglas[nombre];
  if (regla && !$(`#err-${nombre}`, hojaCarrito).hidden) marcarError(nombre, regla());
};
form.addEventListener('input', revalidar);
form.addEventListener('change', revalidar);

// ---------- Mensaje (mismo formato que v1) ----------
function armarMensaje(): string {
  const pago = datos.pagos.find((p) => p.id === valor('pago'))!;
  const zona = zonaElegida();
  const entrega = esEnvio() ? `Envío – ${zona?.nombre} – ${valor('direccion')}` : datos.envio.retiro.nombre;
  const sub = subtotal();
  const lineas = [
    `${datos.negocio.emojiMensaje ?? '🛍️'} *Nuevo pedido – ${datos.negocio.nombreCorto}*`,
    `👤 Nombre: ${valor('nombre')} · 📱 ${valor('celular')}`,
    `🛵 Entrega: ${entrega}`,
    `💳 Pago: ${pago.nombre}`,
    '',
    ...carrito.map((i) => `• ${i.cantidad}x ${descripcionItem(i)} — ${pesosMensaje(precioUnitario(i) * i.cantidad)}`),
    '',
    `Subtotal: ${pesosMensaje(sub)}`,
    ...(esEnvio() ? [`Envío: ${pesosMensaje(costoEnvio())}`] : []),
    `*TOTAL: ${pesosMensaje(sub + costoEnvio())}*`,
  ];
  const comentario = valor('comentario');
  if (comentario) lineas.push('', `📝 Comentario: ${comentario}`);
  return lineas.join('\n');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (carrito.length === 0) return;
  if (datos.envio.pedidoMinimo - subtotal() > 0) {
    if (!sinMovimiento())
      $('[data-minimo]', hojaCarrito).animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 300 },
      );
    return;
  }
  const primero = validar();
  if (primero) {
    primero.focus();
    primero.scrollIntoView({ block: 'center', behavior: sinMovimiento() ? 'auto' : 'smooth' });
    return;
  }

  const total = subtotal() + costoEnvio();
  const mensaje = armarMensaje();
  try {
    almacenamientoPedidos.actualizar((pedidos) => [
      ...pedidos,
      {
        id: nuevoIdDemo(),
        creadoEn: new Date().toISOString(),
        nombre: valor('nombre'),
        celular: valor('celular'),
        entrega: esEnvio() ? `Envío · ${zonaElegida()!.nombre} · ${valor('direccion')}` : datos.envio.retiro.nombre,
        pago: datos.pagos.find((p) => p.id === valor('pago'))!.nombre,
        items: carrito.map((item) => `${item.cantidad} × ${descripcionItem(item)}`),
        subtotal: subtotal(),
        envio: costoEnvio(),
        total,
        comentario: valor('comentario'),
        estado: 'pendiente',
      },
    ]);
  } catch (error) {
    console.error('No se pudo guardar el pedido en este navegador.', error);
    window.alert('No se pudo guardar el pedido en el panel de demostración. Podés continuar por WhatsApp.');
  }
  track('demo_order_whatsapp', { total });
  abrirWhatsapp(mensaje, `demo_${datos.slug}_pedido`, {}, datos.numeroWhatsapp);
  vibrar();

  // Pantalla de éxito
  const nombre = valor('nombre').split(' ')[0];
  $('[data-exito-titulo]', hojaCarrito).textContent = `Listo, ${nombre}`;
  $('[data-exito-resumen]', hojaCarrito).innerHTML = `
    <div class="flex justify-between text-[15px]"><span style="color:var(--tinta-2)">Productos</span><span>${unidades()}</span></div>
    <div class="mt-1 flex justify-between text-[15px]"><span style="color:var(--tinta-2)">Entrega</span><span>${
      esEnvio() ? `Envío · ${escapar(zonaElegida()!.nombre)}` : escapar(datos.envio.retiro.nombre)
    }</span></div>
    <div class="mt-1 flex justify-between text-[17px] font-semibold"><span>Total</span><span class="tabular-nums">${formatearARS(total)}</span></div>`;
  $<HTMLAnchorElement>('[data-exito-whatsapp]', hojaCarrito).href = linkWhatsapp(mensaje, datos.numeroWhatsapp);
  form.hidden = true;
  $('.d-hoja-cabecera h2', hojaCarrito).textContent = 'Pedido enviado';
  $('[data-exito]', hojaCarrito).hidden = false;
  $('[data-exito-titulo]', hojaCarrito).focus();

  carrito = [];
  guardarCarrito();
  (form.elements.namedItem('comentario') as HTMLInputElement).value = '';
  pintarPildora();
});

function abrirCarrito() {
  form.hidden = false;
  $('[data-exito]', hojaCarrito).hidden = true;
  $('.d-hoja-cabecera h2', hojaCarrito).textContent = 'Tu pedido';
  pintarLista();
  pintarTotales();
  abrirHoja(hojaCarrito);
}
pildora.addEventListener('click', abrirCarrito);

// ---------- Buscador ----------
const buscador = $<HTMLInputElement>('[data-buscador]');
const sinResultados = $('[data-sin-resultados]');
buscador.addEventListener('input', () => {
  const q = normalizar(buscador.value.trim());
  let total = 0;
  $$<HTMLElement>('[data-cat-seccion]').forEach((sec) => {
    let visibles = 0;
    $$<HTMLElement>('[data-item]', sec).forEach((li) => {
      const p = productos.get(li.dataset.item!)!;
      const ok = !q || normalizar(`${p.nombre} ${p.descripcion}`).includes(q);
      li.hidden = !ok;
      if (ok) visibles++;
    });
    sec.hidden = visibles === 0;
    total += visibles;
  });
  $('[data-mas-pedidos]').hidden = !!q;
  sinResultados.hidden = total > 0;
  $('[data-sin-resultados-q]', sinResultados).textContent = buscador.value.trim();
});

// ---------- Chips de categorías: scroll-spy ----------
// Activa la última categoría cuyo título ya pasó debajo de la barra de chips.
// Arriba de todo (antes de la primera categoría) queda activa la primera.
const chips = $$<HTMLAnchorElement>('[data-chip]');
const secciones = $$<HTMLElement>('[data-cat-seccion]');
if (chips.length && secciones.length) {
  const barra = chips[0].closest<HTMLElement>('[data-chips]')!;
  let activaId = '';
  let pendiente = false;
  const actualizar = () => {
    pendiente = false;
    const visibles = secciones.filter((s) => !s.hidden);
    let id = visibles[0]?.id ?? '';
    for (const s of visibles) if (s.getBoundingClientRect().top <= 140) id = s.id;
    if (id === activaId) return;
    activaId = id;
    chips.forEach((c) => {
      const activa = c.hash === `#${id}`;
      c.classList.toggle('activo', activa);
      if (activa) {
        c.setAttribute('aria-current', 'true');
        barra.scrollTo({
          left: c.offsetLeft - barra.clientWidth / 2 + c.offsetWidth / 2,
          behavior: sinMovimiento() ? 'auto' : 'smooth',
        });
      } else c.removeAttribute('aria-current');
    });
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!pendiente) {
        pendiente = true;
        requestAnimationFrame(actualizar);
      }
    },
    { passive: true },
  );
  buscador.addEventListener('input', () => requestAnimationFrame(actualizar));
  actualizar();
}

// ---------- Inicio ----------
iniciarHojas();
marcarFotos();
pintarEstado();
pintarPildora();
