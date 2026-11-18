/**
 * Dispersión gaussiana de una emisión continua por chimenea (modelo de pluma).
 *
 * Viento a la altura z (ley potencial):  u(z) = u1·(z/z1)^n, con n según la
 * estabilidad de Pasquill y el tipo de superficie.
 * Sobreelevación de Holland:  Δh = (vs·D/u)·[1,5 + c·p·D·(Ts − Ta)/Ts],
 * c = 2,68×10⁻³ (p en mb, D en m).  Altura efectiva H = hg + Δh.
 * Concentración:
 *   C(x,y,z) = Q/(2π·u·σy·σz) · e^(−y²/2σy²) · [e^(−(z−H)²/2σz²) + e^(−(z+H)²/2σz²)]
 * (el segundo término es la reflexión en el suelo; se puede omitir).
 * σy, σz: de Briggs (1973) para campo abierto o urbano, o cargados a mano.
 */

export type Estabilidad = "A" | "B" | "C" | "D" | "E" | "F";
export const ESTABILIDADES: Estabilidad[] = ["A", "B", "C", "D", "E", "F"];
export type Superficie = "urbana" | "rural";

/** Exponentes de la ley potencial del viento (EPA). */
export const EXPONENTE_VIENTO: Record<Superficie, Record<Estabilidad, number>> = {
  urbana: { A: 0.15, B: 0.15, C: 0.2, D: 0.25, E: 0.4, F: 0.6 },
  rural: { A: 0.07, B: 0.07, C: 0.1, D: 0.15, E: 0.35, F: 0.55 },
};

export const DESCRIPCION_ESTABILIDAD: Record<Estabilidad, string> = {
  A: "A · muy inestable",
  B: "B · moderadamente inestable",
  C: "C · levemente inestable",
  D: "D · neutra",
  E: "E · levemente estable",
  F: "F · moderadamente estable",
};

/** Coeficientes de dispersión de Briggs (1973), x en m. */
export function sigmasBriggs(x: number, est: Estabilidad, sup: Superficie): { sy: number; sz: number } {
  if (sup === "rural") {
    const fy = (k: number) => k * x * (1 + 0.0001 * x) ** -0.5;
    switch (est) {
      case "A":
        return { sy: fy(0.22), sz: 0.2 * x };
      case "B":
        return { sy: fy(0.16), sz: 0.12 * x };
      case "C":
        return { sy: fy(0.11), sz: 0.08 * x * (1 + 0.0002 * x) ** -0.5 };
      case "D":
        return { sy: fy(0.08), sz: 0.06 * x * (1 + 0.0015 * x) ** -0.5 };
      case "E":
        return { sy: fy(0.06), sz: (0.03 * x) / (1 + 0.0003 * x) };
      case "F":
        return { sy: fy(0.04), sz: (0.016 * x) / (1 + 0.0003 * x) };
    }
  }
  const fy = (k: number) => k * x * (1 + 0.0004 * x) ** -0.5;
  switch (est) {
    case "A":
    case "B":
      return { sy: fy(0.32), sz: 0.24 * x * (1 + 0.001 * x) ** 0.5 };
    case "C":
      return { sy: fy(0.22), sz: 0.2 * x };
    case "D":
      return { sy: fy(0.16), sz: 0.14 * x * (1 + 0.0003 * x) ** -0.5 };
    case "E":
    case "F":
      return { sy: fy(0.11), sz: 0.08 * x * (1 + 0.0015 * x) ** -0.5 };
  }
}

export interface DatosChimenea {
  alturaM: number; // hg
  diametroM: number;
  tempGasK: number;
  velocidadGasMs: number;
  emisionUgS: number;
  tempAireK: number;
  presionMb: number;
  superficie: Superficie;
  estabilidad: Estabilidad;
  /** Exponente n; si es null se toma de la tabla. */
  exponente: number | null;
  alturaRefM: number;
  vientoRefMs: number;
  coefHolland: number;
  reflexion: boolean;
  /** σ cargados a mano para el receptor; null para Briggs. */
  sigmasManual: { sy: number; sz: number } | null;
}

export interface ResultadoChimenea {
  n: number;
  vientoChimenea: number;
  sobreelevacion: number;
  alturaEfectiva: number;
  vientoEfectivo: number;
}

export function pluma(d: DatosChimenea): ResultadoChimenea {
  const n = d.exponente ?? EXPONENTE_VIENTO[d.superficie][d.estabilidad];
  const vientoChimenea = d.vientoRefMs * (d.alturaM / d.alturaRefM) ** n;
  const sobreelevacion =
    ((d.velocidadGasMs * d.diametroM) / vientoChimenea) *
    (1.5 + d.coefHolland * d.presionMb * d.diametroM * ((d.tempGasK - d.tempAireK) / d.tempGasK));
  const alturaEfectiva = d.alturaM + sobreelevacion;
  const vientoEfectivo = d.vientoRefMs * (alturaEfectiva / d.alturaRefM) ** n;
  return { n, vientoChimenea, sobreelevacion, alturaEfectiva, vientoEfectivo };
}

export function concentracion(
  d: DatosChimenea,
  p: ResultadoChimenea,
  x: number,
  y: number,
  z: number,
  sig?: { sy: number; sz: number }
): { c: number; sy: number; sz: number } {
  const { sy, sz } = sig ?? d.sigmasManual ?? sigmasBriggs(x, d.estabilidad, d.superficie);
  const H = p.alturaEfectiva;
  const vertical =
    Math.exp(-((z - H) ** 2) / (2 * sz ** 2)) + (d.reflexion ? Math.exp(-((z + H) ** 2) / (2 * sz ** 2)) : 0);
  const c = (d.emisionUgS / (2 * Math.PI * p.vientoEfectivo * sy * sz)) * Math.exp(-(y ** 2) / (2 * sy ** 2)) * vertical;
  return { c, sy, sz };
}

/** Concentración a nivel del suelo sobre el eje de la pluma, para x de 50 m a xMax (Briggs). */
export function perfilSuelo(d: DatosChimenea, p: ResultadoChimenea, xMax: number, puntos = 120) {
  const out: { x: number; c: number }[] = [];
  const x0 = 50;
  for (let i = 0; i <= puntos; i++) {
    const x = x0 * (xMax / x0) ** (i / puntos);
    out.push({ x, c: concentracion({ ...d, sigmasManual: null }, p, x, 0, 0).c });
  }
  const max = out.reduce((a, b) => (b.c > a.c ? b : a));
  return { perfil: out, maximo: max };
}

/** Emisión por factor de emisión: consumo de combustible × factor. */
export function emisionPorFactor(consumoKgH: number, factorKgPorTon: number): { kgS: number; ugS: number } {
  const kgS = (consumoKgH / 3600) * (factorKgPorTon / 1000);
  return { kgS, ugS: kgS * 1e9 };
}

export const LB_A_KG = 0.453592;
