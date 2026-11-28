// Formatos en pesos argentinos y limpieza de placeholders.

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** 12500 → "$ 12.500" (formato oficial es-AR) */
export function formatearARS(valor: number): string {
  return ars.format(valor);
}

/**
 * Para los precios de site.json, que pueden ser número ("120000", 120000)
 * o todavía un placeholder ("[PRECIO_LANDING]").
 * Devuelve el número con puntos de miles, o el texto tal cual.
 */
export function formatearMonto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  const limpio = String(valor).trim();
  if (/^\d+([.,]\d+)?$/.test(limpio.replace(/\./g, ''))) {
    return numero.format(Number(limpio.replace(/\./g, '').replace(',', '.')));
  }
  return limpio;
}

/** true si el valor todavía es un placeholder tipo "[PRECIO_LANDING]" */
export function esPlaceholder(valor: unknown): boolean {
  return /\[[^\]]*\]/.test(String(valor ?? ''));
}

/** "120.000" | 120000 → 120000; placeholder o texto → null */
export function aNumero(valor: unknown): number | null {
  const limpio = String(valor ?? '').trim().replace(/\./g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : null;
}

/** true si el valor existe y no está vacío */
export function tieneValor(valor: unknown): boolean {
  return valor !== null && valor !== undefined && String(valor).trim() !== '';
}

/** Colores del JSON de una demo → variables CSS cortas (--p, --pt, --f, --s, --t, --ts, --error). */
export function estiloColores(c: {
  primario: string;
  primarioTexto: string;
  fondo: string;
  superficie: string;
  texto: string;
  textoSuave: string;
  error?: string;
}): string {
  const vars: Record<string, string | undefined> = {
    '--p': c.primario,
    '--pt': c.primarioTexto,
    '--f': c.fondo,
    '--s': c.superficie,
    '--t': c.texto,
    '--ts': c.textoSuave,
    '--error': c.error,
    '--foco': c.texto,
  };
  return Object.entries(vars)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

/** "#CF3A26" → "rgba(207,58,38,0.12)" */
export function hexARgba(hex: string, alfa: number): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alfa})`;
}

/**
 * Acento de una demo (del JSON) → variables CSS del sistema de demos.
 * `textoSobreAcento` es el color del texto en los botones (#fff o #111 según contraste).
 */
export function estiloAcento(acento: string, textoSobreAcento = '#ffffff'): string {
  return [
    `--demo-acento:${acento}`,
    `--demo-acento-texto:${textoSobreAcento}`,
    `--demo-acento-tinte:${hexARgba(acento, 0.12)}`,
    `--demo-acento-sombra:${hexARgba(acento, 0.34)}`,
  ].join(';');
}

/** "[tumarca@gmail.com]" → "tumarca@gmail.com" (para links válidos mientras haya placeholders) */
export function sinCorchetes(valor: string): string {
  return (valor || '').replace(/[\[\]]/g, '').trim();
}
