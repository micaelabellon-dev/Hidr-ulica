/**
 * Floculación.
 *
 * Ajuste G·Tⁿ = K a ensayos de jarras (mejor G para cada tiempo): regresión
 * lineal de ln G contra ln T.
 *
 * Floculador mecánico de paletas, por cámara:
 *   Ly = A/Lx ; De = 1,13·√(Lx·Ly) ; D = (D/De)·De ; b = D/2 ; b/a → Cd
 *   n³ = (G/0,024)² · ν·V / (Cd·(1 − k)³·a·b⁴)     [rpm]
 *   v_paleta = 2π·b·n/60 ; Q bombeo = Nq·n·D³/60 ; velocidad ascensional = Qb/A
 *
 * Floculador hidráulico de tabiques, por tramo con separación d:
 *   V = T·Q ; A = V/H ; largo = A/B ; N tabiques = largo/d
 *   flujo horizontal: v = Q/(d·H) ; J = (n·v/Rh^(2/3))² ; hf = N·Lc·J + (N − 1)·K·(2v/3)²/2g
 *   flujo vertical:   v = Q/(d·B) ; hf = (N − 1)·K·(2v/3)²/2g
 *   G = √(g·hf / (ν·T))
 * Tubería de salida (Manning): G = n·√(g/ν)·Rh^(−2/3)·v^1,5.
 */

export function ajusteGT(t: readonly number[], g: readonly number[]) {
  const x = t.map(Math.log);
  const y = g.map(Math.log);
  const m = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / m;
  const my = y.reduce((s, v) => s + v, 0) / m;
  const sxy = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  const sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  const pendiente = sxy / sxx;
  const n = -pendiente;
  const K = Math.exp(my - pendiente * mx);
  const ssTot = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssRes = y.reduce((s, v, i) => s + (v - (Math.log(K) - n * x[i])) ** 2, 0);
  return { n, K, r2: ssTot ? 1 - ssRes / ssTot : 1 };
}

/** Cd de una paleta según la relación largo/ancho (Camp), interpolado. */
const TABLA_CD: [number, number][] = [
  [1, 1.1],
  [2, 1.15],
  [4, 1.19],
  [10, 1.29],
];
export function cdPaleta(relacion: number): number {
  const t = TABLA_CD;
  if (relacion <= t[0][0]) return t[0][1];
  for (let i = 0; i < t.length - 1; i++) {
    if (relacion <= t[i + 1][0]) {
      const f = (relacion - t[i][0]) / (t[i + 1][0] - t[i][0]);
      return t[i][1] + f * (t[i + 1][1] - t[i][1]);
    }
  }
  return 1.5; // b/a > 10 → paleta larga (Camp: Cd → 1,5 a 2)
}

export interface CamaraPaletas {
  areaM2: number;
  lxM: number;
  gObjetivo: number;
  anchoPaletaM: number; // a
}

export interface DatosPaletas {
  caudalM3s: number;
  alturaM: number;
  relacionDDe: number;
  k: number;
  nu: number;
  nq: number;
  camaras: CamaraPaletas[];
}

export function floculadorPaletas(d: DatosPaletas) {
  let tAcum = 0;
  return d.camaras.map((c) => {
    const volumen = c.areaM2 * d.alturaM;
    const ly = c.areaM2 / c.lxM;
    const de = 1.13 * Math.sqrt(c.lxM * ly);
    const D = d.relacionDDe * de;
    const b = D / 2;
    const relacion = b / c.anchoPaletaM;
    const cd = cdPaleta(relacion);
    const n3 = (c.gObjetivo / 0.024) ** 2 * ((d.nu * volumen) / (cd * (1 - d.k) ** 3 * (c.anchoPaletaM * b ** 4)));
    const rpm = Math.cbrt(n3);
    const vPaleta = (2 * Math.PI * b * rpm) / 60;
    const qBombeo = (d.nq * rpm * D ** 3) / 60;
    const tiempo = volumen / d.caudalM3s;
    tAcum += tiempo;
    return { ...c, volumen, ly, de, D, b, relacion, cd, rpm, vPaleta, qBombeo, velAscensional: qBombeo / c.areaM2, tiempo, tAcum };
  });
}

export interface TramoTabiques {
  separacionM: number;
  tiempoS: number;
}

export interface DatosTabiques {
  caudalM3s: number;
  alturaM: number;
  anchoM: number;
  manning: number;
  kGiro: number;
  nu: number;
  g: number;
  flujo: "horizontal" | "vertical";
  /** Ancho del pasaje en la vuelta, como múltiplo de la separación (flujo horizontal). */
  pasajeFactor: number;
  tramos: TramoTabiques[];
}

export function floculadorTabiques(d: DatosTabiques) {
  return d.tramos.map((t) => {
    const volumen = t.tiempoS * d.caudalM3s;
    const area = volumen / d.alturaM;
    const largo = area / d.anchoM;
    const tabiques = largo / t.separacionM;
    const vueltas = Math.max(0, tabiques - 1);
    if (d.flujo === "vertical") {
      const v = d.caudalM3s / (t.separacionM * d.anchoM);
      const hfVueltas = (vueltas * d.kGiro * ((2 / 3) * v) ** 2) / (2 * d.g);
      const G = Math.sqrt((d.g * hfVueltas) / (d.nu * t.tiempoS));
      return { ...t, volumen, area, largo, tabiques, vueltas, v, rh: NaN, j: NaN, lc: NaN, hfCanales: 0, hfVueltas, hf: hfVueltas, G };
    }
    const at = t.separacionM * d.alturaM;
    const perim = 2 * d.alturaM + t.separacionM;
    const rh = at / perim;
    const v = d.caudalM3s / at;
    const j = ((d.manning * v) / rh ** (2 / 3)) ** 2;
    const lc = d.anchoM - 2 * d.pasajeFactor * t.separacionM;
    const hfCanales = tabiques * lc * j;
    const hfVueltas = (vueltas * d.kGiro * ((2 / 3) * v) ** 2) / (2 * d.g);
    const hf = hfCanales + hfVueltas;
    const G = Math.sqrt((d.g * hf * d.caudalM3s) / (d.nu * volumen));
    return { ...t, volumen, area, largo, tabiques, vueltas, v, rh, j, lc, hfCanales, hfVueltas, hf, G };
  });
}

export function gradienteTuberia(caudalM3s: number, diametroM: number, manning: number, nu = 1e-6, g = 9.8) {
  const area = (Math.PI * diametroM ** 2) / 4;
  const v = caudalM3s / area;
  const rh = diametroM / 4;
  return { v, rh, G: manning * Math.sqrt(g / nu) * rh ** -0.667 * v ** 1.5 };
}
