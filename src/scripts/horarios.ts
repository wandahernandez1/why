// Helpers de horarios compartidos por las demos (take away y turnos).
// Formato en los JSON: { "lunes": null, "martes": { "abre": "19:00", "cierra": "23:30" }, ... }
// Si "cierra" es menor o igual que "abre" se toma como pasada la medianoche.

export const CLAVES_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;
export const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export type Franja = { abre: string; cierra: string } | null;
export type Horarios = Record<string, Franja>;

export const aMinutos = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

export const aHora = (minutos: number): string =>
  `${String(Math.floor(minutos / 60) % 24).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

/** Franja de un día (0 = domingo) en minutos, con cierre > apertura. */
export function franjaDelDia(horarios: Horarios, dia: number) {
  const f = horarios[CLAVES_DIA[dia]];
  if (!f) return null;
  const abre = aMinutos(f.abre);
  let cierra = aMinutos(f.cierra);
  if (cierra <= abre) cierra += 24 * 60;
  return { abre, cierra, franja: f };
}

/** ¿Está abierto ahora? + texto amable para mostrar. */
export function estadoLocal(
  horarios: Horarios,
  ahora = new Date(),
): { abierto: boolean; texto: string; cierra?: string } {
  const dia = ahora.getDay();
  const min = ahora.getHours() * 60 + ahora.getMinutes();

  const hoy = franjaDelDia(horarios, dia);
  if (hoy && min >= hoy.abre && min < hoy.cierra) {
    return { abierto: true, texto: `Abierto ahora · cierra ${hoy.franja.cierra}`, cierra: hoy.franja.cierra };
  }
  // Franja de ayer que sigue después de medianoche
  const ayer = franjaDelDia(horarios, (dia + 6) % 7);
  if (ayer && ayer.cierra > 1440 && min < ayer.cierra - 1440) {
    return { abierto: true, texto: `Abierto ahora · cierra ${ayer.franja.cierra}`, cierra: ayer.franja.cierra };
  }
  if (hoy && min < hoy.abre) {
    return { abierto: false, texto: `Cerrado · abre hoy a las ${hoy.franja.abre}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (dia + i) % 7;
    const f = franjaDelDia(horarios, d);
    if (f) {
      const cuando = i === 1 ? 'mañana' : `el ${NOMBRES_DIA[d].toLowerCase()}`;
      return { abierto: false, texto: `Cerrado · abre ${cuando} a las ${f.franja.abre}` };
    }
  }
  return { abierto: false, texto: 'Cerrado' };
}

export function textoHorarioHoy(horarios: Horarios, ahora = new Date()): string {
  const f = horarios[CLAVES_DIA[ahora.getDay()]];
  return f ? `Hoy de ${f.abre} a ${f.cierra}` : 'Hoy cerrado';
}
