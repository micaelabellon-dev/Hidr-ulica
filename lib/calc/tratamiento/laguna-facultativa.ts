import {
  corregirTemperatura,
  fraccionFlujoDisperso,
  redondearArriba,
  volumenTroncoPiramide,
  type CalidadEfluente,
} from "@/lib/calc/tratamiento/comun";

/**
 * Laguna facultativa primaria o secundaria (von Sperling, 2007).
 *
 * Área por carga superficial admisible según la temperatura del mes más frío:
 *   Ls = 350·(1,107 − 0,002·T)^(T − 25)       [kg DBO/ha·d]
 *   A  = L / Ls,   L = Q·DBO                    [kg DBO/d]
 * La planta se redondea hacia arriba: L a 0,1 kg/d, Ls al entero, el ancho a 0,1 m.
 *
 * Volumen: tronco de pirámide con talud z (H:V) en todo el perímetro, para la
 * laguna limpia (profundidad H) y con el lodo acumulado (H − h_lodo).
 *
 * Remociones, con el tiempo de retención t = V/Q y flujo disperso:
 *   d = (L/B) / (−0,261 + 0,254·(L/B) + c·(L/B)²)     (Yánez / Agunwamba; c editable)
 *   DBO soluble: K20 = 0,132·log10(Ls) − 0,146, θ = 1,035, Wehner-Wilhelm
 *   DBO particulada = (DBO/SS) · SS de salida, con SS removidos en un %
 *   CF: Kb20 = 0,542·H^−1,259, θ = 1,07, Wehner-Wilhelm
 *   N total:  N = N0 / [1 + t·(0,000576·T − 0,00028)·e^((1,08 − 0,042·T)(pH − 6,6))]
 *   N amon.:  N = N0 / [1 + (A/Q)·(0,0038 + 0,000134·T)·e^(1,54·(pH − 6,6))]
 *   P: remoción en %
 * Lodo: tasa de acumulación por habitante → años entre limpiezas.
 */

export interface DatosLaguna {
  caudalM3d: number;
  afluente: CalidadEfluente;
  temperaturaC: number;
  habitantes: number;
  relacionLB: number;
  profundidadM: number;
  alturaLodoM: number;
  /** Talud interno, horizontal por cada vertical. */
  taludZ: number;
  coefDispersion: number;
  remocionSsPct: number;
  dboPorSs: number;
  thetaDbo: number;
  thetaCf: number;
  remocionPPct: number;
  tasaLodoM3HabAnio: number;
}

export interface EscenarioLaguna {
  profundidadM: number;
  largoFondoM: number;
  anchoFondoM: number;
  areaFondoM2: number;
  volumenM3: number;
  tiempoRetencionD: number;
  kDbo: number;
  aDbo: number;
  dboSolubleMgL: number;
  dboParticuladaMgL: number;
  kbCf: number;
  aCf: number;
  efluente: CalidadEfluente;
}

export interface ResultadoLaguna {
  cargaKgD: number;
  cargaSuperficialKgHaD: number;
  areaNecesariaM2: number;
  anchoM: number;
  largoM: number;
  areaM2: number;
  numeroDispersion: number;
  k20Dbo: number;
  limpia: EscenarioLaguna;
  sucia: EscenarioLaguna;
  lodo: { volumenM3: number; acumulacionM3Anio: number; aniosEntreLimpiezas: number };
}

export function cargaSuperficialAdmisible(t: number): number {
  return 350 * (1.107 - 0.002 * t) ** (t - 25);
}

export function numeroDispersion(lb: number, c: number): number {
  return lb / (-0.261 + 0.254 * lb + c * lb ** 2);
}

export function calcularLaguna(d: DatosLaguna): ResultadoLaguna {
  const af = d.afluente;
  const cargaKgD = redondearArriba((redondearArriba(d.caudalM3d, 1) * af.dbo) / 1000, 1);
  const cargaSuperficialKgHaD = redondearArriba(cargaSuperficialAdmisible(d.temperaturaC), 0);
  const areaNecesariaM2 = redondearArriba((cargaKgD / cargaSuperficialKgHaD) * 10000, 1);
  const anchoM = redondearArriba(Math.sqrt(areaNecesariaM2 / d.relacionLB), 1);
  const largoM = d.relacionLB * anchoM;
  const areaM2 = redondearArriba(largoM * anchoM, 1);
  const lb = largoM / anchoM;
  const dd = numeroDispersion(lb, d.coefDispersion);
  const k20Dbo = 0.132 * Math.log10(cargaSuperficialKgHaD) - 0.146;

  const escenario = (h: number): EscenarioLaguna => {
    const largoFondoM = largoM - 2 * d.taludZ * h;
    const anchoFondoM = anchoM - 2 * d.taludZ * h;
    const areaFondoM2 = largoFondoM * anchoFondoM;
    const volumenM3 = volumenTroncoPiramide(h, areaM2, areaFondoM2);
    const t = volumenM3 / d.caudalM3d;
    const kDbo = corregirTemperatura(k20Dbo, d.thetaDbo, d.temperaturaC);
    const dbo = fraccionFlujoDisperso(kDbo, t, dd);
    const sstSalida = af.sst * (1 - d.remocionSsPct / 100);
    const dboSolubleMgL = af.dbo * dbo.fraccion;
    const dboParticuladaMgL = d.dboPorSs * sstSalida;
    // Kb del perfil "limpio": la planilla usa la profundidad de cada escenario.
    const kbCf = corregirTemperatura(0.542 * h ** -1.259, d.thetaCf, d.temperaturaC);
    const cf = fraccionFlujoDisperso(kbCf, t, dd);
    const T = d.temperaturaC;
    const nt = af.nt / (1 + t * (0.000576 * T - 0.00028) * Math.exp((1.08 - 0.042 * T) * (af.ph - 6.6)));
    const nh4 = af.nh4 / (1 + (areaM2 / d.caudalM3d) * (0.0038 + 0.000134 * T) * Math.exp(1.54 * (af.ph - 6.6)));
    return {
      profundidadM: h,
      largoFondoM,
      anchoFondoM,
      areaFondoM2,
      volumenM3,
      tiempoRetencionD: t,
      kDbo,
      aDbo: dbo.a,
      dboSolubleMgL,
      dboParticuladaMgL,
      kbCf,
      aCf: cf.a,
      efluente: {
        dbo: dboSolubleMgL + dboParticuladaMgL,
        sst: sstSalida,
        cf: af.cf * cf.fraccion,
        nt,
        nh4,
        pt: af.pt * (1 - d.remocionPPct / 100),
        ph: af.ph,
      },
    };
  };

  const limpia = escenario(d.profundidadM);
  const sucia = escenario(d.profundidadM - d.alturaLodoM);
  const acumulacionM3Anio = d.tasaLodoM3HabAnio * d.habitantes;
  const volumenLodo = limpia.volumenM3 - sucia.volumenM3;

  return {
    cargaKgD,
    cargaSuperficialKgHaD,
    areaNecesariaM2,
    anchoM,
    largoM,
    areaM2,
    numeroDispersion: dd,
    k20Dbo,
    limpia,
    sucia,
    lodo: { volumenM3: volumenLodo, acumulacionM3Anio, aniosEntreLimpiezas: volumenLodo / acumulacionM3Anio },
  };
}
