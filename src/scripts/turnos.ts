// Plantilla de turnos (v2 "Mostrador claro").
// Lee los datos del negocio del <script type="application/json" id="datos-turnos">.
// La disponibilidad y el FORMATO DEL MENSAJE no cambian respecto de v1.
import { abrirWhatsapp, linkWhatsapp } from './whatsapp';
import { track } from './analytics';
import { formatearARS } from './formato';
import { CLAVES_DIA, NOMBRES_DIA, aHora, aMinutos, estadoLocal, franjaDelDia, type Horarios } from './horarios';
import { almacenamientoTurnos, nuevoIdDemo } from './persistencia-demo';

// ---------- Tipos ----------
type Servicio = { id: string; nombre: string; precio: number; duracion: number };
type Profesional = { id: string; nombre: string; servicios: string[] };
type Datos = {
  slug: string;
  numeroWhatsapp: string;
  nombreCorto: string;
  direccion: string;
  mensaje: { emoji: string; emojiServicio: string; emojiProfesional: string };
  servicios: Servicio[];
  profesionales: Profesional[];
  cualquieraDisponible: { habilitado: boolean; nombre: string };
  horarios: Horarios;
  intervaloMinutos: number;
  diasCerrados: string[];
  turnosOcupados: { dia: string; hora: string; profesional: string }[];
  sena: { activa: boolean; porcentaje: number; texto: string };
};
type Horario = { hora: string; minutos: number; libres: Profesional[] };

// ---------- Utilidades ----------
const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) =>
  raiz.querySelector<T>(sel) as T;
const $$ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => [
  ...raiz.querySelectorAll<T>(sel),
];
const pesosMensaje = (n: number) => '$' + new Intl.NumberFormat('es-AR').format(n);
const dos = (n: number) => String(n).padStart(2, '0');
const claveFecha = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const fechaCorta = (d: Date) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}`;
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const vibrar = () => {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* no soportado */
  }
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const datos: Datos = JSON.parse($('#datos-turnos').textContent || '{}');
const CUALQUIERA = 'cualquiera';
const DIAS_A_MOSTRAR = 14;
const TOTAL_PASOS = 4;

// ---------- Estado (se conserva al volver) ----------
const estado: {
  paso: number;
  servicio: Servicio | null;
  profesionalId: string | null;
  fecha: Date | null;
  horario: Horario | null;
  asignado: Profesional | null;
} = { paso: 1, servicio: null, profesionalId: null, fecha: null, horario: null, asignado: null };

// ---------- Disponibilidad (igual que v1) ----------
function candidatos(): Profesional[] {
  if (!estado.servicio) return [];
  const aptos = datos.profesionales.filter((p) => p.servicios.includes(estado.servicio!.id));
  return estado.profesionalId === CUALQUIERA ? aptos : aptos.filter((p) => p.id === estado.profesionalId);
}
function ocupado(p: Profesional, claveDia: string, fecha: string, inicio: number, fin: number): boolean {
  const ocupadoEnSemilla = datos.turnosOcupados.some((o) => {
    if (o.dia !== claveDia || o.profesional !== p.id) return false;
    const oi = aMinutos(o.hora);
    return inicio < oi + datos.intervaloMinutos && oi < fin;
  });
  if (ocupadoEnSemilla) return true;

  return almacenamientoTurnos.leer().some((turno) => {
    if (turno.fecha !== fecha || turno.profesionalId !== p.id || turno.estado === 'cancelado') return false;
    const oi = aMinutos(turno.hora);
    return inicio < oi + turno.duracion && oi < fin;
  });
}
const diaCerrado = (f: Date) =>
  !franjaDelDia(datos.horarios, f.getDay()) || datos.diasCerrados.includes(claveFecha(f));

/** Todos los horarios del día (no pasados). `libres` vacío = ocupado (se muestra deshabilitado). */
function horariosDelDia(fecha: Date): Horario[] {
  if (!estado.servicio || diaCerrado(fecha)) return [];
  const franja = franjaDelDia(datos.horarios, fecha.getDay())!;
  const dur = estado.servicio.duracion;
  const claveDia = CLAVES_DIA[fecha.getDay()];
  const ahora = new Date();
  const esHoy = claveFecha(fecha) === claveFecha(ahora);
  const clave = claveFecha(fecha);
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const lista: Horario[] = [];
  for (let t = franja.abre; t + dur <= franja.cierra; t += datos.intervaloMinutos) {
    if (esHoy && t <= minAhora) continue;
    lista.push({
      hora: aHora(t),
      minutos: t,
      libres: candidatos().filter((p) => !ocupado(p, claveDia, clave, t, t + dur)),
    });
  }
  return lista;
}
const libresDelDia = (f: Date) => horariosDelDia(f).filter((h) => h.libres.length > 0);
function proximosDias(): Date[] {
  const hoy = new Date();
  return Array.from(
    { length: DIAS_A_MOSTRAR },
    (_, i) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i),
  );
}

// ---------- Navegación entre pasos ----------
const pasos = $$<HTMLElement>('[data-paso]');
const atras = $<HTMLButtonElement>('[data-atras]');
const TITULOS = ['¿Qué te hacés?', '¿Con quién?', '¿Cuándo?', 'Confirmá tu turno'];

function irA(paso: number, enfocar = true) {
  const anterior = estado.paso;
  estado.paso = paso;
  if (paso === 2) pintarProfesionales();
  if (paso === 3) pintarDias();
  if (paso === 4) pintarTicket();

  const entrante = pasos.find((p) => Number(p.dataset.paso) === paso)!;
  pasos.forEach((p) => (p.hidden = p !== entrante));
  if (!sinMovimiento() && anterior !== paso) {
    const d = paso > anterior ? 1 : -1;
    entrante.animate(
      [
        { transform: `translateX(${32 * d}px)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }
  $$<HTMLElement>('[data-pasos] span').forEach((s, i) => (s.dataset.lleno = String(i < paso)));
  $('[data-paso-texto]').textContent = `Paso ${paso} de ${TOTAL_PASOS}`;
  $('[data-paso-titulo]').textContent = TITULOS[paso - 1];
  atras.disabled = paso === 1;
  if (enfocar) {
    $('[data-paso-titulo]').focus({ preventScroll: true });
    const barra = $('[data-reserva]');
    if (barra.getBoundingClientRect().top < 0)
      barra.scrollIntoView({ block: 'start', behavior: sinMovimiento() ? 'auto' : 'smooth' });
  }
}
atras.addEventListener('click', () => estado.paso > 1 && irA(estado.paso - 1));

function marcar(selector: string, elegido: Element | null) {
  $$(selector).forEach((b) => b.setAttribute('aria-pressed', String(b === elegido)));
}
/** Pequeña pausa para que se vea la selección antes de avanzar. */
const avanzar = (paso: number) => setTimeout(() => irA(paso), sinMovimiento() ? 0 : 260);

// ---------- Paso 1: servicio ----------
$$<HTMLButtonElement>('[data-servicio]').forEach((b) =>
  b.addEventListener('click', () => {
    const nuevo = datos.servicios.find((s) => s.id === b.dataset.servicio) ?? null;
    if (nuevo?.id !== estado.servicio?.id) {
      Object.assign(estado, { profesionalId: null, fecha: null, horario: null, asignado: null });
      marcar('[data-profesional]', null);
    }
    estado.servicio = nuevo;
    marcar('[data-servicio]', b);
    vibrar();
    avanzar(2);
  }),
);

// ---------- Paso 2: profesional ----------
function pintarProfesionales() {
  let visibles = 0;
  $$<HTMLElement>('[data-profesional]').forEach((b) => {
    const id = b.dataset.profesional!;
    if (id === CUALQUIERA) return;
    const hace = datos.profesionales.find((p) => p.id === id)?.servicios.includes(estado.servicio?.id ?? '');
    b.closest('li')!.hidden = !hace;
    if (hace) visibles++;
  });
  const cualquiera = document.querySelector<HTMLElement>('[data-li-cualquiera]');
  if (cualquiera) cualquiera.hidden = visibles < 2;
}
$$<HTMLButtonElement>('[data-profesional]').forEach((b) =>
  b.addEventListener('click', () => {
    if (estado.profesionalId !== b.dataset.profesional) Object.assign(estado, { horario: null, asignado: null });
    estado.profesionalId = b.dataset.profesional!;
    marcar('[data-profesional]', b);
    vibrar();
    avanzar(3);
  }),
);

// ---------- Paso 3: día y horario ----------
const tiraDias = $('[data-dias]');
const cajaHoras = $('[data-horas]');
const sinHoras = $('[data-sin-horas]');

function pintarDias() {
  const dias = proximosDias();
  tiraDias.innerHTML = dias
    .map((d, i) => {
      const cerrado = diaCerrado(d);
      const nombre = i === 0 ? 'Hoy' : NOMBRES_DIA[d.getDay()].slice(0, 3);
      const etiqueta = `${NOMBRES_DIA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}${cerrado ? ', cerrado' : ''}`;
      return `<li><button type="button" class="d-dia" data-fecha="${claveFecha(d)}" aria-pressed="false" aria-label="${etiqueta}" ${cerrado ? 'disabled' : ''}>
        <span class="d-dia-semana">${nombre}</span><span class="d-dia-numero">${d.getDate()}</span>
      </button></li>`;
    })
    .join('');
  // Conserva el día elegido; si no hay, el primero con lugar
  const elegido =
    (estado.fecha && !diaCerrado(estado.fecha) && estado.fecha) ||
    dias.find((d) => libresDelDia(d).length) ||
    dias.find((d) => !diaCerrado(d));
  if (elegido) seleccionarDia(elegido, false);
}

function seleccionarDia(fecha: Date, animar = true) {
  estado.fecha = fecha;
  const boton = $(`[data-fecha="${claveFecha(fecha)}"]`, tiraDias);
  marcar('[data-fecha]', boton);
  if (boton)
    tiraDias.scrollTo({
      left: boton.closest('li')!.offsetLeft - 20,
      behavior: animar && !sinMovimiento() ? 'smooth' : 'auto',
    });

  const horarios = horariosDelDia(fecha);
  if (!horarios.some((h) => h.hora === estado.horario?.hora && h.libres.length)) {
    estado.horario = null;
    estado.asignado = null;
  }
  const libres = horarios.filter((h) => h.libres.length);
  sinHoras.hidden = libres.length > 0;
  cajaHoras.hidden = libres.length === 0;

  if (libres.length === 0) {
    const proximo = proximosDias().find((d) => d > fecha && libresDelDia(d).length);
    const btn = $<HTMLButtonElement>('[data-proximo-dia]', sinHoras);
    btn.hidden = !proximo;
    if (proximo) {
      btn.textContent = `Probá con el ${NOMBRES_DIA[proximo.getDay()].toLowerCase()} ${proximo.getDate()}`;
      btn.dataset.fecha = claveFecha(proximo);
    }
    return;
  }

  const grupos = [
    { titulo: 'Mañana', items: horarios.filter((h) => h.minutos < 12 * 60) },
    { titulo: 'Tarde', items: horarios.filter((h) => h.minutos >= 12 * 60 && h.minutos < 19 * 60) },
    { titulo: 'Noche', items: horarios.filter((h) => h.minutos >= 19 * 60) },
  ].filter((g) => g.items.length);
  let i = 0;
  cajaHoras.innerHTML = grupos
    .map(
      (g) => `<section class="d-grupo-horas" aria-label="${g.titulo}">
        <p class="d-grupo-titulo">${g.titulo}</p>
        <div class="d-horas">${g.items
          .map((h) => {
            const libre = h.libres.length > 0;
            return `<button type="button" class="d-hora" data-hora="${h.hora}" aria-pressed="${estado.horario?.hora === h.hora}" ${
              libre ? '' : `disabled aria-label="${h.hora}, ocupado"`
            } style="--i:${animar ? i++ : 0}">${h.hora}</button>`;
          })
          .join('')}</div></section>`,
    )
    .join('');
}

tiraDias.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-fecha]');
  if (!b || b.disabled) return;
  const [y, m, d] = b.dataset.fecha!.split('-').map(Number);
  estado.horario = null;
  seleccionarDia(new Date(y, m - 1, d));
});
$('[data-proximo-dia]').addEventListener('click', (e) => {
  const [y, m, d] = (e.currentTarget as HTMLElement).dataset.fecha!.split('-').map(Number);
  seleccionarDia(new Date(y, m - 1, d));
});
cajaHoras.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-hora]');
  if (!b || b.disabled || !estado.fecha) return;
  const h = horariosDelDia(estado.fecha).find((x) => x.hora === b.dataset.hora && x.libres.length);
  if (!h) return;
  estado.horario = h;
  estado.asignado = h.libres[0];
  marcar('[data-hora]', b);
  vibrar();
  avanzar(4);
});

// ---------- Paso 4: confirmación ----------
const CLAVE_CLIENTE = `demo:${datos.slug}${document.documentElement.classList.contains('embebido') ? ':embed' : ''}:cliente`;
const inNombre = $<HTMLInputElement>('#t-nombre');
const inCelular = $<HTMLInputElement>('#t-celular');
try {
  const guardado = JSON.parse(localStorage.getItem(CLAVE_CLIENTE) || '{}');
  inNombre.value = guardado.nombre ?? '';
  inCelular.value = guardado.celular ?? '';
} catch {
  /* sin almacenamiento */
}

function textoProfesional(): string {
  if (estado.profesionalId === CUALQUIERA) {
    return estado.asignado
      ? `${estado.asignado.nombre} (${datos.cualquieraDisponible.nombre.toLowerCase()})`
      : datos.cualquieraDisponible.nombre;
  }
  return datos.profesionales.find((p) => p.id === estado.profesionalId)?.nombre ?? '';
}
const textoFecha = () =>
  estado.fecha && estado.horario
    ? `${NOMBRES_DIA[estado.fecha.getDay()]} ${fechaCorta(estado.fecha)} a las ${estado.horario.hora}`
    : '';
const montoSena = () => (estado.servicio ? Math.round((estado.servicio.precio * datos.sena.porcentaje) / 100) : 0);

function pintarTicket() {
  const s = estado.servicio!;
  $('[data-t-servicio]').textContent = `${s.nombre} · ${s.duracion} min`;
  $('[data-t-profesional]').textContent = textoProfesional();
  $('[data-t-fecha]').textContent = estado.fecha
    ? `${NOMBRES_DIA[estado.fecha.getDay()]} ${fechaCorta(estado.fecha)}`
    : '';
  $('[data-t-hora]').textContent = estado.horario?.hora ?? '';
  $('[data-t-precio]').textContent = formatearARS(s.precio);
  $('[data-t-fila-sena]').hidden = !datos.sena.activa;
  $('[data-t-sena]').textContent = `${datos.sena.porcentaje}% · ${formatearARS(montoSena())}`;
}

/** Mismo formato que v1. */
function armarMensaje(): string {
  const s = estado.servicio!;
  const m = datos.mensaje;
  const lineas = [
    `${m.emoji} *Nuevo turno – ${datos.nombreCorto}*`,
    `👤 ${inNombre.value.trim()} · 📱 ${inCelular.value.trim()}`,
    `${m.emojiServicio} ${s.nombre} (${s.duracion} min) – ${pesosMensaje(s.precio)}`,
    `${m.emojiProfesional} Profesional: ${textoProfesional()}`,
    `📅 ${textoFecha()}`,
  ];
  if (datos.sena.activa) lineas.push(`💳 Seña: ${datos.sena.porcentaje}% por Mercado Pago (te pasamos el link)`);
  return lineas.join('\n');
}

function error(input: HTMLInputElement, msg: string | null): boolean {
  const p = $(`#${input.getAttribute('aria-describedby')}`);
  p.textContent = msg ?? '';
  p.hidden = !msg;
  input.setAttribute('aria-invalid', String(!!msg));
  return !msg;
}
const reglaNombre = () => (inNombre.value.trim().length >= 2 ? null : 'Contanos tu nombre para agendarte.');
const reglaCelular = () => {
  const n = inCelular.value.replace(/\D/g, '').length;
  return n >= 8 && n <= 15 ? null : 'Dejanos un celular con código de área, así te confirman.';
};
// Los errores se limpian apenas el campo queda bien
inNombre.addEventListener('input', () => {
  if (inNombre.getAttribute('aria-invalid') === 'true') error(inNombre, reglaNombre());
});
inCelular.addEventListener('input', () => {
  if (inCelular.getAttribute('aria-invalid') === 'true') error(inCelular, reglaCelular());
});

$<HTMLFormElement>('[data-form-datos]').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!estado.servicio || !estado.horario || !estado.fecha) return irA(1);
  const okNombre = error(inNombre, reglaNombre());
  const okCel = error(inCelular, reglaCelular());
  if (!okNombre) return inNombre.focus();
  if (!okCel) return inCelular.focus();

  if (
    !estado.asignado ||
    ocupado(
      estado.asignado,
      CLAVES_DIA[estado.fecha.getDay()],
      claveFecha(estado.fecha),
      estado.horario.minutos,
      estado.horario.minutos + estado.servicio.duracion,
    )
  ) {
    window.alert('Ese horario acaba de ocuparse. Elegí otro para continuar.');
    return irA(3);
  }

  try {
    almacenamientoTurnos.actualizar((turnos) => [
      ...turnos,
      {
        id: nuevoIdDemo(),
        creadoEn: new Date().toISOString(),
        nombre: inNombre.value.trim(),
        celular: inCelular.value.trim(),
        servicio: estado.servicio!.nombre,
        precio: estado.servicio!.precio,
        duracion: estado.servicio!.duracion,
        profesional: textoProfesional(),
        profesionalId: estado.asignado!.id,
        fecha: claveFecha(estado.fecha!),
        hora: estado.horario!.hora,
        estado: 'pendiente',
      },
    ]);
  } catch (error) {
    console.error('No se pudo guardar la solicitud de turno en este navegador.', error);
    window.alert('No se pudo guardar la solicitud en el panel de demostración. Podés continuar por WhatsApp.');
  }

  try {
    localStorage.setItem(CLAVE_CLIENTE, JSON.stringify({ nombre: inNombre.value.trim(), celular: inCelular.value.trim() }));
  } catch {
    /* sin almacenamiento */
  }

  const mensaje = armarMensaje();
  track('demo_booking_whatsapp', { servicio: estado.servicio.id });
  abrirWhatsapp(mensaje, `demo_${datos.slug}_reserva`, {}, datos.numeroWhatsapp);
  vibrar();
  mostrarExito(mensaje);
});

// ---------- Éxito ----------
function mostrarExito(mensaje: string) {
  const exito = $('[data-exito]');
  $('[data-exito-titulo]', exito).textContent = `¡Listo, ${inNombre.value.trim().split(' ')[0]}!`;
  $('[data-exito-resumen]', exito).textContent = `${estado.servicio!.nombre} con ${textoProfesional()} · ${textoFecha()}`;
  $<HTMLAnchorElement>('[data-exito-whatsapp]', exito).href = linkWhatsapp(mensaje, datos.numeroWhatsapp);
  $('[data-reserva]').hidden = true;
  exito.hidden = false;
  $('[data-exito-titulo]', exito).focus();
  exito.scrollIntoView({ block: 'start' });
}

/** Archivo .ics generado en el navegador (hora local "flotante"). */
function descargarCalendario() {
  if (!estado.servicio || !estado.fecha || !estado.horario) return;
  const fmt = (d: Date) =>
    `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}T${dos(d.getHours())}${dos(d.getMinutes())}00`;
  const esc = (t: string) => t.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const inicio = new Date(estado.fecha);
  inicio.setHours(0, estado.horario.minutos, 0, 0);
  const fin = new Date(inicio.getTime() + estado.servicio.duracion * 60000);
  const ahora = new Date();
  const utc = `${ahora.getUTCFullYear()}${dos(ahora.getUTCMonth() + 1)}${dos(ahora.getUTCDate())}T${dos(
    ahora.getUTCHours(),
  )}${dos(ahora.getUTCMinutes())}00Z`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//why//Demo turnos//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ahora.getTime()}-${datos.slug}@why.demo`,
    `DTSTAMP:${utc}`,
    `DTSTART:${fmt(inicio)}`,
    `DTEND:${fmt(fin)}`,
    `SUMMARY:${esc(`${estado.servicio.nombre} – ${datos.nombreCorto}`)}`,
    `LOCATION:${esc(datos.direccion)}`,
    `DESCRIPTION:${esc(`Profesional: ${textoProfesional()}`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Tu turno es en una hora',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `turno-${datos.slug}.ics` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('[data-calendario]').addEventListener('click', descargarCalendario);

$('[data-otro-turno]').addEventListener('click', () => {
  Object.assign(estado, { servicio: null, profesionalId: null, fecha: null, horario: null, asignado: null });
  marcar('[data-servicio]', null);
  marcar('[data-profesional]', null);
  $('[data-exito]').hidden = true;
  $('[data-reserva]').hidden = false;
  irA(1);
});

// ---------- Header: estado del local ----------
const est = estadoLocal(datos.horarios);
const chip = $('[data-estado]');
chip.dataset.abierto = String(est.abierto);
$('[data-estado-texto]', chip).textContent = est.abierto
  ? `Abierto hoy hasta ${est.cierra}`
  : est.texto.replace('Cerrado · abre', 'Abre');

irA(1, false);
