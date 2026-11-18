/**
 * Golpe de ariete en una impulsión por parada brusca de la bomba o cierre de
 * válvula.
 *
 * Celeridad (Allievi):  c = 9900 / √(48,3 + k·D/e),  k = 10¹⁰ / E   (E en kg/m²)
 * Fase:                 T_fase = 2L/c
 * Tiempo de parada (Mendiluce): T = C + K·L·V / (g·Hm)
 *   C = 1 si Hm/L ≤ 0,20 ; 0 si Hm/L ≥ 0,40 ; lineal entre ambos
 *   K = 2 (L < 500 m) ; 1,75 (L ≈ 500) ; 1,5 (500 < L < 1500) ; 1,25 (L ≈ 1500) ; 1 (L > 1500)
 * Longitud crítica:     Lc = c·T/2
 * Sobrepresión:
 *   cierre rápido (T < 2L/c, o L > Lc):  ΔH = c·V/g          (Joukowsky / Allievi)
 *   cierre lento  (T ≥ 2L/c, L < Lc):     ΔH = 2·L·V/(g·T)    (Michaud)
 * Presiones extremas en la bomba: H_máx = Hm + ΔH ; H_mín = Hm − ΔH.
 */

export interface MaterialGolpe {
  id: string;
  nombre: string;
  /** Módulo de elasticidad, kp/cm². */
  moduloKpCm2: number;
}

/** Módulos de elasticidad de uso habitual (Mendiluce; tablas de fabricantes). */
export const MATERIALES_GOLPE: readonly MaterialGolpe[] = [
  { id: "acero", nombre: "Acero", moduloKpCm2: 2.1e6 },
  { id: "fundicion-ductil", nombre: "Fundición dúctil", moduloKpCm2: 1.7e6 },
  { id: "fundicion-gris", nombre: "Fundición gris", moduloKpCm2: 1e6 },
  { id: "hormigon", nombre: "Hormigón", moduloKpCm2: 2e5 },
  { id: "fibrocemento", nombre: "Fibrocemento", moduloKpCm2: 2e5 },
  { id: "pvc", nombre: "PVC", moduloKpCm2: 3e4 },
  { id: "prfv", nombre: "PRFV", moduloKpCm2: 1e5 },
  { id: "pead", nombre: "PEAD (polietileno de alta densidad)", moduloKpCm2: 9000 },
  { id: "pebd", nombre: "PEBD (polietileno de baja densidad)", moduloKpCm2: 2000 },
];

export interface DatosGolpe {
  caudalLs: number;
  diametroExteriorMm: number;
  espesorMm: number;
  longitudM: number;
  moduloKpCm2: number;
  /** Altura manométrica de la bomba (para Mendiluce y presiones extremas). */
  alturaManometricaM: number;
  /** Tiempo de parada o cierre; null para estimarlo por Mendiluce. */
  tiempoCierreS: number | null;
  g: number;
  /** Presión nominal de la tubería, en m.c.a. (PN10 = 100 m). */
  presionNominalM: number | null;
}

export interface ResultadoGolpe {
  diametroInteriorMm: number;
  velocidadMs: number;
  coefK: number;
  celeridadMs: number;
  tiempoFaseS: number;
  mendiluce: { C: number; K: number; tiempoS: number };
  tiempoCierreS: number;
  longitudCriticaM: number;
  regimen: "rapido" | "lento";
  sobrepresionJoukowskyM: number;
  sobrepresionMichaudM: number;
  sobrepresionM: number;
  presionMaximaM: number;
  presionMinimaM: number;
  avisos: string[];
}

export function coeficienteMendiluceC(hmSobreL: number): number {
  if (hmSobreL <= 0.2) return 1;
  if (hmSobreL >= 0.4) return 0;
  return 1 - (hmSobreL - 0.2) / 0.2;
}

export function coeficienteMendiluceK(longitudM: number): number {
  if (longitudM < 500) return 2;
  if (longitudM === 500) return 1.75;
  if (longitudM < 1500) return 1.5;
  if (longitudM === 1500) return 1.25;
  return 1;
}

export function calcularGolpe(d: DatosGolpe): ResultadoGolpe {
  const avisos: string[] = [];
  const diametroInteriorMm = d.diametroExteriorMm - 2 * d.espesorMm;
  const D = diametroInteriorMm / 1000;
  const velocidadMs = d.caudalLs / 1000 / ((Math.PI * D ** 2) / 4);
  const coefK = 1e10 / (d.moduloKpCm2 * 1e4);
  const celeridadMs = 9900 / Math.sqrt(48.3 + (coefK * diametroInteriorMm) / d.espesorMm);
  const tiempoFaseS = (2 * d.longitudM) / celeridadMs;

  const C = coeficienteMendiluceC(d.alturaManometricaM / d.longitudM);
  const K = coeficienteMendiluceK(d.longitudM);
  const tiempoMendiluce = C + (K * d.longitudM * velocidadMs) / (d.g * d.alturaManometricaM);
  const tiempoCierreS = d.tiempoCierreS ?? tiempoMendiluce;

  const longitudCriticaM = (celeridadMs * tiempoCierreS) / 2;
  const sobrepresionJoukowskyM = (celeridadMs * velocidadMs) / d.g;
  const sobrepresionMichaudM = (2 * d.longitudM * velocidadMs) / (d.g * tiempoCierreS);
  const regimen = tiempoCierreS < tiempoFaseS ? "rapido" : "lento";
  // Con cierre rápido, o en el tramo de la impulsión más allá de Lc, manda Joukowsky.
  const sobrepresionM = regimen === "rapido" ? sobrepresionJoukowskyM : Math.min(sobrepresionMichaudM, sobrepresionJoukowskyM);
  const presionMaximaM = d.alturaManometricaM + sobrepresionM;
  const presionMinimaM = d.alturaManometricaM - sobrepresionM;

  if (regimen === "rapido") {
    avisos.push(
      "Cierre rápido (T < 2L/c): la impulsión es más larga que la longitud crítica y, desde la bomba hasta L − Lc, la sobrepresión es la máxima de Joukowsky."
    );
  }
  if (presionMinimaM < -8) {
    avisos.push("La depresión llega a menos de −8 m: riesgo de separación de columna y aplastamiento de tuberías plásticas. Considerá un volante de inercia, un calderín o válvulas de aire.");
  } else if (presionMinimaM < 0) {
    avisos.push("La presión mínima queda por debajo de la atmosférica: conviene prever válvulas de admisión de aire en los puntos altos.");
  }
  if (d.presionNominalM !== null && presionMaximaM > d.presionNominalM) {
    avisos.push("La presión máxima supera la presión nominal de la tubería: elegí una clase mayor o una protección contra el golpe de ariete.");
  }
  if (velocidadMs > 2.5) avisos.push("La velocidad supera los 2,5 m/s: el golpe de ariete crece con ella.");

  return {
    diametroInteriorMm,
    velocidadMs,
    coefK,
    celeridadMs,
    tiempoFaseS,
    mendiluce: { C, K, tiempoS: tiempoMendiluce },
    tiempoCierreS,
    longitudCriticaM,
    regimen,
    sobrepresionJoukowskyM,
    sobrepresionMichaudM,
    sobrepresionM,
    presionMaximaM,
    presionMinimaM,
    avisos,
  };
}

/**
 * Sobrepresión a una distancia x de la bomba, suponiendo la impulsión recta:
 * con cierre lento decrece linealmente hasta 0 en el depósito; con cierre
 * rápido vale Joukowsky hasta L − Lc y después decrece hasta 0.
 */
export function sobrepresionEnX(r: ResultadoGolpe, longitudM: number, x: number): number {
  if (r.regimen === "lento") return r.sobrepresionM * (1 - x / longitudM);
  const tramoPleno = longitudM - r.longitudCriticaM;
  if (x <= tramoPleno) return r.sobrepresionJoukowskyM;
  return r.sobrepresionJoukowskyM * ((longitudM - x) / r.longitudCriticaM);
}
