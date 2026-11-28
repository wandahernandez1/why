export type RegistroTurno = {
  id: string;
  creadoEn: string;
  nombre: string;
  celular: string;
  servicio: string;
  precio: number;
  duracion: number;
  profesional: string;
  profesionalId: string;
  fecha: string;
  hora: string;
  estado: 'pendiente' | 'confirmado' | 'cancelado';
};

export type RegistroPedido = {
  id: string;
  creadoEn: string;
  nombre: string;
  celular: string;
  entrega: string;
  pago: string;
  items: string[];
  subtotal: number;
  envio: number;
  total: number;
  comentario: string;
  estado: 'pendiente' | 'aceptado' | 'preparacion' | 'listo' | 'en_camino' | 'entregado' | 'cancelado';
};

export type ConfiguracionLanding = {
  nombre: string;
  monograma: string;
  titulo: string;
  descripcion: string;
  llamadaAccion: string;
  whatsapp: string;
  email: string;
  colorFondo: string;
  colorAcento: string;
  tipografia: 'sans' | 'serif';
  imagen: '/img/hero-glass-orb.webp' | '/img/hero-liquid-metal.webp' | '/brand/emoji/color.webp';
  servicios: string[];
  secciones: { servicios: boolean; portfolio: boolean; opiniones: boolean; contacto: boolean };
};

export interface AlmacenamientoDemo<T> {
  leer(): T;
  guardar(valor: T): void;
  actualizar(cambio: (actual: T) => T): T;
  eliminar(): void;
  reiniciar(): T;
}

export function nuevoIdDemo(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function crearAlmacenamientoDemo<T>(
  demo: string,
  recurso: string,
  version: number,
  inicial: T,
  validar: (valor: unknown) => valor is T,
): AlmacenamientoDemo<T> {
  const clave = `why:demo:${demo}:${recurso}:v${version}`;
  const copiarInicial = () => structuredClone(inicial);

  function guardar(valor: T) {
    if (!validar(valor)) throw new TypeError(`Datos inválidos para ${demo}/${recurso}.`);
    localStorage.setItem(clave, JSON.stringify({ version, datos: valor }));
  }

  function leer(): T {
    const texto = localStorage.getItem(clave);
    if (!texto) {
      const datos = copiarInicial();
      guardar(datos);
      return datos;
    }

    let errorParseo = false;
    try {
      const envoltorio: unknown = JSON.parse(texto);
      if (
        typeof envoltorio === 'object' &&
        envoltorio !== null &&
        'version' in envoltorio &&
        'datos' in envoltorio &&
        envoltorio.version === version &&
        validar(envoltorio.datos)
      ) {
        return envoltorio.datos;
      }
    } catch (error) {
      errorParseo = true;
      console.warn(`Se restauraron los datos inválidos de ${demo}/${recurso}.`, error);
    }

    if (!errorParseo) console.warn(`Se restauraron los datos inválidos o de otra versión de ${demo}/${recurso}.`);
    const datos = copiarInicial();
    guardar(datos);
    return datos;
  }

  return {
    leer,
    guardar,
    actualizar(cambio) {
      const siguiente = cambio(leer());
      guardar(siguiente);
      return siguiente;
    },
    eliminar() {
      localStorage.removeItem(clave);
    },
    reiniciar() {
      const datos = copiarInicial();
      guardar(datos);
      return datos;
    },
  };
}

const esCadena = (valor: unknown): valor is string => typeof valor === 'string';
const esImporte = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor);
const esObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null;

const esTurno = (valor: unknown): valor is RegistroTurno =>
  esObjeto(valor) &&
  esCadena(valor.id) &&
  esCadena(valor.creadoEn) &&
  esCadena(valor.nombre) &&
  esCadena(valor.celular) &&
  esCadena(valor.servicio) &&
  esImporte(valor.precio) &&
  esImporte(valor.duracion) &&
  esCadena(valor.profesional) &&
  esCadena(valor.profesionalId) &&
  esCadena(valor.fecha) &&
  esCadena(valor.hora) &&
  ['pendiente', 'confirmado', 'cancelado'].includes(String(valor.estado));

const esPedido = (valor: unknown): valor is RegistroPedido =>
  esObjeto(valor) &&
  esCadena(valor.id) &&
  esCadena(valor.creadoEn) &&
  esCadena(valor.nombre) &&
  esCadena(valor.celular) &&
  esCadena(valor.entrega) &&
  esCadena(valor.pago) &&
  Array.isArray(valor.items) &&
  valor.items.every(esCadena) &&
  esImporte(valor.subtotal) &&
  esImporte(valor.envio) &&
  esImporte(valor.total) &&
  esCadena(valor.comentario) &&
  ['pendiente', 'aceptado', 'preparacion', 'listo', 'en_camino', 'entregado', 'cancelado'].includes(
    String(valor.estado),
  );

const esLista = <T>(valor: unknown, validar: (item: unknown) => item is T): valor is T[] =>
  Array.isArray(valor) && valor.every(validar);

export const almacenamientoTurnos = crearAlmacenamientoDemo<RegistroTurno[]>(
  'barberia',
  'turnos',
  1,
  [],
  (valor): valor is RegistroTurno[] => esLista(valor, esTurno),
);

export const almacenamientoPedidos = crearAlmacenamientoDemo<RegistroPedido[]>(
  'pizzeria',
  'pedidos',
  1,
  [],
  (valor): valor is RegistroPedido[] => esLista(valor, esPedido),
);

/** Disponibilidad de productos que se cambia desde el panel (id de producto → disponible). */
export const almacenamientoDisponibilidad = crearAlmacenamientoDemo<Record<string, boolean>>(
  'pizzeria',
  'disponibilidad',
  1,
  {},
  (valor): valor is Record<string, boolean> =>
    esObjeto(valor) && Object.values(valor).every((disponible) => typeof disponible === 'boolean'),
);

const landingInicial: ConfiguracionLanding = {
  nombre: 'Estudio Luma',
  monograma: 'L.',
  titulo: 'Tu próximo gran proyecto empieza acá.',
  descripcion: 'Diseño y estrategia digital para marcas que quieren crecer con intención.',
  llamadaAccion: 'Hablemos de tu proyecto',
  whatsapp: '5491100000000',
  email: 'hola@estudioluma.demo',
  colorFondo: '#0b0d0c',
  colorAcento: '#b5d77b',
  tipografia: 'serif',
  imagen: '/img/hero-glass-orb.webp',
  servicios: ['Identidad de marca | Desde $ 180.000', 'Sitio web a medida | Desde $ 320.000', 'Contenido digital | Desde $ 90.000'],
  secciones: { servicios: true, portfolio: true, opiniones: true, contacto: true },
};

const esColorHex = (valor: unknown): valor is string => typeof valor === 'string' && /^#[\da-f]{6}$/i.test(valor);
const esConfiguracionLanding = (valor: unknown): valor is ConfiguracionLanding => {
  if (!esObjeto(valor)) return false;
  const secciones = valor.secciones;
  if (!esObjeto(secciones)) return false;
  if (
    !esCadena(valor.nombre) ||
    !esCadena(valor.monograma) ||
    !esCadena(valor.titulo) ||
    !esCadena(valor.descripcion) ||
    !esCadena(valor.llamadaAccion) ||
    !esCadena(valor.whatsapp) ||
    !esCadena(valor.email) ||
    !esColorHex(valor.colorFondo) ||
    !esColorHex(valor.colorAcento) ||
    !['sans', 'serif'].includes(String(valor.tipografia)) ||
    !['/img/hero-glass-orb.webp', '/img/hero-liquid-metal.webp', '/brand/emoji/color.webp'].includes(
      String(valor.imagen),
    ) ||
    !esLista(valor.servicios, esCadena)
  )
    return false;
  return ['servicios', 'portfolio', 'opiniones', 'contacto'].every(
    (seccion) => typeof secciones[seccion] === 'boolean',
  );
};

export const almacenamientoLanding = crearAlmacenamientoDemo(
  'landing-pages',
  'configuracion',
  1,
  landingInicial,
  esConfiguracionLanding,
);
