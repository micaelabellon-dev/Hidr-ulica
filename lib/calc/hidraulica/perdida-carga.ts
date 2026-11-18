import { viscosidadCinematicaAgua } from "@/lib/calc/hidraulica/materiales";

/**
 * Pérdida de carga en un tramo de tubería a presión, por Darcy-Weisbach (con
 * el factor de fricción de Colebrook-White, resuelto por iteración punto fijo
 * a partir de la aproximación explícita de Swamee-Jain) o por Hazen-Williams.
 *
 * hf = f · (L/D) · V²/(2g)                              Darcy-Weisbach
 * 1/√f = -2·log10( (ε/D)/3.7 + 2.51/(Re·√f) )            Colebrook-White
 * hf = 10.67 · L · (Q/C)^1.852 / D^4.87                  Hazen-Williams (SI, Q en m³/s, D en m)
 */

export const G = 9.81;

export type MetodoPerdidaCarga = "darcy-weisbach" | "hazen-williams";
export type RegimenFlujo = "laminar" | "transicion" | "turbulento";

export interface DatosPerdidaCarga {
  metodo: MetodoPerdidaCarga;
  /** Caudal, en L/s. */
  caudalLs: number;
  diametroMm: number;
  longitudM: number;
  /** Rugosidad absoluta ε, en mm — sólo para Darcy-Weisbach. */
  rugosidadMm: number;
  /** Coeficiente C — sólo para Hazen-Williams. */
  hazenC: number;
  /** Temperatura del agua, en °C — define la viscosidad para Reynolds. */
  temperaturaC: number;
  /** Suma de coeficientes K de accesorios (codos, válvulas, entradas…). */
  sumaK: number;
  /** Gravedad, m/s². Por defecto 9,81. */
  g?: number;
  /**
   * Coeficiente y exponente de Hazen-Williams. Por defecto 10,67 y 1,852 (SI);
   * muchas planillas usan 10,643 y 1,85, que dan ~1,5 % menos.
   */
  hazenCoef?: number;
  hazenExp?: number;
}

export interface ResultadoPerdidaCarga {
  caudalM3s: number;
  areaM2: number;
  velocidadMs: number;
  /** Sólo con Darcy-Weisbach: Hazen-Williams no pasa por Reynolds. */
  reynolds: number | null;
  regimen: RegimenFlujo | null;
  factorFriccion: number | null;
  pendienteHidraulica: number;
  perdidaFriccionM: number;
  perdidaLocalizadaM: number;
  perdidaTotalM: number;
  perdidaTotalKPa: number;
}

/**
 * Colebrook-White por punto fijo sobre x = 1/√f, arrancando de la
 * aproximación explícita de Swamee-Jain. Converge en pocas vueltas para el
 * rango de rugosidad relativa y Reynolds de proyecto; 30 iteraciones da
 * margen de sobra sin costo perceptible.
 */
export function factorFriccionColebrook(reynolds: number, rugosidadRelativa: number): number {
  const f0 =
    0.25 / Math.log10(rugosidadRelativa / 3.7 + 5.74 / Math.pow(reynolds, 0.9)) ** 2;
  let x = 1 / Math.sqrt(f0);
  for (let i = 0; i < 30; i++) {
    x = -2 * Math.log10(rugosidadRelativa / 3.7 + (2.51 * x) / reynolds);
  }
  return 1 / x ** 2;
}

export function calcularPerdidaCarga(datos: DatosPerdidaCarga): ResultadoPerdidaCarga {
  const g = datos.g ?? G;
  const hazenCoef = datos.hazenCoef ?? 10.67;
  const hazenExp = datos.hazenExp ?? 1.852;
  const caudalM3s = datos.caudalLs / 1000;
  const diametroM = datos.diametroMm / 1000;
  const areaM2 = (Math.PI * diametroM ** 2) / 4;
  const velocidadMs = caudalM3s / areaM2;

  let reynolds: number | null = null;
  let regimen: RegimenFlujo | null = null;
  let factorFriccion: number | null = null;
  let perdidaFriccionM: number;

  if (datos.metodo === "darcy-weisbach") {
    const nu = viscosidadCinematicaAgua(datos.temperaturaC);
    reynolds = (velocidadMs * diametroM) / nu;
    regimen = reynolds < 2300 ? "laminar" : reynolds < 4000 ? "transicion" : "turbulento";
    factorFriccion =
      regimen === "laminar"
        ? 64 / reynolds
        : factorFriccionColebrook(reynolds, datos.rugosidadMm / 1000 / diametroM);
    perdidaFriccionM =
      factorFriccion * (datos.longitudM / diametroM) * (velocidadMs ** 2 / (2 * g));
  } else {
    perdidaFriccionM =
      (hazenCoef * datos.longitudM * (caudalM3s / datos.hazenC) ** hazenExp) / diametroM ** 4.87;
  }

  const perdidaLocalizadaM = datos.sumaK * (velocidadMs ** 2 / (2 * g));
  const perdidaTotalM = perdidaFriccionM + perdidaLocalizadaM;

  return {
    caudalM3s,
    areaM2,
    velocidadMs,
    reynolds,
    regimen,
    factorFriccion,
    pendienteHidraulica: perdidaFriccionM / datos.longitudM,
    perdidaFriccionM,
    perdidaLocalizadaM,
    perdidaTotalM,
    perdidaTotalKPa: perdidaTotalM * g,
  };
}
