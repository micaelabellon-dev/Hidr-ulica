import { describe, expect, it } from "vitest";
import {
  ajustarPolinomio,
  alturaSistema,
  calcularBombeo,
  CURVA_BOMBA_EJEMPLO,
  evaluarPolinomio,
  presionAtmosfericaKPa,
  presionVaporKPa,
  validarCurvaBomba,
  type DatosBombeo,
} from "@/lib/calc/hidraulica/bombeo";
import { calcularPerdidaCarga } from "@/lib/calc/hidraulica/perdida-carga";

const tramo = { longitudM: 150, diametroMm: 125, rugosidadMm: 0.0015, hazenC: 150, sumaK: 5 };
const puntos = validarCurvaBomba(CURVA_BOMBA_EJEMPLO, 2).puntos!;

const base: DatosBombeo = {
  tipo: "sumergible",
  metodo: "darcy-weisbach",
  temperaturaC: 20,
  caudalDisenoLs: 20,
  cotaNivelMinimoM: 60,
  cotaNivelMaximoM: 75,
  cotaDescargaM: 100,
  presionDescargaM: 0,
  impulsion: tramo,
  succion: null,
  cotaEjeBombaM: 0,
  altitudMsnm: 0,
  npshrManualM: null,
  margenNpshM: 0.5,
  cotaAdmisionM: 50,
  sumergenciaMinimaM: 3,
  curvaBomba: puntos,
  gradoAjuste: 2,
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
    expect(min.alturaM).toBeCloseTo(alturaSistema(base, 60, min.caudalLs), 6);
    expect(max.alturaM).toBeCloseTo(alturaSistema(base, 75, max.caudalLs), 6);
    expect(min.caudalLs).toBeLessThan(max.caudalLs);
    // Potencia hidráulica = ρgQH
    expect(min.potenciaHidraulicaKw).toBeCloseTo((998.2 * 9.81 * (min.caudalLs / 1000) * min.alturaM) / 1000, 6);
    expect(min.potenciaEjeKw!).toBeCloseTo(min.potenciaHidraulicaKw / (min.rendimientoPct! / 100), 6);
    expect(r.niveles.minimo.sumergencia).toEqual({ disponibleM: 10, requeridaM: 3, cumple: true });
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
      succion: { longitudM: 8, diametroMm: 150, rugosidadMm: 0.0015, hazenC: 150, sumaK: 2 },
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

describe("validarCurvaBomba", () => {
  it("pide suficientes puntos y rechaza caudales repetidos", () => {
    expect(validarCurvaBomba([["0", "10"], ["5", "8"]], 2).errores[0]).toMatch(/al menos 3/);
    expect(validarCurvaBomba([["0", "10"], ["5", "8"], ["5", "7"]], 2).errores.join()).toMatch(/repetido/);
  });
});
