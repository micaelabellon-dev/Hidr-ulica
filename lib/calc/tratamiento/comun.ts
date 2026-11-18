/**
 * Piezas comunes a las calculadoras de tratamiento de efluentes.
 */

/** Calidad de un efluente: concentraciones de los parámetros que se siguen en el tren. */
export interface CalidadEfluente {
  dbo: number; // mg/L
  sst: number; // mg/L
  cf: number; // UFC/100 mL
  nt: number; // mg/L
  nh4: number; // mg N/L
  pt: number; // mg/L
  ph: number;
}

export const NOMBRE_PARAMETRO: Record<keyof CalidadEfluente, string> = {
  dbo: "DBO₅",
  sst: "SST",
  cf: "Coliformes fecales",
  nt: "N total",
  nh4: "N amoniacal",
  pt: "P total",
  ph: "pH",
};

export const UNIDAD_PARAMETRO: Record<keyof CalidadEfluente, string> = {
  dbo: "mg/L",
  sst: "mg/L",
  cf: "UFC/100 mL",
  nt: "mg/L",
  nh4: "mg/L",
  pt: "mg/L",
  ph: "",
};

/** Redondeo hacia arriba a `decimales` (como ROUNDUP de Excel, para valores positivos). */
export function redondearArriba(x: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.ceil(x * f - 1e-9) / f;
}

/** Corrección de una constante cinética por temperatura: K_T = K_20 · θ^(T − 20). */
export const corregirTemperatura = (k20: number, theta: number, t: number) => k20 * theta ** (t - 20);

/**
 * Flujo disperso (Wehner y Wilhelm): fracción remanente de un decaimiento de
 * primer orden en un reactor con número de dispersión d.
 *   a = √(1 + 4·K·t·d)
 *   C/C0 = 4·a·e^(1/2d) / [(1 + a)²·e^(a/2d) − (1 − a)²·e^(−a/2d)]
 */
export function fraccionFlujoDisperso(k: number, t: number, d: number): { a: number; fraccion: number } {
  const a = Math.sqrt(1 + 4 * k * t * d);
  const fraccion =
    (4 * a * Math.exp(1 / (2 * d))) / ((1 + a) ** 2 * Math.exp(a / (2 * d)) - (1 - a) ** 2 * Math.exp(-a / (2 * d)));
  return { a, fraccion };
}

/** Volumen de un tronco de pirámide (laguna o lecho con taludes): H/3·(A1 + A2 + √(A1·A2)). */
export const volumenTroncoPiramide = (h: number, a1: number, a2: number) => (h / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
