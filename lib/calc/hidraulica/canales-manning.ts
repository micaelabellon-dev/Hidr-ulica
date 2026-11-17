/**
 * Tirante normal, velocidad y régimen de un canal a superficie libre, por la
 * ecuación de Manning:
 *
 *   Q = (1/n) · A · R^(2/3) · S^(1/2)        (SI: Q en m³/s, A en m², R en m)
 *
 * Dados el caudal de diseño, la forma y las dimensiones de la sección
 * (b = solera, z = talud horizontal/vertical de los lados), el coeficiente de
 * rugosidad n y la pendiente de fondo S, el tirante y no sale de una fórmula
 * cerrada — A y R dependen de y de forma no lineal — así que se resuelve por
 * bisección sobre el caudal que conduciría cada tirante.
 */

export const G = 9.81;

export type FormaCanal = "rectangular" | "trapecial" | "triangular";
export type RegimenCanal = "subcritico" | "critico" | "supercritico";

export interface DatosCanalManning {
  forma: FormaCanal;
  /** Caudal de diseño, en m³/s. */
  caudalM3s: number;
  /** Ancho de solera, en m. Sin efecto en un canal triangular. */
  baseM: number;
  /** Talud de los lados, horizontal por vertical (1V:zH). Sin efecto en un canal rectangular. */
  taludZ: number;
  /** Coeficiente de rugosidad de Manning. */
  n: number;
  /** Pendiente de fondo, en m/m. */
  pendiente: number;
}

export interface GeometriaCanal {
  areaM2: number;
  perimetroMojadoM: number;
  radioHidraulicoM: number;
  anchoSuperficialM: number;
}

export interface ResultadoCanalManning extends GeometriaCanal {
  tiranteM: number;
  velocidadMs: number;
  froude: number;
  regimen: RegimenCanal;
}

export function geometriaCanal(
  forma: FormaCanal,
  tiranteM: number,
  baseM: number,
  taludZ: number
): GeometriaCanal {
  const y = tiranteM;
  if (forma === "rectangular") {
    const areaM2 = baseM * y;
    const perimetroMojadoM = baseM + 2 * y;
    return { areaM2, perimetroMojadoM, radioHidraulicoM: areaM2 / perimetroMojadoM, anchoSuperficialM: baseM };
  }
  if (forma === "triangular") {
    const areaM2 = taludZ * y * y;
    const perimetroMojadoM = 2 * y * Math.sqrt(1 + taludZ * taludZ);
    return {
      areaM2,
      perimetroMojadoM,
      radioHidraulicoM: areaM2 / perimetroMojadoM,
      anchoSuperficialM: 2 * taludZ * y,
    };
  }
  // trapecial
  const areaM2 = (baseM + taludZ * y) * y;
  const perimetroMojadoM = baseM + 2 * y * Math.sqrt(1 + taludZ * taludZ);
  return {
    areaM2,
    perimetroMojadoM,
    radioHidraulicoM: areaM2 / perimetroMojadoM,
    anchoSuperficialM: baseM + 2 * taludZ * y,
  };
}

export function caudalManning(
  forma: FormaCanal,
  tiranteM: number,
  baseM: number,
  taludZ: number,
  n: number,
  pendiente: number
): number {
  const { areaM2, radioHidraulicoM } = geometriaCanal(forma, tiranteM, baseM, taludZ);
  if (areaM2 <= 0) return 0;
  return (1 / n) * areaM2 * radioHidraulicoM ** (2 / 3) * Math.sqrt(pendiente);
}

/** Tirante normal por bisección: el único cero de Q(y) − Qdiseño, porque Q(y) es creciente con y. */
export function resolverTiranteNormal(datos: DatosCanalManning): number {
  const { forma, caudalM3s, baseM, taludZ, n, pendiente } = datos;
  const q = (y: number) => caudalManning(forma, y, baseM, taludZ, n, pendiente);

  let lo = 1e-6;
  let hi = 1;
  while (q(hi) < caudalM3s && hi < 1e5) hi *= 2;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (q(mid) < caudalM3s) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calcularCanalManning(datos: DatosCanalManning): ResultadoCanalManning {
  const tiranteM = resolverTiranteNormal(datos);
  const geometria = geometriaCanal(datos.forma, tiranteM, datos.baseM, datos.taludZ);
  const velocidadMs = datos.caudalM3s / geometria.areaM2;

  // Número de Froude con la profundidad hidráulica D = A/T (equivale a y en
  // un rectangular, pero no en trapecial ni en triangular).
  const profundidadHidraulicaM = geometria.areaM2 / geometria.anchoSuperficialM;
  const froude = velocidadMs / Math.sqrt(G * profundidadHidraulicaM);
  const regimen: RegimenCanal =
    Math.abs(froude - 1) < 0.02 ? "critico" : froude < 1 ? "subcritico" : "supercritico";

  return { tiranteM, ...geometria, velocidadMs, froude, regimen };
}
