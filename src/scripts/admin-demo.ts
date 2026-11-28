// Panel de gestión de las demos (pedidos y turnos). Todo vive en localStorage del navegador.
import {
  almacenamientoDisponibilidad,
  almacenamientoPedidos,
  almacenamientoTurnos,
  nuevoIdDemo,
  type RegistroPedido,
  type RegistroTurno,
} from './persistencia-demo';
import { CLAVES_DIA, NOMBRES_DIA, estadoLocal, type Horarios } from './horarios';
import { formatearARS } from './formato';

// ---------- Datos del build ----------
type Opcion = { id: string; nombre: string; precio: number };
type Producto = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  disponible: boolean;
  variantes: Opcion[];
  adicionales: Opcion[];
  foto: string | null;
};
type Datos = {
  pizzeria: {
    negocio: {
      nombre: string;
      nombreCorto: string;
      logoTexto: string;
      direccion: string;
      whatsapp: string;
      instagram: string;
      tiempoEntrega: string;
      horarios: Horarios;
    };
    categorias: { id: string; nombre: string }[];
    masPedidos: string[];
    envio: {
      zonas: { id: string; nombre: string; detalle: string; costo: number }[];
      retiro: { habilitado: boolean; nombre: string };
      pedidoMinimo: number;
    };
    pagos: { id: string; nombre: string; detalle: string }[];
    productos: Producto[];
  };
  barberia: {
    negocio: { nombre: string; nombreCorto: string; logoTexto: string; direccion: string; whatsapp: string; instagram: string };
    servicios: { id: string; nombre: string; precio: number; duracion: number }[];
    profesionales: { id: string; nombre: string; foto: string | null; servicios: string[]; especialidad: string }[];
    cualquieraDisponible: { habilitado: boolean; nombre: string };
    horarios: Horarios;
    intervaloMinutos: number;
    diasCerrados: string[];
    sena: { activa: boolean; porcentaje: number; texto: string };
  };
};
type Negocio = 'pizzeria' | 'barberia';
type EstadoPedido = RegistroPedido['estado'];
type EstadoTurno = RegistroTurno['estado'];
type Tono = 'ambar' | 'azul' | 'viol' | 'rojo' | 'verde' | 'gris';

const D: Datos = JSON.parse(document.getElementById('datos-admin')?.textContent || '{}');
const P = D.pizzeria;
const B = D.barberia;

// ---------- Utilidades ----------
const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector) as T;
const escapar = (texto: unknown) =>
  String(texto ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const ars = formatearARS;
const dos = (n: number) => String(n).padStart(2, '0');
const claveFecha = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const desdeClave = (clave: string) => {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const ic = (nombre: string, clase = '') =>
  `<svg class="a-ic ${clase}" aria-hidden="true" focusable="false"><use href="#i-${nombre}"></use></svg>`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const codigo = (id: string) => id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase().padStart(4, '0');
const telefono = (celular: string) => celular.replace(/[^\d+]/g, '');

function hace(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Fecha no disponible';
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'Recién';
  if (min < 60) return `Hace ${min} min`;
  if (min < 1440) return `Hace ${Math.floor(min / 60)} h`;
  return new Date(t).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}
function fechaHora(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'Fecha no disponible'
    : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function etiquetaDia(clave: string) {
  const fecha = desdeClave(clave);
  if (Number.isNaN(fecha.getTime())) return { titulo: clave, extra: '' };
  const hoy = desdeClave(claveFecha(new Date()));
  const dif = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
  const texto = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const titulo = texto.charAt(0).toUpperCase() + texto.slice(1);
  return { titulo, extra: dif === 0 ? 'Hoy' : dif === 1 ? 'Mañana' : '' };
}

// ---------- Estados ----------
const ESTADOS_PEDIDO: Record<EstadoPedido, { texto: string; tono: Tono; icono: string }> = {
  pendiente: { texto: 'Pendiente', tono: 'ambar', icono: 'clock' },
  aceptado: { texto: 'Aceptado', tono: 'azul', icono: 'check' },
  preparacion: { texto: 'En preparación', tono: 'azul', icono: 'cooking-pot' },
  listo: { texto: 'Listo', tono: 'verde', icono: 'check-circle' },
  en_camino: { texto: 'En camino', tono: 'viol', icono: 'bicycle' },
  entregado: { texto: 'Entregado', tono: 'gris', icono: 'package' },
  cancelado: { texto: 'Cancelado', tono: 'rojo', icono: 'x' },
};
const ESTADOS_TURNO: Record<EstadoTurno, { texto: string; tono: Tono; icono: string }> = {
  pendiente: { texto: 'Pendiente', tono: 'ambar', icono: 'clock' },
  confirmado: { texto: 'Confirmado', tono: 'verde', icono: 'check-circle' },
  cancelado: { texto: 'Cancelado', tono: 'rojo', icono: 'x' },
};
const pill = (e: { texto: string; tono: Tono; icono: string }) =>
  `<span class="a-pill" data-tono="${e.tono}">${ic(e.icono)}${e.texto}</span>`;

const GRUPOS_PEDIDO: { id: string; texto: string; estados: EstadoPedido[] | null }[] = [
  { id: 'todos', texto: 'Todos', estados: null },
  { id: 'pendiente', texto: 'Pendientes', estados: ['pendiente'] },
  { id: 'curso', texto: 'En curso', estados: ['aceptado', 'preparacion', 'listo', 'en_camino'] },
  { id: 'entregado', texto: 'Entregados', estados: ['entregado'] },
  { id: 'cancelado', texto: 'Cancelados', estados: ['cancelado'] },
];
const GRUPOS_TURNO: { id: string; texto: string; estados: EstadoTurno[] | null }[] = [
  { id: 'todos', texto: 'Todos', estados: null },
  { id: 'pendiente', texto: 'Pendientes', estados: ['pendiente'] },
  { id: 'confirmado', texto: 'Confirmados', estados: ['confirmado'] },
  { id: 'cancelado', texto: 'Cancelados', estados: ['cancelado'] },
];

const esEnvio = (p: RegistroPedido) => p.entrega.startsWith('Envío');
function siguientePaso(p: RegistroPedido): { estado: EstadoPedido; texto: string; icono: string } | null {
  switch (p.estado) {
    case 'pendiente':
      return { estado: 'aceptado', texto: 'Aceptar pedido', icono: 'check' };
    case 'aceptado':
      return { estado: 'preparacion', texto: 'Pasar a preparación', icono: 'cooking-pot' };
    case 'preparacion':
      return { estado: 'listo', texto: 'Marcar como listo', icono: 'check-circle' };
    case 'listo':
      return esEnvio(p)
        ? { estado: 'en_camino', texto: 'Enviar con repartidor', icono: 'bicycle' }
        : { estado: 'entregado', texto: 'Entregado al cliente', icono: 'package' };
    case 'en_camino':
      return { estado: 'entregado', texto: 'Marcar como entregado', icono: 'package' };
    default:
      return null;
  }
}
const ICONO_PAGO: Record<string, string> = { mercadopago: 'device-mobile', efectivo: 'money', transferencia: 'bank' };
const iconoPago = (nombre: string) => ICONO_PAGO[P.pagos.find((p) => p.nombre === nombre)?.id ?? ''] ?? 'wallet';

// ---------- Secciones ----------
type Seccion = { id: string; titulo: string; icono: string };
const SECCIONES: Record<Negocio, Seccion[]> = {
  pizzeria: [
    { id: 'resumen', titulo: 'Resumen', icono: 'squares-four' },
    { id: 'pedidos', titulo: 'Pedidos', icono: 'receipt' },
    { id: 'productos', titulo: 'Productos', icono: 'pizza' },
    { id: 'configuracion', titulo: 'Configuración', icono: 'gear-six' },
  ],
  barberia: [
    { id: 'resumen', titulo: 'Resumen', icono: 'squares-four' },
    { id: 'turnos', titulo: 'Turnos', icono: 'calendar-check' },
    { id: 'servicios', titulo: 'Servicios', icono: 'scissors' },
    { id: 'equipo', titulo: 'Equipo', icono: 'users' },
    { id: 'configuracion', titulo: 'Configuración', icono: 'gear-six' },
  ],
};
const PUBLICA: Record<Negocio, string> = { pizzeria: '/demo/pizzeria', barberia: '/demo/barberia' };

const estado = {
  negocio: 'pizzeria' as Negocio,
  seccion: 'resumen',
  filtroPedidos: 'todos',
  filtroTurnos: 'todos',
  categoria: 'todas',
  abiertos: new Set<string>(),
};

const raiz = $('[data-adm]');
const lateral = $('[data-side]');
const principal = $('[data-main]');
const contenido = $('[data-contenido]');
const selector = $<HTMLSelectElement>('[data-selector]');
const botonAbrir = $<HTMLButtonElement>('[data-abrir-menu]');
const overlay = $('[data-overlay]');
const toast = $('[data-toast]');

// ---------- Aviso ----------
let temporizadorToast = 0;
function avisar(texto: string) {
  toast.textContent = texto;
  toast.dataset.visible = 'true';
  window.clearTimeout(temporizadorToast);
  temporizadorToast = window.setTimeout(() => (toast.dataset.visible = 'false'), 2800);
}

// ---------- Lectura ----------
const leerPedidos = () => almacenamientoPedidos.leer();
const leerTurnos = () => almacenamientoTurnos.leer();
const disponibilidad = () => almacenamientoDisponibilidad.leer();
const estaDisponible = (p: Producto, extra: Record<string, boolean>) => extra[p.id] ?? p.disponible;
const ordenarPedidos = (lista: RegistroPedido[]) => [...lista].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
const ordenarTurnos = (lista: RegistroTurno[]) =>
  [...lista].sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));

// ---------- Piezas visuales ----------
const estadistica = (icono: string, valor: string, titulo: string, nota = '', tono: Tono = 'verde') => `
  <div class="a-stat" data-tono="${tono}">
    <div class="a-stat-ico">${ic(icono)}</div>
    <strong>${valor}</strong>
    <span>${titulo}</span>
    ${nota ? `<small>${nota}</small>` : ''}
  </div>`;

const vacio = (icono: string, titulo: string, texto: string, acciones = '') => `
  <div class="a-vacio">
    ${ic(icono)}
    <strong>${titulo}</strong>
    <p>${texto}</p>
    ${acciones ? `<div class="a-acciones">${acciones}</div>` : ''}
  </div>`;

const chips = (items: { id: string; texto: string; n: number }[], activo: string, atributo: string) => `
  <div class="a-chips" role="group" aria-label="Filtrar">
    ${items
      .map(
        (i) =>
          `<button type="button" class="a-chip" ${atributo}="${i.id}" aria-pressed="${i.id === activo}">${i.texto} <em>${i.n}</em></button>`,
      )
      .join('')}
  </div>`;

const rapida = (icono: string, texto: string, ir: string, tono: Tono = 'verde') =>
  `<button type="button" class="a-rapida" data-ir="${ir}"><span class="a-stat-ico" data-tono="${tono}">${ic(icono)}</span>${texto}</button>`;

const barra = (texto: string, valor: number, total: number) => `
  <div class="a-barra">
    <div class="a-barra-cab"><span>${escapar(texto)}</span><span>${valor}</span></div>
    <div class="a-barra-pista"><i style="width:${total ? Math.round((valor / total) * 100) : 0}%"></i></div>
  </div>`;

function tablaHorarios(horarios: Horarios) {
  const hoy = new Date().getDay();
  return `<div class="a-tabla">${[1, 2, 3, 4, 5, 6, 0]
    .map((d) => {
      const f = horarios[CLAVES_DIA[d]];
      return `<div class="${d === hoy ? 'a-hoy' : ''}"><span>${NOMBRES_DIA[d]}${d === hoy ? ' · hoy' : ''}</span><span>${
        f ? `${f.abre} a ${f.cierra}` : 'Cerrado'
      }</span></div>`;
    })
    .join('')}</div>`;
}

// ---------- Pizzería: pedidos ----------
function tarjetaPedido(p: RegistroPedido) {
  const e = ESTADOS_PEDIDO[p.estado];
  const abierto = estado.abiertos.has(p.id);
  const envio = esEnvio(p);
  const paso = siguientePaso(p);
  const id = escapar(p.id);
  const items = p.items
    .map((texto) => {
      const m = /^(\d+) × (.*)$/.exec(texto);
      return `<li><span class="a-cant">${m ? `${m[1]}×` : '•'}</span><span>${escapar(m ? m[2] : texto)}</span></li>`;
    })
    .join('');

  return `<article class="a-ped" data-estado="${p.estado}">
    <button type="button" class="a-ped-cab" data-alternar="${id}" aria-expanded="${abierto}" aria-controls="det-${id}">
      <span class="a-ped-izq">
        <span class="a-fila"><span class="a-cod">#${codigo(p.id)}</span>${pill(e)}</span>
        <span class="a-ped-nombre">${ic('user')}${escapar(p.nombre)}</span>
        <span class="a-meta">
          <span>${ic('clock')}${hace(p.creadoEn)}</span>
          <span>${ic(envio ? 'truck' : 'storefront')}${envio ? 'Envío' : 'Retiro'}</span>
          <span>${ic(iconoPago(p.pago))}${escapar(p.pago)}</span>
        </span>
      </span>
      <span class="a-ped-der"><strong>${ars(p.total)}</strong>${ic('caret-down', 'a-caret')}</span>
    </button>
    <div class="a-det" id="det-${id}" ${abierto ? '' : 'hidden'}>
      <section>
        <h4>${ic('shopping-bag')}Productos (${p.items.length})</h4>
        <ul class="a-items">${items}</ul>
        <div class="a-totales">
          <div><span>Subtotal</span><span>${ars(p.subtotal)}</span></div>
          ${envio ? `<div><span>Envío</span><span>${ars(p.envio)}</span></div>` : ''}
          <div class="a-total"><span>Total</span><span>${ars(p.total)}</span></div>
        </div>
      </section>
      <div class="a-datos">
        <div class="a-dato"><h4>${ic(envio ? 'map-pin' : 'storefront')}${envio ? 'Envío' : 'Retiro'}</h4>${escapar(p.entrega)}</div>
        <div class="a-dato"><h4>${ic('phone')}Contacto</h4><a href="tel:${escapar(telefono(p.celular))}">${escapar(p.celular)}</a></div>
        <div class="a-dato"><h4>${ic('calendar')}Recibido</h4>${escapar(fechaHora(p.creadoEn))}</div>
        ${p.comentario ? `<div class="a-dato"><h4>${ic('chat-text')}Nota del cliente</h4>${escapar(p.comentario)}</div>` : ''}
      </div>
      <div class="a-acciones">
        ${paso ? `<button type="button" class="a-btn a-btn-principal" data-cambiar="pedido" data-id="${id}" data-nuevo="${paso.estado}">${ic(paso.icono)}${paso.texto}</button>` : ''}
        ${
          p.estado !== 'cancelado' && p.estado !== 'entregado'
            ? `<button type="button" class="a-btn a-btn-peligro" data-cambiar="pedido" data-id="${id}" data-nuevo="cancelado">${ic('x')}Cancelar</button>`
            : ''
        }
        <button type="button" class="a-btn" data-borrar="pedido" data-id="${id}" aria-label="Eliminar pedido">${ic('trash')}Eliminar</button>
      </div>
    </div>
  </article>`;
}

function vistaPedidos() {
  const todos = ordenarPedidos(leerPedidos());
  const grupo = GRUPOS_PEDIDO.find((g) => g.id === estado.filtroPedidos) ?? GRUPOS_PEDIDO[0];
  const lista = grupo.estados ? todos.filter((p) => grupo.estados!.includes(p.estado)) : todos;
  const vigentes = todos.filter((p) => p.estado !== 'cancelado');
  const enCurso = todos.filter((p) => GRUPOS_PEDIDO[2].estados!.includes(p.estado)).length;

  const acciones = `
    <button type="button" class="a-btn a-btn-chico" data-actualizar>${ic('arrow-clockwise')}Actualizar</button>
    ${
      todos.length
        ? `<button type="button" class="a-btn a-btn-chico" data-ejemplos="pedidos">${ic('sparkle')}Cargar ejemplos</button>
    <button type="button" class="a-btn a-btn-chico a-btn-peligro" data-vaciar="pedidos">${ic('trash')}Vaciar</button>`
        : ''
    }`;

  return `<div class="a-pila">
    <div class="a-grid-stats">
      ${estadistica('receipt', String(todos.length), 'Total de pedidos', '', 'verde')}
      ${estadistica('clock', String(todos.filter((p) => p.estado === 'pendiente').length), 'Pendientes', 'Esperan tu respuesta', 'ambar')}
      ${estadistica('cooking-pot', String(enCurso), 'En curso', 'Preparación y entrega', 'azul')}
      ${estadistica('currency-dollar', ars(vigentes.reduce((s, p) => s + p.total, 0)), 'Ventas', 'Sin contar cancelados', 'verde')}
    </div>
    ${chips(
      GRUPOS_PEDIDO.map((g) => ({ id: g.id, texto: g.texto, n: g.estados ? todos.filter((p) => g.estados!.includes(p.estado)).length : todos.length })),
      grupo.id,
      'data-filtro-pedidos',
    )}
    <div class="a-barra-herr"><p>${plural(lista.length, 'pedido', 'pedidos')}</p><div class="a-herr">${acciones}</div></div>
    ${
      lista.length
        ? `<div class="a-apilado">${lista.map(tarjetaPedido).join('')}</div>`
        : todos.length
          ? vacio('tray', 'No hay pedidos en este filtro', 'Probá con otro estado para ver el resto.')
          : vacio(
              'receipt',
              'Todavía no hay pedidos',
              'Hacé un pedido de prueba en la web pública o cargá ejemplos para ver cómo se ve el panel.',
              `<button type="button" class="a-btn a-btn-principal" data-ejemplos="pedidos">${ic('sparkle')}Cargar ejemplos</button><a class="a-btn" href="${PUBLICA.pizzeria}">Probar la web ${ic('arrow-up-right')}</a>`,
            )
    }
  </div>`;
}

// ---------- Pizzería: productos ----------
function tarjetaProducto(p: Producto, extra: Record<string, boolean>) {
  const disp = estaDisponible(p, extra);
  const precios = p.variantes.map((v) => v.precio);
  const desde = precios.length > 1 && Math.min(...precios) !== Math.max(...precios);
  const precio = ars(precios.length ? Math.min(...precios) : p.precio);
  const categoria = P.categorias.find((c) => c.id === p.categoria)?.nombre ?? p.categoria;
  return `<article class="a-prod" data-agotado="${!disp}">
    <div class="a-foto">${p.foto ? `<img src="${escapar(p.foto)}" alt="" loading="lazy" width="240" height="240" />` : ic('image')}</div>
    <div class="a-prod-txt">
      <h3>${escapar(p.nombre)}</h3>
      <p>${escapar(p.descripcion)}</p>
      <div class="a-prod-pie">
        <span class="a-importe">${desde ? 'Desde ' : ''}${precio}</span>
        <span class="a-etiqueta">${escapar(categoria)}</span>
        ${P.masPedidos.includes(p.id) ? `<span class="a-etiqueta">${ic('star')} Más pedido</span>` : ''}
        ${p.adicionales.length ? `<span class="a-etiqueta">${plural(p.adicionales.length, 'adicional', 'adicionales')}</span>` : ''}
      </div>
    </div>
    <button type="button" class="a-sw" role="switch" aria-checked="${disp}" data-disp="${escapar(p.id)}" aria-label="Disponible: ${escapar(p.nombre)}">
      <i aria-hidden="true"></i><span>${disp ? 'Disponible' : 'Agotado'}</span>
    </button>
  </article>`;
}

function vistaProductos() {
  const extra = disponibilidad();
  const lista = estado.categoria === 'todas' ? P.productos : P.productos.filter((p) => p.categoria === estado.categoria);
  const agotados = P.productos.filter((p) => !estaDisponible(p, extra)).length;
  return `<div class="a-pila">
    <div class="a-aviso">${ic('info')}<p>Activá o pausá cada producto con el interruptor. El cambio se guarda en este navegador; la web pública de la demo no lo toma.</p></div>
    <div class="a-grid-stats">
      ${estadistica('pizza', String(P.productos.length), 'Productos', plural(P.categorias.length, 'categoría', 'categorías'))}
      ${estadistica('check-circle', String(P.productos.length - agotados), 'Disponibles', 'Visibles en el menú')}
      ${estadistica('prohibit', String(agotados), 'Agotados', 'Pausados', agotados ? 'rojo' : 'gris')}
      ${estadistica('star', String(P.masPedidos.length), 'Más pedidos', 'Destacados en el menú', 'ambar')}
    </div>
    ${chips(
      [{ id: 'todas', texto: 'Todas', n: P.productos.length }, ...P.categorias.map((c) => ({ id: c.id, texto: c.nombre, n: P.productos.filter((p) => p.categoria === c.id).length }))],
      estado.categoria,
      'data-categoria',
    )}
    <div class="a-prods">${lista.map((p) => tarjetaProducto(p, extra)).join('')}</div>
  </div>`;
}

// ---------- Pizzería: resumen ----------
function vistaResumenPizzeria() {
  const todos = ordenarPedidos(leerPedidos());
  const extra = disponibilidad();
  const vigentes = todos.filter((p) => p.estado !== 'cancelado');
  const ventas = vigentes.reduce((s, p) => s + p.total, 0);
  const disponibles = P.productos.filter((p) => estaDisponible(p, extra)).length;
  const local = estadoLocal(P.negocio.horarios);
  const recientes = todos.slice(0, 5);

  return `<div class="a-pila">
    <div class="a-banner">
      <h2>¡Bienvenido de vuelta!</h2>
      <p>Resumen de ${escapar(P.negocio.nombreCorto)} · ${escapar(local.texto)}</p>
    </div>
    <div class="a-grid-stats">
      ${estadistica('receipt', String(todos.length), 'Pedidos', plural(todos.filter((p) => p.estado === 'pendiente').length, 'pendiente', 'pendientes'))}
      ${estadistica('currency-dollar', ars(ventas), 'Ventas', 'Sin contar cancelados')}
      ${estadistica('tag', ars(vigentes.length ? Math.round(ventas / vigentes.length) : 0), 'Ticket promedio', '', 'ambar')}
      ${estadistica('pizza', `${disponibles}/${P.productos.length}`, 'Productos activos', plural(P.categorias.length, 'categoría', 'categorías'), 'azul')}
    </div>
    <div class="a-cols">
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Pedidos recientes</h3><p>Los últimos que llegaron</p></div></div>
        ${
          recientes.length
            ? `<div class="a-lista-simple">${recientes
                .map(
                  (p) => `<button type="button" class="a-fila-simple" data-ver-pedido="${escapar(p.id)}">
                    <div><strong>${escapar(p.nombre)}</strong><small>${hace(p.creadoEn)} · ${esEnvio(p) ? 'Envío' : 'Retiro'}</small></div>
                    ${pill(ESTADOS_PEDIDO[p.estado])}<span class="a-importe">${ars(p.total)}</span>
                  </button>`,
                )
                .join('')}</div>`
            : `<div class="a-bloque-cuerpo">${vacio('receipt', 'Sin pedidos todavía', 'Cuando lleguen, los vas a ver acá.', `<button type="button" class="a-btn a-btn-principal" data-ejemplos="pedidos">${ic('sparkle')}Cargar ejemplos</button>`)}</div>`
        }
      </section>
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Productos por categoría</h3><p>Cómo está armado el menú</p></div></div>
        <div class="a-bloque-cuerpo">${P.categorias.map((c) => barra(c.nombre, P.productos.filter((p) => p.categoria === c.id).length, P.productos.length)).join('')}</div>
      </section>
    </div>
    <section>
      <h3 class="a-dia">Acciones rápidas</h3>
      <div class="a-acciones-rapidas">
        ${rapida('receipt', 'Ver pedidos', 'pedidos')}
        ${rapida('pizza', 'Productos', 'productos', 'ambar')}
        ${rapida('gear-six', 'Configuración', 'configuracion', 'azul')}
        <a class="a-rapida" href="${PUBLICA.pizzeria}"><span class="a-stat-ico" data-tono="viol">${ic('eye')}</span>Ver web pública</a>
      </div>
    </section>
  </div>`;
}

// ---------- Pizzería: configuración ----------
function vistaConfigPizzeria() {
  const local = estadoLocal(P.negocio.horarios);
  return `<div class="a-cols">
    <section class="a-bloque">
      <div class="a-bloque-cab"><div><h3>Horarios de atención</h3><p>${escapar(local.texto)}</p></div><span class="a-pill" data-tono="${local.abierto ? 'verde' : 'gris'}">${local.abierto ? 'Abierto' : 'Cerrado'}</span></div>
      <div class="a-bloque-cuerpo">${tablaHorarios(P.negocio.horarios)}</div>
    </section>
    <div class="a-pila">
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Envío y retiro</h3><p>Tiempo estimado ${escapar(P.negocio.tiempoEntrega)}</p></div></div>
        <div class="a-bloque-cuerpo"><div class="a-tabla">
          ${P.envio.zonas.map((z) => `<div><span>${escapar(z.nombre)}<small>${escapar(z.detalle)}</small></span><span>${ars(z.costo)}</span></div>`).join('')}
          <div><span>${escapar(P.envio.retiro.nombre)}</span><span>${P.envio.retiro.habilitado ? 'Habilitado' : 'No disponible'}</span></div>
          <div><span>Pedido mínimo</span><span>${ars(P.envio.pedidoMinimo)}</span></div>
        </div></div>
      </section>
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Medios de pago</h3><p>Los que ve el cliente al pedir</p></div></div>
        <div class="a-bloque-cuerpo"><div class="a-tabla">
          ${P.pagos.map((m) => `<div><span class="a-fila">${ic(ICONO_PAGO[m.id] ?? 'wallet')}<span>${escapar(m.nombre)}${m.detalle ? `<small>${escapar(m.detalle)}</small>` : ''}</span></span><span>Activo</span></div>`).join('')}
        </div></div>
      </section>
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Contacto</h3></div></div>
        <div class="a-bloque-cuerpo"><div class="a-tabla">
          <div><span>Dirección</span><span>${escapar(P.negocio.direccion)}</span></div>
          <div><span>WhatsApp de pedidos</span><span>${escapar(P.negocio.whatsapp || 'Se configura al contratar')}</span></div>
        </div></div>
      </section>
    </div>
  </div>`;
}

// ---------- Barbería: turnos ----------
function tarjetaTurno(t: RegistroTurno) {
  const e = ESTADOS_TURNO[t.estado];
  const abierto = estado.abiertos.has(t.id);
  const id = escapar(t.id);
  const sena = B.sena.activa ? Math.round((t.precio * B.sena.porcentaje) / 100) : 0;
  return `<article class="a-turno">
    <button type="button" class="a-turno-cab" data-alternar="${id}" aria-expanded="${abierto}" aria-controls="det-${id}">
      <span class="a-hora">${escapar(t.hora)}</span>
      <span class="a-turno-info"><strong>${escapar(t.nombre)}</strong><span>${escapar(t.servicio)} · ${escapar(t.profesional)}</span></span>
      <span class="a-turno-der">${pill(e)}${ic('caret-down', 'a-caret')}</span>
    </button>
    <div class="a-det" id="det-${id}" ${abierto ? '' : 'hidden'}>
      <div class="a-datos">
        <div class="a-dato"><h4>${ic('scissors')}Servicio</h4>${escapar(t.servicio)} · ${t.duracion} min</div>
        <div class="a-dato"><h4>${ic('user')}Profesional</h4>${escapar(t.profesional)}</div>
        <div class="a-dato"><h4>${ic('currency-dollar')}Precio</h4>${ars(t.precio)}${sena ? ` · seña ${ars(sena)}` : ''}</div>
        <div class="a-dato"><h4>${ic('phone')}Contacto</h4><a href="tel:${escapar(telefono(t.celular))}">${escapar(t.celular)}</a></div>
        <div class="a-dato"><h4>${ic('calendar')}Solicitud recibida</h4>${escapar(fechaHora(t.creadoEn))}</div>
      </div>
      <div class="a-acciones">
        ${t.estado === 'pendiente' ? `<button type="button" class="a-btn a-btn-principal" data-cambiar="turno" data-id="${id}" data-nuevo="confirmado">${ic('check-circle')}Confirmar turno</button>` : ''}
        ${t.estado !== 'cancelado' ? `<button type="button" class="a-btn a-btn-peligro" data-cambiar="turno" data-id="${id}" data-nuevo="cancelado">${ic('x')}Cancelar</button>` : ''}
        ${t.estado === 'cancelado' ? `<button type="button" class="a-btn a-btn-principal" data-cambiar="turno" data-id="${id}" data-nuevo="pendiente">${ic('arrow-clockwise')}Reabrir solicitud</button>` : ''}
        <button type="button" class="a-btn" data-borrar="turno" data-id="${id}" aria-label="Eliminar turno">${ic('trash')}Eliminar</button>
      </div>
    </div>
  </article>`;
}

function vistaTurnos() {
  const todos = ordenarTurnos(leerTurnos());
  const grupo = GRUPOS_TURNO.find((g) => g.id === estado.filtroTurnos) ?? GRUPOS_TURNO[0];
  const lista = grupo.estados ? todos.filter((t) => grupo.estados!.includes(t.estado)) : todos;
  const confirmados = todos.filter((t) => t.estado === 'confirmado');
  const dias = [...new Set(lista.map((t) => t.fecha))];

  const acciones = `
    <button type="button" class="a-btn a-btn-chico" data-actualizar>${ic('arrow-clockwise')}Actualizar</button>
    ${
      todos.length
        ? `<button type="button" class="a-btn a-btn-chico" data-ejemplos="turnos">${ic('sparkle')}Cargar ejemplos</button>
    <button type="button" class="a-btn a-btn-chico a-btn-peligro" data-vaciar="turnos">${ic('trash')}Vaciar</button>`
        : ''
    }`;

  return `<div class="a-pila">
    <div class="a-grid-stats">
      ${estadistica('calendar-check', String(todos.length), 'Solicitudes', 'Todas las recibidas')}
      ${estadistica('clock', String(todos.filter((t) => t.estado === 'pendiente').length), 'Pendientes', 'Esperan confirmación', 'ambar')}
      ${estadistica('check-circle', String(confirmados.length), 'Confirmados', 'Agenda firme', 'azul')}
      ${estadistica('currency-dollar', ars(confirmados.reduce((s, t) => s + t.precio, 0)), 'Ingresos estimados', 'Solo confirmados')}
    </div>
    ${chips(
      GRUPOS_TURNO.map((g) => ({ id: g.id, texto: g.texto, n: g.estados ? todos.filter((t) => g.estados!.includes(t.estado)).length : todos.length })),
      grupo.id,
      'data-filtro-turnos',
    )}
    <div class="a-barra-herr"><p>${plural(lista.length, 'turno', 'turnos')}</p><div class="a-herr">${acciones}</div></div>
    ${
      lista.length
        ? dias
            .map((dia) => {
              const { titulo, extra } = etiquetaDia(dia);
              return `<section><h3 class="a-dia">${titulo}${extra ? `<small>${extra}</small>` : ''}</h3><div class="a-apilado">${lista.filter((t) => t.fecha === dia).map(tarjetaTurno).join('')}</div></section>`;
            })
            .join('')
        : todos.length
          ? vacio('tray', 'No hay turnos en este filtro', 'Probá con otro estado para ver el resto.')
          : vacio(
              'calendar-check',
              'Todavía no hay solicitudes',
              'Pedí un turno de prueba en la web pública o cargá ejemplos para ver cómo se ve la agenda.',
              `<button type="button" class="a-btn a-btn-principal" data-ejemplos="turnos">${ic('sparkle')}Cargar ejemplos</button><a class="a-btn" href="${PUBLICA.barberia}">Probar la web ${ic('arrow-up-right')}</a>`,
            )
    }
  </div>`;
}

// ---------- Barbería: resumen, servicios, equipo, configuración ----------
function vistaResumenBarberia() {
  const todos = ordenarTurnos(leerTurnos());
  const activos = todos.filter((t) => t.estado !== 'cancelado');
  const hoy = claveFecha(new Date());
  const proximos = activos.filter((t) => t.fecha >= hoy).slice(0, 5);
  const confirmados = todos.filter((t) => t.estado === 'confirmado');

  return `<div class="a-pila">
    <div class="a-banner">
      <h2>¡Bienvenido de vuelta!</h2>
      <p>Resumen de ${escapar(B.negocio.nombreCorto)} · ${plural(proximos.length, 'turno próximo', 'turnos próximos')}</p>
    </div>
    <div class="a-grid-stats">
      ${estadistica('calendar-check', String(todos.length), 'Solicitudes', plural(todos.filter((t) => t.estado === 'pendiente').length, 'pendiente', 'pendientes'))}
      ${estadistica('check-circle', String(confirmados.length), 'Confirmados', 'Agenda firme', 'azul')}
      ${estadistica('currency-dollar', ars(confirmados.reduce((s, t) => s + t.precio, 0)), 'Ingresos estimados', 'Solo confirmados')}
      ${estadistica('users', String(B.profesionales.length), 'Profesionales', plural(B.servicios.length, 'servicio', 'servicios'), 'ambar')}
    </div>
    <div class="a-cols">
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Próximos turnos</h3><p>Los que vienen en la agenda</p></div></div>
        ${
          proximos.length
            ? `<div class="a-lista-simple">${proximos
                .map((t) => {
                  const d = desdeClave(t.fecha);
                  return `<button type="button" class="a-fila-simple" data-ver-turno="${escapar(t.id)}">
                    <span class="a-hora">${escapar(t.hora)}</span>
                    <div><strong>${escapar(t.nombre)}</strong><small>${NOMBRES_DIA[d.getDay()]} ${dos(d.getDate())}/${dos(d.getMonth() + 1)} · ${escapar(t.servicio)}</small></div>
                    ${pill(ESTADOS_TURNO[t.estado])}
                  </button>`;
                })
                .join('')}</div>`
            : `<div class="a-bloque-cuerpo">${vacio('calendar-check', 'Sin turnos próximos', 'Cuando lleguen solicitudes, las vas a ver acá.', `<button type="button" class="a-btn a-btn-principal" data-ejemplos="turnos">${ic('sparkle')}Cargar ejemplos</button>`)}</div>`
        }
      </section>
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Turnos por profesional</h3><p>Sin contar cancelados</p></div></div>
        <div class="a-bloque-cuerpo">${B.profesionales.map((p) => barra(p.nombre, activos.filter((t) => t.profesionalId === p.id).length, activos.length)).join('')}</div>
      </section>
    </div>
    <section>
      <h3 class="a-dia">Acciones rápidas</h3>
      <div class="a-acciones-rapidas">
        ${rapida('calendar-check', 'Ver turnos', 'turnos')}
        ${rapida('scissors', 'Servicios', 'servicios', 'ambar')}
        ${rapida('gear-six', 'Configuración', 'configuracion', 'azul')}
        <a class="a-rapida" href="${PUBLICA.barberia}"><span class="a-stat-ico" data-tono="viol">${ic('eye')}</span>Ver web pública</a>
      </div>
    </section>
  </div>`;
}

function vistaServicios() {
  return `<div class="a-pila">
    <div class="a-grid-stats">
      ${estadistica('scissors', String(B.servicios.length), 'Servicios', 'En el catálogo')}
      ${estadistica('clock', `${Math.round(B.servicios.reduce((s, x) => s + x.duracion, 0) / B.servicios.length)} min`, 'Duración promedio', '', 'azul')}
      ${estadistica('currency-dollar', ars(Math.round(B.servicios.reduce((s, x) => s + x.precio, 0) / B.servicios.length)), 'Precio promedio', '', 'ambar')}
      ${estadistica('tag', B.sena.activa ? `${B.sena.porcentaje}%` : 'Sin seña', 'Seña', B.sena.activa ? 'Por Mercado Pago' : '', 'viol')}
    </div>
    <div class="a-apilado">
      ${B.servicios
        .map((s) => {
          const quienes = B.profesionales.filter((p) => p.servicios.includes(s.id));
          return `<article class="a-bloque"><div class="a-bloque-cab"><div><h3>${escapar(s.nombre)}</h3><p>${s.duracion} min${B.sena.activa ? ` · seña ${ars(Math.round((s.precio * B.sena.porcentaje) / 100))}` : ''}</p></div><span class="a-importe">${ars(s.precio)}</span></div>
            <div class="a-bloque-cuerpo"><div class="a-chips-chicos" style="margin:0">${quienes.map((p) => `<span class="a-etiqueta">${ic('user')} ${escapar(p.nombre)}</span>`).join('')}</div></div></article>`;
        })
        .join('')}
    </div>
  </div>`;
}

function vistaEquipo() {
  const activos = leerTurnos().filter((t) => t.estado !== 'cancelado');
  return `<div class="a-equipo">${B.profesionales
    .map((p) => {
      const propios = activos.filter((t) => t.profesionalId === p.id).length;
      return `<article class="a-persona">
        <div class="a-foto">${p.foto ? `<img src="${escapar(p.foto)}" alt="" loading="lazy" width="160" height="160" />` : escapar(p.nombre.charAt(0))}</div>
        <div>
          <h3>${escapar(p.nombre)}</h3>
          <p>${escapar(p.especialidad)} · ${plural(propios, 'turno activo', 'turnos activos')}</p>
          <div class="a-chips-chicos">${p.servicios.map((id) => `<span class="a-etiqueta">${escapar(B.servicios.find((s) => s.id === id)?.nombre ?? id)}</span>`).join('')}</div>
        </div>
      </article>`;
    })
    .join('')}</div>`;
}

function vistaConfigBarberia() {
  const local = estadoLocal(B.horarios);
  return `<div class="a-cols">
    <section class="a-bloque">
      <div class="a-bloque-cab"><div><h3>Horarios de atención</h3><p>${escapar(local.texto)}</p></div><span class="a-pill" data-tono="${local.abierto ? 'verde' : 'gris'}">${local.abierto ? 'Abierto' : 'Cerrado'}</span></div>
      <div class="a-bloque-cuerpo">${tablaHorarios(B.horarios)}</div>
    </section>
    <div class="a-pila">
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Reservas</h3><p>Cómo se agendan los turnos</p></div></div>
        <div class="a-bloque-cuerpo"><div class="a-tabla">
          <div><span>Intervalo de horarios</span><span>${B.intervaloMinutos} min</span></div>
          <div><span>Seña</span><span>${B.sena.activa ? `${B.sena.porcentaje}% por Mercado Pago` : 'Desactivada'}</span></div>
          <div><span>“${escapar(B.cualquieraDisponible.nombre)}”</span><span>${B.cualquieraDisponible.habilitado ? 'Habilitado' : 'No disponible'}</span></div>
        </div></div>
      </section>
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Días sin atención</h3><p>Feriados y cierres especiales</p></div></div>
        <div class="a-bloque-cuerpo"><div class="a-tabla">
          ${B.diasCerrados.map((d) => `<div><span>${escapar(etiquetaDia(d).titulo)}</span><span>${escapar(desdeClave(d).getFullYear())}</span></div>`).join('')}
        </div></div>
      </section>
      <section class="a-bloque">
        <div class="a-bloque-cab"><div><h3>Contacto</h3></div></div>
        <div class="a-bloque-cuerpo"><div class="a-tabla">
          <div><span>Dirección</span><span>${escapar(B.negocio.direccion)}</span></div>
          <div><span>WhatsApp de turnos</span><span>${escapar(B.negocio.whatsapp || 'Se configura al contratar')}</span></div>
        </div></div>
      </section>
    </div>
  </div>`;
}

// ---------- Ejemplos para mostrar el panel con datos ----------
function lineaEjemplo(id: string, cantidad: number, varianteId?: string, adicionales: string[] = []) {
  const p = P.productos.find((x) => x.id === id)!;
  const v = p.variantes.find((x) => x.id === varianteId) ?? p.variantes[0];
  const ads = adicionales.map((a) => p.adicionales.find((x) => x.id === a)!);
  const unitario = (v?.precio ?? p.precio) + ads.reduce((s, a) => s + a.precio, 0);
  const nombre = `${p.nombre}${v && p.variantes.length > 1 ? ` (${v.nombre})` : ''}${ads.length ? ' + ' + ads.map((a) => a.nombre).join(' + ') : ''}`;
  return { texto: `${cantidad} × ${nombre}`, importe: unitario * cantidad };
}

function pedidoEjemplo(o: {
  hace: number;
  nombre: string;
  celular: string;
  zona?: string;
  direccion?: string;
  pago: string;
  lineas: ReturnType<typeof lineaEjemplo>[];
  comentario?: string;
  estado: EstadoPedido;
}): RegistroPedido {
  const zona = o.zona ? P.envio.zonas.find((z) => z.id === o.zona) : undefined;
  const subtotal = o.lineas.reduce((s, l) => s + l.importe, 0);
  const envio = zona?.costo ?? 0;
  return {
    id: nuevoIdDemo(),
    creadoEn: new Date(Date.now() - o.hace * 60000).toISOString(),
    nombre: o.nombre,
    celular: o.celular,
    entrega: zona ? `Envío · ${zona.nombre} · ${o.direccion}` : P.envio.retiro.nombre,
    pago: P.pagos.find((p) => p.id === o.pago)?.nombre ?? o.pago,
    items: o.lineas.map((l) => l.texto),
    subtotal,
    envio,
    total: subtotal + envio,
    comentario: o.comentario ?? '',
    estado: o.estado,
  };
}

function cargarPedidosEjemplo() {
  const ejemplos: RegistroPedido[] = [
    pedidoEjemplo({ hace: 4, nombre: 'Lucía Martínez', celular: '11 5555-0101', zona: 'zona-1', direccion: 'Belgrano 1240, piso 2', pago: 'mercadopago', lineas: [lineaEjemplo('muzzarella', 2, 'entera', ['borde']), lineaEjemplo('gaseosa', 1, 'cola')], comentario: 'Tocar el timbre B, por favor.', estado: 'pendiente' }),
    pedidoEjemplo({ hace: 22, nombre: 'Martín Gómez', celular: '11 5555-0102', pago: 'efectivo', lineas: [lineaEjemplo('especial', 1, 'entera'), lineaEjemplo('empanada-carne', 6)], estado: 'preparacion' }),
    pedidoEjemplo({ hace: 48, nombre: 'Sofía Ramírez', celular: '11 5555-0103', zona: 'zona-2', direccion: 'Mitre 450', pago: 'transferencia', lineas: [lineaEjemplo('fugazzeta', 1, 'entera', ['extra-muzza']), lineaEjemplo('flan', 1, 'ddl')], estado: 'en_camino' }),
    pedidoEjemplo({ hace: 130, nombre: 'Nicolás Pérez', celular: '11 5555-0104', pago: 'mercadopago', lineas: [lineaEjemplo('napolitana', 1, 'media'), lineaEjemplo('empanada-jyq', 2)], estado: 'entregado' }),
    pedidoEjemplo({ hace: 190, nombre: 'Camila Torres', celular: '11 5555-0105', zona: 'zona-1', direccion: 'San Martín 88', pago: 'efectivo', lineas: [lineaEjemplo('muzzarella', 1, 'media')], estado: 'cancelado' }),
  ];
  almacenamientoPedidos.actualizar((actuales) => [...actuales, ...ejemplos]);
}

function diaAbierto(desdeHoy: number): string {
  let pendientes = desdeHoy;
  const fecha = new Date();
  for (let i = 0; i < 60; i++) {
    const abierto = !!B.horarios[CLAVES_DIA[fecha.getDay()]] && !B.diasCerrados.includes(claveFecha(fecha));
    if (abierto) {
      if (pendientes === 0) return claveFecha(fecha);
      pendientes--;
    }
    fecha.setDate(fecha.getDate() + 1);
  }
  return claveFecha(new Date());
}

function cargarTurnosEjemplo() {
  const ejemplos = [
    { dia: 0, hora: '17:30', servicio: 'corte', prof: 'lucas', nombre: 'Joaquín Acosta', celular: '11 5555-0201', estado: 'confirmado' },
    { dia: 0, hora: '18:30', servicio: 'barba', prof: 'martin', nombre: 'Ramiro Suárez', celular: '11 5555-0202', estado: 'pendiente' },
    { dia: 1, hora: '10:30', servicio: 'corte-barba', prof: 'martin', nombre: 'Tomás Vega', celular: '11 5555-0203', estado: 'pendiente' },
    { dia: 1, hora: '12:00', servicio: 'color', prof: 'sofia', nombre: 'Valentina Cruz', celular: '11 5555-0204', estado: 'confirmado' },
    { dia: 2, hora: '16:00', servicio: 'corte', prof: 'sofia', nombre: 'Agustín López', celular: '11 5555-0205', estado: 'cancelado' },
  ] as const;
  const nuevos: RegistroTurno[] = ejemplos.map((e, i) => {
    const servicio = B.servicios.find((s) => s.id === e.servicio)!;
    const profesional = B.profesionales.find((p) => p.id === e.prof)!;
    return {
      id: nuevoIdDemo(),
      creadoEn: new Date(Date.now() - (i + 1) * 37 * 60000).toISOString(),
      nombre: e.nombre,
      celular: e.celular,
      servicio: servicio.nombre,
      precio: servicio.precio,
      duracion: servicio.duracion,
      profesional: profesional.nombre,
      profesionalId: profesional.id,
      fecha: diaAbierto(e.dia),
      hora: e.hora,
      estado: e.estado,
    };
  });
  almacenamientoTurnos.actualizar((actuales) => [...actuales, ...nuevos]);
}

// ---------- Pintado ----------
function pintar(foco?: string) {
  const secciones = SECCIONES[estado.negocio];
  if (!secciones.some((s) => s.id === estado.seccion)) estado.seccion = 'resumen';
  const actual = secciones.find((s) => s.id === estado.seccion)!;
  const negocio = estado.negocio === 'pizzeria' ? P.negocio : B.negocio;

  $('[data-logo]').textContent = negocio.logoTexto;
  $('[data-marca]').textContent = negocio.nombreCorto;
  $<HTMLAnchorElement>('[data-demo-publica]').href = PUBLICA[estado.negocio];
  $('[data-titulo]').textContent = actual.titulo;
  selector.value = estado.negocio;
  document.title = `${actual.titulo} · ${negocio.nombreCorto} · Panel demo`;

  let pendientes = 0;
  let html = '';
  try {
    pendientes =
      estado.negocio === 'pizzeria'
        ? leerPedidos().filter((p) => p.estado === 'pendiente').length
        : leerTurnos().filter((t) => t.estado === 'pendiente').length;
    html = vista();
  } catch (error) {
    console.error('No se pudo leer el almacenamiento de la demostración.', error);
    html = vacio('prohibit', 'No se pudo acceder al almacenamiento', 'Revisá la configuración del navegador (cookies y datos del sitio) y recargá la página.');
  }

  $('[data-nav]').innerHTML = secciones
    .map(
      (s) => `<button type="button" class="a-nav-item" data-ir="${s.id}" ${s.id === estado.seccion ? 'aria-current="page"' : ''}>
        ${ic(s.icono)}<span>${s.titulo}</span>
        ${(s.id === 'pedidos' || s.id === 'turnos') && pendientes ? `<span class="a-nav-cuenta" aria-label="${plural(pendientes, 'pendiente', 'pendientes')}">${pendientes}</span>` : ''}
      </button>`,
    )
    .join('');
  contenido.innerHTML = html;
  if (foco) contenido.querySelector<HTMLElement>(foco)?.focus({ preventScroll: true });
}

function vista(): string {
  const clave = `${estado.negocio}/${estado.seccion}`;
  switch (clave) {
    case 'pizzeria/resumen':
      return vistaResumenPizzeria();
    case 'pizzeria/pedidos':
      return vistaPedidos();
    case 'pizzeria/productos':
      return vistaProductos();
    case 'pizzeria/configuracion':
      return vistaConfigPizzeria();
    case 'barberia/resumen':
      return vistaResumenBarberia();
    case 'barberia/turnos':
      return vistaTurnos();
    case 'barberia/servicios':
      return vistaServicios();
    case 'barberia/equipo':
      return vistaEquipo();
    default:
      return vistaConfigBarberia();
  }
}

function actualizarUrl() {
  history.replaceState(null, '', `?negocio=${estado.negocio}&seccion=${estado.seccion}`);
}

function irA(seccion: string, foco?: string) {
  estado.seccion = seccion;
  actualizarUrl();
  menu(false, false);
  pintar(foco);
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

// ---------- Menú lateral (cajón en celular) ----------
const escritorio = matchMedia('(min-width: 1024px)');
function sincronizarMenu() {
  const abierto = raiz.dataset.menu === 'abierto';
  lateral.toggleAttribute('inert', !escritorio.matches && !abierto);
  principal.toggleAttribute('inert', !escritorio.matches && abierto);
}
function menu(abrir: boolean, devolverFoco = true) {
  const estabaAbierto = raiz.dataset.menu === 'abierto';
  raiz.dataset.menu = abrir ? 'abierto' : 'cerrado';
  overlay.hidden = !abrir;
  botonAbrir.setAttribute('aria-expanded', String(abrir));
  document.body.style.overflow = abrir ? 'hidden' : '';
  sincronizarMenu();
  if (abrir) lateral.querySelector<HTMLElement>('[aria-current="page"], [data-nav] button')?.focus();
  else if (estabaAbierto && devolverFoco && !escritorio.matches) botonAbrir.focus();
}
escritorio.addEventListener('change', () => menu(false, false));
sincronizarMenu();

// ---------- Eventos ----------
function cambiarEstado(recurso: string, id: string, nuevo: string) {
  if (recurso === 'pedido') {
    almacenamientoPedidos.actualizar((lista) => lista.map((p) => (p.id === id ? { ...p, estado: nuevo as EstadoPedido } : p)));
    avisar(`Pedido #${codigo(id)}: ${ESTADOS_PEDIDO[nuevo as EstadoPedido].texto.toLowerCase()}`);
  } else {
    almacenamientoTurnos.actualizar((lista) => lista.map((t) => (t.id === id ? { ...t, estado: nuevo as EstadoTurno } : t)));
    avisar(`Turno de ${leerTurnos().find((t) => t.id === id)?.nombre ?? 'cliente'}: ${ESTADOS_TURNO[nuevo as EstadoTurno].texto.toLowerCase()}`);
  }
}

function conErrores(accion: () => void, mensaje: string) {
  try {
    accion();
  } catch (error) {
    console.error(mensaje, error);
    avisar(`${mensaje} Revisá el almacenamiento del navegador.`);
  }
}

document.addEventListener('click', (evento) => {
  const objetivo = evento.target as HTMLElement;
  const dentro = <T extends HTMLElement = HTMLElement>(selectorCss: string) => objetivo.closest<T>(selectorCss);

  if (dentro('[data-abrir-menu]')) return menu(true);
  if (dentro('[data-cerrar-menu]') || objetivo === overlay) return menu(false);

  const ir = dentro('[data-ir]');
  if (ir) return irA(ir.dataset.ir!);

  const alternar = dentro('[data-alternar]');
  if (alternar) {
    const id = alternar.dataset.alternar!;
    const abrir = !estado.abiertos.has(id);
    if (abrir) estado.abiertos.add(id);
    else estado.abiertos.delete(id);
    alternar.setAttribute('aria-expanded', String(abrir));
    document.getElementById(`det-${id}`)?.toggleAttribute('hidden', !abrir);
    return;
  }

  const verPedido = dentro('[data-ver-pedido]');
  if (verPedido) {
    estado.abiertos.add(verPedido.dataset.verPedido!);
    estado.filtroPedidos = 'todos';
    return irA('pedidos', `[data-alternar="${CSS.escape(verPedido.dataset.verPedido!)}"]`);
  }
  const verTurno = dentro('[data-ver-turno]');
  if (verTurno) {
    estado.abiertos.add(verTurno.dataset.verTurno!);
    estado.filtroTurnos = 'todos';
    return irA('turnos', `[data-alternar="${CSS.escape(verTurno.dataset.verTurno!)}"]`);
  }

  const filtroPedidos = dentro('[data-filtro-pedidos]');
  if (filtroPedidos) {
    estado.filtroPedidos = filtroPedidos.dataset.filtroPedidos!;
    return pintar(`[data-filtro-pedidos="${estado.filtroPedidos}"]`);
  }
  const filtroTurnos = dentro('[data-filtro-turnos]');
  if (filtroTurnos) {
    estado.filtroTurnos = filtroTurnos.dataset.filtroTurnos!;
    return pintar(`[data-filtro-turnos="${estado.filtroTurnos}"]`);
  }
  const categoria = dentro('[data-categoria]');
  if (categoria) {
    estado.categoria = categoria.dataset.categoria!;
    return pintar(`[data-categoria="${estado.categoria}"]`);
  }

  const disp = dentro('[data-disp]');
  if (disp) {
    const id = disp.dataset.disp!;
    const producto = P.productos.find((p) => p.id === id);
    conErrores(() => {
      const nuevo = disp.getAttribute('aria-checked') !== 'true';
      almacenamientoDisponibilidad.actualizar((actual) => ({ ...actual, [id]: nuevo }));
      avisar(`${producto?.nombre ?? 'Producto'}: ${nuevo ? 'disponible' : 'agotado'}`);
      pintar(`[data-disp="${CSS.escape(id)}"]`);
    }, 'No se pudo cambiar la disponibilidad.');
    return;
  }

  const cambiar = dentro('[data-cambiar]');
  if (cambiar) {
    const { cambiar: recurso, id, nuevo } = cambiar.dataset as { cambiar: string; id: string; nuevo: string };
    conErrores(() => {
      cambiarEstado(recurso, id, nuevo);
      pintar(`[data-alternar="${CSS.escape(id)}"]`);
    }, 'No se pudo actualizar el estado.');
    return;
  }

  const borrar = dentro('[data-borrar]');
  if (borrar) {
    const { borrar: recurso, id } = borrar.dataset as { borrar: string; id: string };
    if (!window.confirm(`¿Eliminar este ${recurso}? Esta acción no se puede deshacer.`)) return;
    conErrores(() => {
      if (recurso === 'pedido') almacenamientoPedidos.actualizar((lista) => lista.filter((p) => p.id !== id));
      else almacenamientoTurnos.actualizar((lista) => lista.filter((t) => t.id !== id));
      estado.abiertos.delete(id);
      avisar(recurso === 'pedido' ? 'Pedido eliminado' : 'Turno eliminado');
      pintar();
    }, 'No se pudo eliminar.');
    return;
  }

  const vaciar = dentro('[data-vaciar]');
  if (vaciar) {
    const recurso = vaciar.dataset.vaciar;
    const pregunta = recurso === 'pedidos' ? '¿Vaciar todos los pedidos de prueba?' : '¿Vaciar todas las solicitudes de turno?';
    if (!window.confirm(`${pregunta} Esta acción no se puede deshacer.`)) return;
    conErrores(() => {
      if (recurso === 'pedidos') almacenamientoPedidos.reiniciar();
      else almacenamientoTurnos.reiniciar();
      estado.abiertos.clear();
      avisar('Datos de la demo vaciados');
      pintar();
    }, 'No se pudieron vaciar los datos.');
    return;
  }

  const ejemplos = dentro('[data-ejemplos]');
  if (ejemplos) {
    conErrores(() => {
      if (ejemplos.dataset.ejemplos === 'pedidos') cargarPedidosEjemplo();
      else cargarTurnosEjemplo();
      avisar('Ejemplos cargados');
      pintar();
    }, 'No se pudieron cargar los ejemplos.');
    return;
  }

  if (dentro('[data-actualizar]')) {
    pintar('[data-actualizar]');
    avisar('Lista actualizada');
  }
});

selector.addEventListener('change', () => {
  estado.negocio = selector.value === 'barberia' ? 'barberia' : 'pizzeria';
  estado.seccion = 'resumen';
  irA('resumen');
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && raiz.dataset.menu === 'abierto') menu(false);
});

// Si el cliente hace un pedido o pide un turno en otra pestaña, el panel se actualiza solo
window.addEventListener('storage', () => pintar());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) pintar();
});

// ---------- Inicio ----------
const parametros = new URLSearchParams(location.search);
estado.negocio = parametros.get('negocio') === 'barberia' ? 'barberia' : 'pizzeria';
estado.seccion = parametros.get('seccion') ?? 'resumen';
pintar();
