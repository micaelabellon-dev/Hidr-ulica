import { numeroDeCelda, type EspecColumna } from "@/lib/calculadoras/tablas";

/**
 * Período de retorno de una tormenta observada.
 *
 * 1. De la tormenta (hietograma con intervalo Δt) se sacan las láminas
 *    máximas para cada duración d = k·Δt, con una ventana móvil:
 *      P_máx(d) = máx_j Σ_{i=j}^{j+k−1} p_i ;  i(d) = P_máx(d) / d
 * 2. Con una relación intensidad-duración-frecuencia i(d, T) se invierte
 *    T para cada duración: el T tal que i(d, T) = i_tormenta(d), por
 *    bisección en ln T (la intensidad crece con T).
 * 3. El TR de la tormenta es el máximo entre duraciones (duración crítica).
 *
 * IDF disponibles:
 *   - Uruguay (Rodríguez Fontal, 1980):  P(d, T, A) = P(3,10) · CT(T) · CD(d) · CA(A, d)
 *       CT(T)   = 0,5786 − 0,4312 · log₁₀[ln(T / (T − 1))]
 *       CD(d)   = 0,6208·d / (d + 0,0137)^0,5639   si d < 3 h
 *               = 1,0287·d / (d + 1,0293)^0,8083   si d ≥ 3 h
 *       CA(A,d) = 1 − 0,3549·d^(−0,4272)·(1 − e^(−0,005792·A))     (A en km², d en h)
 *     con P(3,10) del mapa de isohietas (lluvia de 3 h y 10 años en el punto).
 *   - fórmula:  i = K·T^m / (d + c)^n          (i en mm/h, d en min)
 *   - tabla:    intensidades por duración y T; entre períodos de retorno se
 *               interpola lineal en la variable reducida de Gumbel
 *               y = −ln(−ln(1 − 1/T)), y entre duraciones en log-log;
 *   - Gumbel:   ajuste por momentos a máximos anuales de cada duración,
 *               P(d, T) = μ_d + β_d·y(T), β = √6·s/π, μ = x̄ − 0,5772·β.
 */

export type ModeloIdf =
  | { tipo: "uruguay"; p310Mm: number; areaKm2: number }
  | { tipo: "formula"; K: number; m: number; c: number; n: number }
  | { tipo: "tabla"; puntos: PuntoIdf[] }
  | { tipo: "gumbel"; ajustes: AjusteGumbel[] };

export interface PuntoIdf {
  duracionMin: number;
  periodoAnios: number;
  intensidadMmH: number;
}

export interface AjusteGumbel {
  duracionMin: number;
  n: number;
  media: number;
  desvio: number;
  mu: number;
  beta: number;
}

/** Coeficientes de Rodríguez Fontal (d en horas, A en km², T en años). */
export const coefTr = (T: number) => 0.5786 - 0.4312 * Math.log10(Math.log(T / (T - 1)));
export const coefDuracion = (dHoras: number) =>
  dHoras < 3 ? (0.6208 * dHoras) / (dHoras + 0.0137) ** 0.5639 : (1.0287 * dHoras) / (dHoras + 1.0293) ** 0.8083;
export const coefArea = (areaKm2: number, dHoras: number) =>
  1 - 0.3549 * dHoras ** -0.4272 * (1 - Math.exp(-0.005792 * areaKm2));

/** Lámina P(d, T, A) de Rodríguez Fontal, en mm. */
export function laminaUruguay(p310Mm: number, dHoras: number, T: number, areaKm2: number): number {
  return p310Mm * coefTr(T) * coefDuracion(dHoras) * coefArea(areaKm2, dHoras);
}

/** T a partir de CT, invirtiendo CT(T) en forma cerrada: T = e^z / (e^z − 1), z = 10^((0,5786 − CT)/0,4312). */
export function trDesdeCoefTr(ct: number): number {
  const z = 10 ** ((0.5786 - ct) / 0.4312);
  return Math.exp(z) / Math.expm1(z);
}

/** Variable reducida de Gumbel para un período de retorno T (años, > 1). */
export const variableGumbel = (T: number) => -Math.log(-Math.log(1 - 1 / T));

/** Ajuste de Gumbel por el método de los momentos. */
export function ajustarGumbel(valores: readonly number[], duracionMin: number): AjusteGumbel {
  const n = valores.length;
  const media = valores.reduce((s, x) => s + x, 0) / n;
  const desvio = Math.sqrt(valores.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1));
  const beta = (Math.sqrt(6) * desvio) / Math.PI;
  return { duracionMin, n, media, desvio, beta, mu: media - 0.5772 * beta };
}

/** Intensidad en una duración tabulada (o ajustada), en función de T. */
function intensidadEnDuracion(modelo: ModeloIdf, d: number, T: number): number {
  if (modelo.tipo === "gumbel") {
    const a = modelo.ajustes.find((x) => x.duracionMin === d)!;
    return ((a.mu + a.beta * variableGumbel(T)) / d) * 60;
  }
  if (modelo.tipo === "tabla") {
    const pts = modelo.puntos.filter((p) => p.duracionMin === d).sort((a, b) => a.periodoAnios - b.periodoAnios);
    const y = variableGumbel(T);
    const ys = pts.map((p) => variableGumbel(p.periodoAnios));
    let i0 = 0;
    while (i0 < pts.length - 2 && y > ys[i0 + 1]) i0++;
    const f = (y - ys[i0]) / (ys[i0 + 1] - ys[i0]);
    return pts[i0].intensidadMmH + f * (pts[i0 + 1].intensidadMmH - pts[i0].intensidadMmH);
  }
  return NaN;
}

function duracionesDe(modelo: ModeloIdf): number[] {
  if (modelo.tipo === "gumbel") return [...new Set(modelo.ajustes.map((a) => a.duracionMin))].sort((a, b) => a - b);
  if (modelo.tipo === "tabla") return [...new Set(modelo.puntos.map((p) => p.duracionMin))].sort((a, b) => a - b);
  return [];
}

/** Intensidad de diseño i(d, T), en mm/h. */
export function intensidadIdf(modelo: ModeloIdf, duracionMin: number, T: number): number {
  if (modelo.tipo === "uruguay") {
    const dh = duracionMin / 60;
    return laminaUruguay(modelo.p310Mm, dh, T, modelo.areaKm2) / dh;
  }
  if (modelo.tipo === "formula") {
    return (modelo.K * T ** modelo.m) / (duracionMin + modelo.c) ** modelo.n;
  }
  const ds = duracionesDe(modelo);
  if (ds.length === 1) return intensidadEnDuracion(modelo, ds[0], T);
  // Tramo de duraciones que contiene a d (o el más cercano, extrapolando en log-log).
  let k = 0;
  while (k < ds.length - 2 && duracionMin > ds[k + 1]) k++;
  const d0 = ds[k];
  const d1 = ds[k + 1];
  const i0 = intensidadEnDuracion(modelo, d0, T);
  const i1 = intensidadEnDuracion(modelo, d1, T);
  if (i0 <= 0 || i1 <= 0) {
    const f = (duracionMin - d0) / (d1 - d0);
    return i0 + f * (i1 - i0);
  }
  const f = (Math.log(duracionMin) - Math.log(d0)) / (Math.log(d1) - Math.log(d0));
  return Math.exp(Math.log(i0) + f * (Math.log(i1) - Math.log(i0)));
}

export const T_MIN = 1.01;
export const T_MAX = 10_000;

export interface PeriodoRetorno {
  /** T en años, recortado a [T_MIN, T_MAX]. */
  T: number;
  /** "menor" si la intensidad es menor que la de T_MIN, "mayor" si supera la de T_MAX. */
  fuera: "menor" | "mayor" | null;
}

/** T tal que i(d, T) = intensidad, por bisección en ln T. */
export function periodoRetorno(modelo: ModeloIdf, duracionMin: number, intensidadMmH: number): PeriodoRetorno {
  const f = (lnT: number) => intensidadIdf(modelo, duracionMin, Math.exp(lnT)) - intensidadMmH;
  let lo = Math.log(T_MIN);
  let hi = Math.log(T_MAX);
  if (f(lo) >= 0) return { T: T_MIN, fuera: "menor" };
  if (f(hi) <= 0) return { T: T_MAX, fuera: "mayor" };
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return { T: Math.exp((lo + hi) / 2), fuera: null };
}

/** Probabilidad de que se iguale o supere en un año cualquiera, y en un lapso de n años. */
export const probabilidadAnual = (T: number) => 1 / T;
export const riesgoEnAnios = (T: number, anios: number) => 1 - (1 - 1 / T) ** anios;

// ── Tormenta ───────────────────────────────────────────────────────────────

export interface MaximoDuracion {
  duracionMin: number;
  laminaMm: number;
  intensidadMmH: number;
  /** Índice del primer intervalo de la ventana más lluviosa. */
  inicio: number;
}

/** Láminas máximas en ventanas móviles de 1, 2, …, N intervalos. */
export function maximosPorDuracion(lluviasMm: readonly number[], intervaloMin: number): MaximoDuracion[] {
  const n = lluviasMm.length;
  const acum = [0];
  for (const p of lluviasMm) acum.push(acum[acum.length - 1] + p);
  const out: MaximoDuracion[] = [];
  for (let k = 1; k <= n; k++) {
    let max = -Infinity;
    let inicio = 0;
    for (let j = 0; j + k <= n; j++) {
      const s = acum[j + k] - acum[j];
      if (s > max + 1e-12) {
        max = s;
        inicio = j;
      }
    }
    const d = k * intervaloMin;
    out.push({ duracionMin: d, laminaMm: max, intensidadMmH: (max / d) * 60, inicio });
  }
  return out;
}

export interface ResultadoTormenta {
  maximos: (MaximoDuracion & PeriodoRetorno)[];
  critico: MaximoDuracion & PeriodoRetorno;
  total: MaximoDuracion & PeriodoRetorno;
  laminaTotalMm: number;
  duracionTotalMin: number;
  avisos: string[];
}

export function analizarTormenta(
  lluviasMm: readonly number[],
  intervaloMin: number,
  modelo: ModeloIdf
): ResultadoTormenta {
  const avisos: string[] = [];
  const maximos = maximosPorDuracion(lluviasMm, intervaloMin).map((m) => ({
    ...m,
    ...periodoRetorno(modelo, m.duracionMin, m.intensidadMmH),
  }));
  const critico = maximos.reduce((a, b) => (b.T > a.T + 1e-9 ? b : a));
  const total = maximos[maximos.length - 1];
  const ds = duracionesDe(modelo);
  if (ds.length) {
    const fueraRango = maximos.filter((m) => m.duracionMin < ds[0] || m.duracionMin > ds[ds.length - 1]);
    if (fueraRango.length) {
      avisos.push(
        `La IDF cargada cubre de ${ds[0]} a ${ds[ds.length - 1]} min: para duraciones fuera de ese rango se extrapola en log-log y el TR es menos confiable.`
      );
    }
  }
  if (critico.fuera === "mayor") avisos.push(`La tormenta supera la intensidad de T = ${T_MAX} años en alguna duración: TR fuera del rango calculable.`);
  if (modelo.tipo === "gumbel" && modelo.ajustes.some((a) => a.n < 20)) {
    avisos.push("Alguna duración tiene menos de 20 años de máximos: los TR altos (> 2 veces la longitud del registro) son muy inciertos.");
  }
  if (modelo.tipo === "tabla") {
    const Ts = modelo.puntos.map((p) => p.periodoAnios);
    const tMax = Math.max(...Ts);
    if (critico.T > tMax && critico.fuera === null) {
      avisos.push(`El TR crítico (${Math.round(critico.T)} años) supera el mayor de la tabla (${tMax} años): se extrapoló en la variable de Gumbel.`);
    }
  }
  return {
    maximos,
    critico,
    total,
    laminaTotalMm: lluviasMm.reduce((s, x) => s + x, 0),
    duracionTotalMin: lluviasMm.length * intervaloMin,
    avisos,
  };
}

// ── Columnas y validación ──────────────────────────────────────────────────

export const COLUMNAS_HIETOGRAMA: readonly EspecColumna[] = [
  { clave: "tiempo", nombre: "tiempo", alias: ["hora", "fecha", "fecha_hora", "t", "minuto", "minutos", "intervalo", "inicio"], obligatoria: false, tipo: "numero" },
  { clave: "lluvia", nombre: "lluvia_mm", alias: ["lluvia", "precipitacion", "p", "pp", "lamina", "acumulada", "mm"], obligatoria: true, tipo: "numero" },
];

export const COLUMNAS_IDF: readonly EspecColumna[] = [
  { clave: "duracion", nombre: "duracion_min", alias: ["duracion", "d", "min"], obligatoria: true, tipo: "numero" },
  { clave: "tr", nombre: "tr_anios", alias: ["tr", "t", "periodo", "periodo_retorno", "retorno"], obligatoria: true, tipo: "numero" },
  { clave: "intensidad", nombre: "intensidad_mm_h", alias: ["intensidad", "i", "lamina", "precipitacion", "p"], obligatoria: true, tipo: "numero" },
];

export const COLUMNAS_MAXIMOS: readonly EspecColumna[] = [
  { clave: "anio", nombre: "anio", alias: ["ano", "year", "fecha"], obligatoria: true, tipo: "numero" },
  { clave: "duracion", nombre: "duracion_min", alias: ["duracion", "d", "min"], obligatoria: true, tipo: "numero" },
  { clave: "lamina", nombre: "precipitacion_mm", alias: ["precipitacion", "lluvia", "p", "pp", "maximo", "lamina"], obligatoria: true, tipo: "numero" },
];

function leerNumeros(filas: readonly string[][], columnas: number[], nombres: string[], errores: string[]) {
  const out: number[][] = [];
  filas.forEach((f, i) => {
    if (!f.some((c) => (c ?? "").trim() !== "")) return;
    const v = columnas.map((j, k) => {
      const n = numeroDeCelda(f[j] ?? "");
      if (n === null) errores.push(`Fila ${i + 1}: falta ${nombres[k]}.`);
      else if (Number.isNaN(n)) errores.push(`Fila ${i + 1}: ${nombres[k]} «${f[j]}» no es un número.`);
      else if (n < 0) errores.push(`Fila ${i + 1}: ${nombres[k]} negativo.`);
      return n ?? NaN;
    });
    out.push(v);
  });
  return out;
}

/** Hietograma: lluvia de cada intervalo, o acumulada (se desacumula). */
export function validarHietograma(filas: readonly string[][], acumulada: boolean): { lluvias: number[] | null; errores: string[] } {
  const errores: string[] = [];
  const v = leerNumeros(filas, [1], ["la lluvia"], errores).map((x) => x[0]);
  if (v.length === 0) errores.push("Cargá al menos un intervalo de lluvia.");
  let lluvias = v;
  if (acumulada && errores.length === 0) {
    lluvias = v.map((x, i) => x - (i > 0 ? v[i - 1] : 0));
    lluvias.forEach((x, i) => {
      if (x < -1e-9) errores.push(`Fila ${i + 1}: la lluvia acumulada baja respecto de la fila anterior.`);
    });
    lluvias = lluvias.map((x) => Math.max(0, x));
  }
  return { lluvias: errores.length ? null : lluvias, errores: errores.slice(0, 15) };
}

/** Tabla IDF: al menos dos períodos de retorno por duración; intensidades o láminas. */
export function validarTablaIdf(
  filas: readonly string[][],
  enLamina: boolean
): { puntos: PuntoIdf[] | null; errores: string[] } {
  const errores: string[] = [];
  const v = leerNumeros(filas, [0, 1, 2], ["la duración", "el TR", enLamina ? "la lámina" : "la intensidad"], errores);
  const puntos = v.map(([d, T, x]) => ({ duracionMin: d, periodoAnios: T, intensidadMmH: enLamina ? (x / d) * 60 : x }));
  if (errores.length === 0) {
    if (puntos.some((p) => p.duracionMin <= 0)) errores.push("Las duraciones tienen que ser mayores que cero.");
    if (puntos.some((p) => p.periodoAnios <= 1)) errores.push("Los períodos de retorno tienen que ser mayores que 1 año.");
    const porD = new Map<number, Set<number>>();
    for (const p of puntos) porD.set(p.duracionMin, (porD.get(p.duracionMin) ?? new Set()).add(p.periodoAnios));
    for (const [d, ts] of porD) {
      if (ts.size < 2) errores.push(`La duración ${d} min tiene un solo TR: hacen falta al menos dos para interpolar.`);
    }
    for (const d of porD.keys()) {
      const pts = puntos.filter((p) => p.duracionMin === d).sort((a, b) => a.periodoAnios - b.periodoAnios);
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].intensidadMmH <= pts[i - 1].intensidadMmH) {
          errores.push(`Duración ${d} min: la intensidad tiene que crecer con el TR.`);
          break;
        }
      }
    }
  }
  return { puntos: errores.length ? null : puntos, errores: errores.slice(0, 15) };
}

/** Máximos anuales por duración → ajustes de Gumbel. */
export function validarMaximos(filas: readonly string[][]): { ajustes: AjusteGumbel[] | null; errores: string[] } {
  const errores: string[] = [];
  const v = leerNumeros(filas, [0, 1, 2], ["el año", "la duración", "la lluvia máxima"], errores);
  const porD = new Map<number, number[]>();
  for (const [, d, p] of v) porD.set(d, [...(porD.get(d) ?? []), p]);
  const ajustes: AjusteGumbel[] = [];
  for (const [d, xs] of [...porD].sort((a, b) => a[0] - b[0])) {
    if (d <= 0) errores.push("Las duraciones tienen que ser mayores que cero.");
    else if (xs.length < 5) errores.push(`La duración ${d} min tiene ${xs.length} años: hacen falta al menos 5 (mejor 20 o más).`);
    else ajustes.push(ajustarGumbel(xs, d));
  }
  if (porD.size === 0 && errores.length === 0) errores.push("Cargá los máximos anuales.");
  return { ajustes: errores.length ? null : ajustes, errores: errores.slice(0, 15) };
}

// ── Ejemplos (ilustrativos, no de una estación real) ───────────────────────

/** Tormenta de 2 h en intervalos de 5 min, con un pico a los 40 min. */
export const HIETOGRAMA_EJEMPLO: string[][] = [
  0.5, 0.8, 1.2, 1.8, 2.5, 4.2, 6.5, 8.8, 7.1, 4.6, 3.2, 2.4, 1.9, 1.5, 1.2, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.2,
].map((p, i) => [`${String(Math.floor((i * 5) / 60)).padStart(2, "0")}:${String((i * 5) % 60).padStart(2, "0")}`, String(p).replace(".", ",")]);

/** Tabla IDF de ejemplo generada con i = 800·T^0,2/(d+10)^0,75, para mostrar el formato. */
export const TABLA_IDF_EJEMPLO: string[][] = [5, 10, 15, 30, 60, 120, 360, 720, 1440].flatMap((d) =>
  [2, 5, 10, 25, 50, 100].map((T) => [String(d), String(T), String(+((800 * T ** 0.2) / (d + 10) ** 0.75).toFixed(2)).replace(".", ",")])
);

/** Máximos anuales sintéticos (Gumbel con μ y β que crecen con la duración), para mostrar el formato. */
export const MAXIMOS_EJEMPLO: string[][] = (() => {
  const u = [0.12, 0.55, 0.31, 0.83, 0.47, 0.69, 0.22, 0.91, 0.38, 0.6, 0.05, 0.76, 0.43, 0.27, 0.97, 0.51, 0.66, 0.15, 0.88, 0.35];
  const filas: string[][] = [];
  for (const [d, mu, beta] of [
    [15, 18, 6],
    [30, 25, 8],
    [60, 32, 10],
    [120, 40, 12],
    [360, 55, 16],
    [1440, 75, 22],
  ]) {
    u.forEach((q, k) => {
      const p = mu - beta * Math.log(-Math.log(q));
      filas.push([String(2000 + k), String(d), String(+p.toFixed(1)).replace(".", ",")]);
    });
  }
  return filas;
})();
