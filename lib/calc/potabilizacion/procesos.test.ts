import { describe, expect, it } from "vitest";
import { concentracion, pluma, emisionPorFactor, LB_A_KG, sigmasBriggs, type DatosChimenea } from "@/lib/calc/aire/dispersion";
import { evaluarCumplimiento } from "@/lib/calc/aire/cumplimiento";
import { parshall, PARSHALL, placaOrificio } from "@/lib/calc/potabilizacion/mezcla-rapida";
import { ajusteGT, floculadorPaletas, floculadorTabiques, gradienteTuberia } from "@/lib/calc/potabilizacion/floculacion";
import { decantadorConvencional, decantadorLaminar, stokes } from "@/lib/calc/potabilizacion/sedimentacion";
import { calcularDaf } from "@/lib/calc/potabilizacion/daf";

const chimenea: DatosChimenea = {
  alturaM: 20,
  diametroM: 0.5,
  tempGasK: 403,
  velocidadGasMs: 15,
  emisionUgS: 1e10,
  tempAireK: 293,
  presionMb: 1013,
  superficie: "urbana",
  estabilidad: "A",
  exponente: null,
  alturaRefM: 10,
  vientoRefMs: 10,
  coefHolland: 2.6e-3,
  reflexion: false,
  sigmasManual: { sy: 114, sz: 112.5 },
};

describe("dispersión gaussiana (planilla geca)", () => {
  it("estabilidad A con σ leídos del gráfico", () => {
    const p = pluma(chimenea);
    expect(p.vientoChimenea).toBeCloseTo(11.09569472, 7);
    expect(p.sobreelevacion).toBeCloseTo(1.25687372, 7);
    expect(p.vientoEfectivo).toBeCloseTo(11.19759895, 7);
    expect(concentracion(chimenea, p, 500, 0, 0).c).toBeCloseTo(10886.42379, 4);
  });
  it("estabilidad F", () => {
    const d = { ...chimenea, estabilidad: "F" as const, sigmasManual: { sy: 18, sz: 7 } };
    const p = pluma(d);
    expect(p.sobreelevacion).toBeCloseTo(0.9200854173, 8);
    expect(concentracion(d, p, 500, 0, 0).c).toBeCloseTo(9324.643621, 4);
  });
  it("reflexión y Briggs", () => {
    const d = { ...chimenea, reflexion: true };
    const p = pluma(d);
    expect(concentracion(d, p, 500, 0, 0).c).toBeCloseTo(2 * 10886.42379, 3);
    expect(sigmasBriggs(1000, "D", "rural").sz).toBeCloseTo((0.06 * 1000) / Math.sqrt(2.5), 9);
  });
  it("emisión por factor de leña (lb/t → kg/kg)", () => {
    expect(emisionPorFactor(2400, 34.6 * LB_A_KG).ugS).toBeCloseTo(10462855.47, 1);
  });
});

describe("cumplimiento", () => {
  it("promedios diarios y del período", () => {
    const r = evaluarCumplimiento(
      [
        { dia: "1", valor: 40 },
        { dia: "1", valor: 60 },
        { dia: "2", valor: 10 },
      ],
      45,
      20
    );
    expect(r.maximoDiario).toEqual({ dia: "1", valor: 50 });
    expect(r.promedioPeriodo).toBe(30);
    expect(r.cumpleDiario).toBe(false);
    expect(r.cumpleAnual).toBe(false);
  });
});

describe("mezcla rápida (planilla Coag)", () => {
  it("placa orificio", () => {
    const r = placaOrificio({ caudalM3s: 0.028, velocidadMs: 1, diametroAdoptadoM: 0.222 - 2 * 0.0064, beta: 1.4, cd: 0.61, perdidaPermanente: 0.49, largoMezclaDiametros: 5, nu: 1e-6, g: 9.8 });
    expect(r.diametroTeorico).toBeCloseTo(0.1888139488, 9);
    expect(r.h).toBeCloseTo(0.2581155256, 9);
    expect(r.hf).toBeCloseTo(0.1264766076, 9);
    expect(r.G).toBeCloseTo(982.4822081, 6);
  });
  it("Parshall 1' y 9\"", () => {
    const r1 = parshall(PARSHALL.find((p) => p.nombre === "1'")!, 0.028);
    expect(r1.Ha).toBeCloseTo(0.1217961333, 9);
    expect(r1.Fr1).toBeCloseTo(4.179274144, 8);
    expect(r1.T).toBeCloseTo(1.292921224, 8);
    expect(r1.G).toBeCloseTo(1072.077041, 5);
    expect(parshall(PARSHALL.find((p) => p.nombre === '9"')!, 0.028).G).toBeCloseTo(890.3653323953284, 5);
  });
});

describe("floculación (planilla Floculacion)", () => {
  it("ajuste G·T^n = K", () => {
    const r = ajusteGT([300, 600, 900, 1200, 1500, 1800], [37, 28, 20, 20, 12, 12]);
    expect(r.n).toBeCloseTo(0.6502, 4);
    expect(r.K).toBeCloseTo(1644.93, 1);
  });
  it("paletas: cámara 3 (9 m², a = 0,3, G = 19,77)", () => {
    const [c] = floculadorPaletas({
      caudalM3s: 0.028,
      alturaM: 2.5,
      relacionDDe: 0.4,
      k: 0.05,
      nu: 1e-6,
      nq: 0.86,
      camaras: [{ areaM2: 9, lxM: 3.36, gObjetivo: 19.765521215654545, anchoPaletaM: 0.3 }],
    });
    expect(c.de).toBeCloseTo(3.39, 9);
    // La planilla toma Cd en b/a = 2,3 (1,156); acá se interpola en b/a = 2,26 exacto.
    expect(c.cd).toBeCloseTo(0.02 * 2.26 + 1.11, 9);
    const f = (1.156 / c.cd) ** (1 / 3);
    expect(c.rpm).toBeCloseTo(6.239301402 * f, 7);
    expect(c.vPaleta).toBeCloseTo(0.4429903619 * f, 8);
    expect(c.qBombeo).toBeCloseTo(0.2229781126 * f, 8);
  });
  it("tabiques flujo vertical (sin fricción, N − 1 vueltas)", () => {
    const [t] = floculadorTabiques({
      caudalM3s: 0.028,
      alturaM: 3,
      anchoM: 3.36,
      manning: 0.011,
      kGiro: 3.2,
      nu: 1e-6,
      g: 9.8,
      flujo: "vertical",
      pasajeFactor: 1.5,
      tramos: [{ separacionM: 0.1, tiempoS: 600 }],
    });
    expect(t.hf).toBeCloseTo(0.007894515831, 9);
    expect(t.G).toBeCloseTo(11.35534053, 7);
  });
  it("tabiques flujo horizontal: fricción como la planilla", () => {
    const [t] = floculadorTabiques({
      caudalM3s: 0.028,
      alturaM: 1.5,
      anchoM: 3.36,
      manning: 0.011,
      kGiro: 3.2,
      nu: 1e-6,
      g: 9.8,
      flujo: "horizontal",
      pasajeFactor: 1.5,
      tramos: [{ separacionM: 0.1, tiempoS: 600 }],
    });
    expect(t.hfCanales).toBeCloseTo(0.02439006736, 9);
  });
  it("G en la tubería de salida", () => {
    expect(gradienteTuberia(0.028, 0.39687, 0.012).G).toBeCloseTo(18.88979795, 6);
  });
});

describe("sedimentación y DAF", () => {
  it("convencional", () => {
    const r = decantadorConvencional({ caudalM3d: 2400, cargaSuperficialM3m2d: 40, profundidadM: 3, forma: "rectangular", relacionLB: 4, unidades: 2, largoVertederoM: null });
    expect(r.area).toBeCloseTo(30, 10);
    expect(r.tiempoH).toBeCloseTo(1.8, 10);
    expect(r.remSst).toBeCloseTo(1.8 / (0.0075 + 0.014 * 1.8), 10);
  });
  it("laminar cumple Yao", () => {
    const r = decantadorLaminar({ caudalM3d: 2400, vscMd: 20, espaciamientoM: 0.05, largoPlacaM: 1.2, anguloGrados: 60, nu: 1e-6 });
    const th = Math.PI / 3;
    expect(r.v0 / (Math.sin(th) + r.Lp * Math.cos(th))).toBeCloseTo(20 / 86400, 12);
    expect(r.re).toBeLessThan(500);
  });
  it("Stokes", () => {
    expect(stokes(1e-4, 2650).vs).toBeCloseTo((9.81 * (2650 - 998.2) * 1e-8) / (18 * 1.002e-3), 12);
  });
  it("DAF: el R despejado da la A/S pedida", () => {
    const r = calcularDaf({ caudalM3d: 1000, solidosMgL: 3000, temperaturaC: 20, presionKPa: 400, saturacion: 0.5, relacionAS: 0.02, cargaHidraulicaMh: 5, cargaSolidosMaxKgM2h: null, relacionLB: 3 });
    expect((1.3 * r.sa * (0.5 * r.P - 1) * r.recirculacion) / (3000 * 1000)).toBeCloseTo(0.02, 12);
  });
});
