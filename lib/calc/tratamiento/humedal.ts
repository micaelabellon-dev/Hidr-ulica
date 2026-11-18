import { redondearArriba, type CalidadEfluente } from "@/lib/calc/tratamiento/comun";

/**
 * Humedal de flujo vertical (filtro plantado).
 *
 * Área por tasa de carga hidráulica: A = Q / HLR, repartida en trenes, con
 * relación L/B; se redondea hacia arriba a 0,1 m² y 0,1 m como en proyecto.
 * Tiempo de retención en el medio: T = Σ(nᵢ·hᵢ) / HLR (porosidad y espesor de
 * cada capa).
 * Remociones adoptadas por parámetro, en % (valores de diseño de bibliografía).
 *
 * Verificación por el modelo P-k-C* (Kadlec y Wallace, 2009), para un
 * parámetro con concentración de fondo C*:
 *   A = (P·Q·365 / k) · [((C_in − C*)/(C_e − C*))^(1/P) − 1]      (k en m/año)
 */

export interface CapaFiltrante {
  nombre: string;
  espesorM: number;
  porosidad: number;
}

export interface DatosHumedal {
  caudalM3d: number;
  afluente: CalidadEfluente;
  tasaCargaHidraulica: number; // m³/m²·d
  trenes: number;
  relacionLB: number;
  capas: CapaFiltrante[];
  remocionesPct: Record<"dbo" | "sst" | "cf" | "nh4" | "pt" | "nt", number>;
  /** Talud de las capas (H:V) para los volúmenes de material. */
  taludZ: number;
  kadlec: { parametro: "nh4" | "dbo" | "nt"; cEfluente: number; cFondo: number; p: number; kMAnio: number } | null;
}

export interface ResultadoHumedal {
  areaNecesariaM2: number;
  areaPorTrenM2: number;
  anchoM: number;
  largoM: number;
  areaTotalM2: number;
  tasaRealM3m2d: number;
  cargaOrganicaGm2d: number;
  tiempoRetencionD: number;
  efluente: CalidadEfluente;
  capas: (CapaFiltrante & { areaSuperiorM2: number; areaInferiorM2: number; volumenPorTrenM3: number; volumenTotalM3: number })[];
  kadlec: { areaM2: number; cociente: number; cumpleConArea: boolean } | null;
}

export function areaKadlec(q: number, cIn: number, cE: number, cFondo: number, p: number, kMAnio: number) {
  const cociente = (cIn - cFondo) / (cE - cFondo);
  return { cociente, areaM2: ((p * q * 365) / kMAnio) * (cociente ** (1 / p) - 1) };
}

export function calcularHumedal(d: DatosHumedal): ResultadoHumedal {
  const areaNecesariaM2 = redondearArriba(d.caudalM3d / d.tasaCargaHidraulica, 1);
  const areaPorTrenM2 = redondearArriba(areaNecesariaM2 / d.trenes, 1);
  const anchoM = redondearArriba(Math.sqrt(areaPorTrenM2 / d.relacionLB), 1);
  const largoM = redondearArriba(anchoM * d.relacionLB, 1);
  const areaTotalM2 = redondearArriba(d.trenes * largoM * anchoM, 1);
  const r = d.remocionesPct;
  const af = d.afluente;
  const efluente: CalidadEfluente = {
    dbo: af.dbo * (1 - r.dbo / 100),
    sst: af.sst * (1 - r.sst / 100),
    cf: af.cf * (1 - r.cf / 100),
    nt: af.nt * (1 - r.nt / 100),
    nh4: af.nh4 * (1 - r.nh4 / 100),
    pt: af.pt * (1 - r.pt / 100),
    ph: af.ph,
  };

  let prof = 0;
  const capas = d.capas.map((c) => {
    const lSup = largoM - 2 * d.taludZ * prof;
    const bSup = anchoM - 2 * d.taludZ * prof;
    prof += c.espesorM;
    const lInf = largoM - 2 * d.taludZ * prof;
    const bInf = anchoM - 2 * d.taludZ * prof;
    const areaSuperiorM2 = lSup * bSup;
    const areaInferiorM2 = lInf * bInf;
    const volumenPorTrenM3 = (c.espesorM / 3) * (areaSuperiorM2 + areaInferiorM2 + Math.sqrt(areaSuperiorM2 * areaInferiorM2));
    return { ...c, areaSuperiorM2, areaInferiorM2, volumenPorTrenM3, volumenTotalM3: volumenPorTrenM3 * d.trenes };
  });

  let kadlec: ResultadoHumedal["kadlec"] = null;
  if (d.kadlec) {
    const cIn = af[d.kadlec.parametro];
    const k = areaKadlec(d.caudalM3d, cIn, d.kadlec.cEfluente, d.kadlec.cFondo, d.kadlec.p, d.kadlec.kMAnio);
    kadlec = { ...k, cumpleConArea: areaTotalM2 >= k.areaM2 };
  }

  return {
    areaNecesariaM2,
    areaPorTrenM2,
    anchoM,
    largoM,
    areaTotalM2,
    tasaRealM3m2d: d.caudalM3d / areaTotalM2,
    cargaOrganicaGm2d: (d.caudalM3d * af.dbo) / areaTotalM2,
    tiempoRetencionD: d.capas.reduce((s, c) => s + c.porosidad * c.espesorM, 0) / d.tasaCargaHidraulica,
    efluente,
    capas,
    kadlec,
  };
}
