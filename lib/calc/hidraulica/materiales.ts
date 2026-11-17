/**
 * Tablas de referencia: rugosidad de tuberías y coeficiente de Manning de
 * canales, valores de uso habitual en proyecto (Sotelo Ávila, Rocha Felices,
 * tablas de fabricante). Sin planilla de origen: son constantes de catálogo,
 * no un cálculo con test de paridad.
 */

export interface MaterialTuberia {
  id: string;
  nombre: string;
  /** Rugosidad absoluta ε, en mm, para Darcy-Weisbach. */
  rugosidadMm: number;
  /** Coeficiente C de Hazen-Williams. */
  hazenC: number;
}

export const MATERIALES_TUBERIA: readonly MaterialTuberia[] = [
  { id: "pvc", nombre: "PVC / PE (nuevo)", rugosidadMm: 0.0015, hazenC: 150 },
  { id: "cobre", nombre: "Cobre o latón", rugosidadMm: 0.0015, hazenC: 140 },
  { id: "acero-nuevo", nombre: "Acero comercial, nuevo", rugosidadMm: 0.045, hazenC: 120 },
  { id: "acero-usado", nombre: "Acero comercial, usado", rugosidadMm: 0.2, hazenC: 100 },
  { id: "galvanizado", nombre: "Hierro galvanizado", rugosidadMm: 0.15, hazenC: 120 },
  { id: "fundicion-nueva", nombre: "Hierro fundido, nuevo", rugosidadMm: 0.26, hazenC: 130 },
  { id: "fundicion-usada", nombre: "Hierro fundido, usado", rugosidadMm: 1.0, hazenC: 100 },
  { id: "hormigon", nombre: "Hormigón", rugosidadMm: 1.0, hazenC: 120 },
];

export interface MaterialCanal {
  id: string;
  nombre: string;
  /** Coeficiente de rugosidad n de Manning. */
  n: number;
}

export const MATERIALES_CANAL: readonly MaterialCanal[] = [
  { id: "hormigon-alisado", nombre: "Hormigón alisado / llaneado", n: 0.012 },
  { id: "hormigon-bruto", nombre: "Hormigón sin alisar", n: 0.015 },
  { id: "mamposteria", nombre: "Mampostería de piedra", n: 0.025 },
  { id: "metal-liso", nombre: "Metal o PVC liso", n: 0.011 },
  { id: "tierra-limpia", nombre: "Tierra, canal natural limpio", n: 0.022 },
  { id: "tierra-vegetacion", nombre: "Tierra con vegetación", n: 0.03 },
];

/**
 * Viscosidad cinemática del agua según temperatura, tabla de referencia
 * (Streeter / Rocha Felices), interpolada linealmente entre puntos.
 */
const VISCOSIDAD_AGUA: readonly [tempC: number, nuM2s: number][] = [
  [0, 1.792e-6],
  [5, 1.519e-6],
  [10, 1.308e-6],
  [15, 1.141e-6],
  [20, 1.007e-6],
  [25, 0.897e-6],
  [30, 0.804e-6],
  [40, 0.661e-6],
  [50, 0.556e-6],
];

export function viscosidadCinematicaAgua(tempC: number): number {
  const tabla = VISCOSIDAD_AGUA;
  if (tempC <= tabla[0][0]) return tabla[0][1];
  if (tempC >= tabla[tabla.length - 1][0]) return tabla[tabla.length - 1][1];
  for (let i = 0; i < tabla.length - 1; i++) {
    const [t0, nu0] = tabla[i];
    const [t1, nu1] = tabla[i + 1];
    if (tempC >= t0 && tempC <= t1) {
      const f = (tempC - t0) / (t1 - t0);
      return nu0 + f * (nu1 - nu0);
    }
  }
  return tabla[tabla.length - 1][1];
}
