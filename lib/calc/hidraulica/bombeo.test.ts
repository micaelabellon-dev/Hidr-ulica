import { describe, expect, it } from "vitest";
import {
  ajustarPolinomio,
  alturaSistema,
  calcularBombeo,
  CURVA_BOMBA_EJEMPLO,
  evaluarPolinomio,
  motorComercialKw,
  presionAtmosfericaKPa,
  presionVaporKPa,
  validarCurvaBomba,
  type DatosBombeo,
  type TramoTuberia,
} from "@/lib/calc/hidraulica/bombeo";
import { calcularPerdidaCarga } from "@/lib/calc/hidraulica/perdida-carga";

const tramo: TramoTuberia = {
  nombre: "Impulsión",
  longitudM: 150,
  diametroMm: 125,
  rugosidadMm: 0.0015,
  hazenC: 150,
  sumaK: 5,
  perdidaFijaM: 0,
  porBomba: false,
};
const puntos = validarCurvaBomba(CURVA_BOMBA_EJEMPLO, 2).puntos!;

const base: DatosBombeo = {
  tipo: "sumergible",
  hid: { metodo: "darcy-weisbach", temperaturaC: 20, g: 9.81, hazenCoef: 10.67, hazenExp: 1.852, densidad: 998.2 },
  caudalDisenoLs: 20,
  bombasOperacion: 1,
  bombasInstaladas: 2,
  cotaNivelMinimoM: 60,
  cotaNivelMaximoM: 75,
  cotaDescargaM: 100,
  presionDescargaM: 0,
  impulsion: [tramo],
  succion: null,
  coefSeguridad: 1,
  cotaEjeBombaM: 0,
  altitudMsnm: 0,
  npshrManualM: null,
  margenNpshM: 0.5,
  cotaAdmisionM: 50,
  sumergenciaMinimaM: 3,
  curvaBomba: puntos,
  gradoAjuste: 2,
  rendimientoBombaPct: 65,
  rendimientoMotorPct: 90,
};

describe("propiedades", () => {
  it("presión atmosférica: 101,3 kPa al nivel del mar y ~89,9 kPa a 1000 m", () => {
    expect(presionAtmosfericaKPa(0)).toBeCloseTo(101.325, 3);
    expect(presionAtmosfericaKPa(1000)).toBeCloseTo(89.87, 1);
  });
  it("presión de vapor a 20 °C ≈ 2,34 kPa e interpola", () => {
    expect(presionVaporKPa(20)).toBeCloseTo(2.338, 3);
    expect(presionVaporKPa(22.5)).toBeCloseTo((2.338 + 3.169) / 2, 3);
  });
  it("motor normalizado inmediato superior", () => {
    expect(motorComercialKw(4.3)).toBe(5.5);
    expect(motorComercialKw(1.5)).toBe(1.5);
  });
});

describe("ajustarPolinomio", () => {
  it("recupera exactamente una parábola", () => {
    const x = [0, 5, 10, 15, 20];
    const y = x.map((q) => 50 - 0.02 * q * q + 0.1 * q);
    const p = ajustarPolinomio(x, y, 2);
    expect(p.coef[0]).toBeCloseTo(50, 8);
    expect(p.coef[1]).toBeCloseTo(0.1, 8);
    expect(p.coef[2]).toBeCloseTo(-0.02, 8);
    expect(p.r2).toBeCloseTo(1, 10);
    expect(evaluarPolinomio(p.coef, 7)).toBeCloseTo(50 - 0.98 + 0.7, 8);
  });
});

describe("calcularBombeo", () => {
  it("la altura del sistema es estática + pérdidas de la impulsión", () => {
    const hf = calcularPerdidaCarga({ metodo: "darcy-weisbach", caudalLs: 20, temperaturaC: 20, ...tramo }).perdidaTotalM;
    expect(alturaSistema(base, 60, 20)).toBeCloseTo(40 + hf, 10);
  });

  it("el punto de operación cumple H_bomba = H_sistema y baja el caudal con nivel mínimo", () => {
    const r = calcularBombeo(base);
    const min = r.niveles.minimo.operacion!;
    const max = r.niveles.maximo.operacion!;
    expect(min.alturaM).toBeCloseTo(alturaSistema(base, 60, min.caudalTotalLs), 6);
    expect(max.alturaM).toBeCloseTo(alturaSistema(base, 75, max.caudalTotalLs), 6);
    expect(min.caudalTotalLs).toBeLessThan(max.caudalTotalLs);
    expect(min.potenciaHidraulicaKw).toBeCloseTo((998.2 * 9.81 * (min.caudalBombaLs / 1000) * min.alturaM) / 1000, 6);
    expect(min.potenciaEjeKw).toBeCloseTo(min.potenciaHidraulicaKw / (min.rendimientoPct / 100), 6);
    expect(r.niveles.minimo.sumergencia).toEqual({ disponibleM: 10, requeridaM: 3, cumple: true });
  });

  it("dos bombas en paralelo: la curva conjunta es H(Q/2)", () => {
    const r = calcularBombeo({ ...base, bombasOperacion: 2, bombasInstaladas: 3, caudalDisenoLs: 40 });
    const op = r.niveles.minimo.operacion!;
    expect(op.caudalBombaLs).toBeCloseTo(op.caudalTotalLs / 2, 10);
    expect(op.alturaM).toBeCloseTo(alturaSistema({ ...base, bombasOperacion: 2, caudalDisenoLs: 40 }, 60, op.caudalTotalLs), 6);
    expect(r.bombasReserva).toBe(1);
  });

  it("sin curva calcula alturas y potencia con los rendimientos fijos", () => {
    const r = calcularBombeo({ ...base, curvaBomba: [] });
    expect(r.curva).toBeNull();
    expect(r.niveles.minimo.operacion).toBeNull();
    expect(r.diseno.rendimientoPct).toBe(65);
    expect(r.diseno.potenciaMotorKw).toBeCloseTo(r.diseno.potenciaHidraulicaKw / 0.65 / 0.9, 10);
  });

  it("avisa cuando la bomba no llega a la altura estática", () => {
    const r = calcularBombeo({ ...base, cotaDescargaM: 200 });
    expect(r.niveles.minimo.operacion).toBeNull();
    expect(r.niveles.minimo.motivoSinOperacion).toMatch(/no llega/);
  });

  it("NPSH disponible con bomba de aspiración", () => {
    const r = calcularBombeo({
      ...base,
      tipo: "aspiracion",
      succion: { ...tramo, nombre: "Succión", longitudM: 8, diametroMm: 150, sumaK: 2 },
      cotaNivelMinimoM: 95,
      cotaNivelMaximoM: 97,
      cotaEjeBombaM: 99,
      cotaDescargaM: 130,
    });
    const n = r.niveles.minimo.npsh!;
    expect(n.alturaAspiracionM).toBe(4);
    expect(n.npshdM).toBeCloseTo(n.patmM - n.pvM - 4 - n.hfSuccionM, 10);
    expect(n.patmM).toBeCloseTo(101.325 / ((998.2 * 9.81) / 1000), 3);
    expect(n.npshrM).not.toBeNull();
  });
});

describe("paridad con una planilla de estación de bombeo (PEAD SDR 17, Hazen-Williams 10,643 / 1,85, g = 9,8)", () => {
  const hid = { metodo: "hazen-williams" as const, temperaturaC: 20, g: 9.8, hazenCoef: 10.643, hazenExp: 1.85, densidad: 1000 };
  const manifold: TramoTuberia = {
    nombre: "Manifold DN110",
    longitudM: 4,
    diametroMm: 96.8,
    rugosidadMm: 0,
    hazenC: 150,
    sumaK: 0.5 + 3 * 0.3 + 2 * 0.6 + 2 * 0.9 + 0.2 + 2.5,
    perdidaFijaM: 0.02,
    porBomba: true,
  };
  const datos = (impulsion: TramoTuberia): DatosBombeo => ({
    ...base,
    hid,
    caudalDisenoLs: 12.5,
    bombasOperacion: 1,
    bombasInstaladas: 2,
    cotaNivelMinimoM: 1.43,
    cotaNivelMaximoM: 2.43,
    cotaDescargaM: 5.79,
    impulsion: [manifold, impulsion],
    curvaBomba: [],
    coefSeguridad: 1.1,
    rendimientoBombaPct: 65,
    rendimientoMotorPct: 70,
  });

  it("impulsión DN110: H mín, media, máx, ajustada y potencias", () => {
    const r = calcularBombeo(
      datos({ nombre: "Impulsión DN110", longitudM: 378, diametroMm: 96.8, rugosidadMm: 0, hazenC: 150, sumaK: 0.3 + 1.8 + 0.4 + 1, perdidaFijaM: 0, porBomba: false })
    );
    expect(r.alturas.maximo.alturaTotalM).toBeCloseTo(14.973191145465853, 9);
    expect(r.alturas.medio.alturaTotalM).toBeCloseTo(15.473191145465853, 9);
    expect(r.alturas.minimo.alturaTotalM).toBeCloseTo(15.973191145465853, 9);
    expect(r.alturaAjustadaM).toBeCloseTo(17.57051026001244, 9);
    expect(r.diseno.potenciaHidraulicaKw).toBeCloseTo(1.9567159153195672, 9);
    expect(r.diseno.potenciaEjeKw).toBeCloseTo(3.010332177414719, 9);
    expect(r.diseno.potenciaMotorKw).toBeCloseTo(4.300474539163885, 9);
    expect(r.diseno.motorComercialKw).toBe(5.5);
  });

  it("impulsión DN160: H máx", () => {
    const r = calcularBombeo(
      datos({ nombre: "Impulsión DN160", longitudM: 378, diametroMm: 141, rugosidadMm: 0, hazenC: 150, sumaK: 0.3 + 1.8 + 0.4 + 1, perdidaFijaM: 0, porBomba: false })
    );
    expect(r.alturas.minimo.alturaTotalM).toBeCloseTo(7.2344697980238895, 9);
  });
});

describe("validarCurvaBomba", () => {
  it("pide suficientes puntos y rechaza caudales repetidos; vacía es válida", () => {
    expect(validarCurvaBomba([["0", "10"], ["5", "8"]], 2).errores[0]).toMatch(/al menos 3/);
    expect(validarCurvaBomba([["0", "10"], ["5", "8"], ["5", "7"]], 2).errores.join()).toMatch(/repetido/);
    expect(validarCurvaBomba([["", "", "", ""]], 2)).toEqual({ puntos: [], errores: [] });
  });
});
