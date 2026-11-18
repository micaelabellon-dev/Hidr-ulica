import { describe, expect, it } from "vitest";
import { calcularLaguna, type DatosLaguna } from "@/lib/calc/tratamiento/laguna-facultativa";
import { areaKadlec, calcularHumedal } from "@/lib/calc/tratamiento/humedal";
import { calcularCloracion } from "@/lib/calc/tratamiento/cloracion";

// Planilla PALMITAS: escenario FINAL (748 hab), efluente de fosa séptica.
const laguna: DatosLaguna = {
  caudalM3d: 138.6700719,
  afluente: { dbo: 175.308195, sst: 88, cf: 5168774.269, nt: 40.5, nh4: 35, pt: 8.5, ph: 7 },
  temperaturaC: 12,
  habitantes: 748,
  relacionLB: 2,
  profundidadM: 1.5,
  alturaLodoM: 0.2,
  taludZ: 2,
  coefDispersion: 1.1014,
  remocionSsPct: 50,
  dboPorSs: 0.3,
  thetaDbo: 1.035,
  thetaCf: 1.07,
  remocionPPct: 10,
  tasaLodoM3HabAnio: 0.04,
};

describe("laguna facultativa (planilla PALMITAS)", () => {
  const r = calcularLaguna(laguna);
  it("dimensiones", () => {
    expect(r.cargaKgD).toBeCloseTo(24.4, 10);
    expect(r.cargaSuperficialKgHaD).toBe(125);
    expect(r.areaNecesariaM2).toBeCloseTo(1952, 9);
    expect(r.anchoM).toBeCloseTo(31.3, 10);
    expect(r.largoM).toBeCloseTo(62.6, 10);
    expect(r.areaM2).toBeCloseTo(1959.4, 9);
    expect(r.limpia.volumenM3).toBeCloseTo(2533.219345, 5);
    expect(r.sucia.volumenM3).toBeCloseTo(2240.704747, 5);
  });
  it("remociones, laguna limpia", () => {
    expect(r.limpia.tiempoRetencionD).toBeCloseTo(18.26796013, 7);
    expect(r.numeroDispersion).toBeCloseTo(0.429867171, 8);
    expect(r.limpia.kDbo).toBeCloseTo(0.09932504869, 10);
    expect(r.limpia.dboSolubleMgL).toBeCloseTo(46.85494216, 6);
    expect(r.limpia.efluente.dbo).toBeCloseTo(60.05494216, 6);
    expect(r.limpia.efluente.cf).toBeCloseTo(615249.0907, 2);
    expect(r.limpia.efluente.nt).toBeCloseTo(35.13964673, 6);
    expect(r.limpia.efluente.nh4).toBeCloseTo(30.66188293, 6);
    expect(r.limpia.efluente.pt).toBeCloseTo(7.65, 10);
  });
  it("laguna sucia y lodos", () => {
    expect(r.sucia.efluente.dbo).toBeCloseTo(66.06917532, 6);
    expect(r.sucia.efluente.cf).toBeCloseTo(563457.9388, 2);
    expect(r.lodo.aniosEntreLimpiezas).toBeCloseTo(9.776557397, 7);
  });
  it("escenario INICIAL (472 hab)", () => {
    const i = calcularLaguna({ ...laguna, caudalM3d: 87.50304, habitantes: 472, afluente: { ...laguna.afluente } });
    // La planilla dimensiona con el FINAL y verifica el INICIAL con ese mismo volumen;
    // con el volumen del final y el caudal inicial: t = 2533,22/87,503 = 28,95 d.
    expect(2533.219345 / 87.50304).toBeCloseTo(28.95007242, 6);
    expect(i.cargaSuperficialKgHaD).toBe(125);
  });
});

describe("humedal vertical (planilla PALMITAS, inicial: 2 trenes)", () => {
  const r = calcularHumedal({
    caudalM3d: 87.50304,
    afluente: { dbo: 60.05494216, sst: 44, cf: 615249.0907, nt: 35.13964673, nh4: 30.66188293, pt: 7.65, ph: 7 },
    tasaCargaHidraulica: 0.12,
    trenes: 2,
    relacionLB: 1.5,
    capas: [
      { nombre: "Arena gruesa", espesorM: 0.5, porosidad: 0.35 },
      { nombre: "Grava", espesorM: 0.1, porosidad: 0.3 },
      { nombre: "Grava gruesa", espesorM: 0.2, porosidad: 0.25 },
    ],
    remocionesPct: { dbo: 90, sst: 90, cf: 99, nh4: 90, pt: 10, nt: 0 },
    taludZ: 2,
    kadlec: { parametro: "nh4", cEfluente: 5, cFondo: 1.5, p: 3, kMAnio: 26.5 },
  });
  it("dimensiones y retención", () => {
    expect(r.areaNecesariaM2).toBeCloseTo(729.2, 9);
    expect(r.areaPorTrenM2).toBeCloseTo(364.6, 9);
    expect(r.anchoM).toBeCloseTo(15.6, 10);
    expect(r.largoM).toBeCloseTo(23.4, 10);
    expect(r.areaTotalM2).toBeCloseTo(730.1, 9);
    expect(r.tiempoRetencionD).toBeCloseTo(2.125, 10);
  });
  it("remociones y capas", () => {
    expect(r.efluente.dbo).toBeCloseTo(6.005494216, 8);
    expect(r.efluente.cf).toBeCloseTo(6152.490907, 3);
    expect(r.efluente.nh4).toBeCloseTo(3.066188293, 8);
    expect(r.efluente.pt).toBeCloseTo(6.885, 10);
    expect(r.capas[0].volumenPorTrenM3).toBeCloseTo(163.6711142, 6);
    expect(r.capas[1].volumenPorTrenM3).toBeCloseTo(28.40919054, 6);
    expect(r.capas[2].volumenPorTrenM3).toBeCloseTo(52.74543529, 6);
  });
  it("P-k-C* de Kadlec", () => {
    expect(areaKadlec(87.50304, 30.66188293, 5, 1.5, 3, 26.5).areaM2).toBeCloseTo(3714.363222, 5);
  });
});

describe("cloración (planilla PALMITAS)", () => {
  const r = calcularCloracion({
    caudalM3d: 138.6700719,
    cfInicial: 6152.490907,
    cfFinal: 0.5,
    tiempoMin: 30,
    lambda20: 2,
    q10: 2.5,
    temperaturaC: 12,
    n: 1,
    residualMgL: 1,
    demandaInmediataMgL: 5,
    consumoPrevioMgL: 1.5,
    redondearDosis: true,
    fraccionActiva: 0.1,
    densidadGmL: 1.2,
    horasDosificacion: 24,
    camara: { largoM: 2, anchoM: 2 },
    tuberiaDiametroM: 0.2 - 2 * (0.16 / 17),
  });
  it("Chick-Watson, dosis y producto", () => {
    expect(r.lambdaT).toBeCloseTo(0.9608995472, 10);
    expect(r.concentracionMgL).toBeCloseTo(0.1418837515, 10);
    expect(r.remocionPct).toBeCloseTo(99.99187321, 7);
    expect(r.dosisTotalMgL).toBe(8);
    expect(r.masaCloroGd).toBeCloseTo(1109.360575, 5);
    expect(r.masaProductoGd).toBeCloseTo(11093.60575, 4);
    expect(r.volumenProductoLd).toBeCloseTo(9.244671458, 8);
  });
  it("contacto", () => {
    expect(r.volumenContactoM3).toBeCloseTo(2.888959831, 8);
    expect(r.alturaCamaraM).toBeCloseTo(0.7222399576, 9);
    expect(r.largoTuberiaM).toBeCloseTo(112.0593326, 6);
  });
});
