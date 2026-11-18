import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aGrillaMinuto,
  almacenamientoMaximo,
  bloquesAlternos,
  calcularMce,
  coeficientes,
  horaSwmm,
  leerSalidaSwmm,
  pico,
  qRacionalMontana,
  serieSwmm,
  tcDesbordesMin,
  tcFaaH,
  tcKirpichH,
  TORMENTAS_EJEMPLO,
  validarTormentas,
  volumenSobre,
} from "@/lib/calc/hidraulica/mce";
import { laminaUruguay } from "@/lib/calc/hidraulica/tormenta";

const predio = {
  areaCatastralM2: 30350,
  areaEitM2: 30872,
  areaLibreM2: 29728,
  areaImpProyectoM2: 13554,
  areaImpPreviaM2: 5700,
  porcImpMaxPrevia: 32,
  cImp: 0.83,
  cPerm: 0.37,
  areaAmortM2: 29885,
  areaImpSinAmortM2: 0,
};

describe("MCE: planilla MCE_calculos", () => {
  const coef = coeficientes(predio);
  it("áreas y coeficientes (hoja Cálculos)", () => {
    expect(coef.porcImpProyecto).toBeCloseTo(45.593379978471475, 10);
    expect(coef.porcImpPrevia).toBeCloseTo(19.17384284176534, 10);
    expect(coef.proyecto.c).toBeCloseTo(0.5719577610779994, 12);
    expect(coef.previa.c).toBeCloseTo(0.45819967707212056, 12);
    expect(coef.amortiguada.areaM2).toBeCloseTo(30399.00230642504, 8);
    expect(coef.amortiguada.c).toBeCloseTo(0.575100152207371, 12);
    expect(coef.sinAmortiguar.areaM2).toBeCloseTo(472.9976935749588, 8);
    expect(coef.sinAmortiguar.c).toBeCloseTo(0.37, 12);
  });
  it("tiempos de concentración", () => {
    const s = (43 - 33) / 306;
    expect(tcKirpichH(0.306, s)).toBeCloseTo(0.09898107885212126, 12);
    expect(tcDesbordesMin(3.0872, s * 100, coef.proyecto.c)).toBeCloseTo(7.617556313832421, 10);
    expect(tcDesbordesMin(2.9728, s * 100, 0.37)).toBeCloseTo(9.162604831365849, 10);
    expect(tcFaaH(145, (3 / 145) * 100, 0.83)).toBeCloseTo(0.137814746956752, 12);
  });
  it("método racional de referencia (Montana)", () => {
    expect(qRacionalMontana(7.84, 0.52, 10, 3.0872, coef.proyecto.c)).toBeCloseTo(0.6967765648251321, 10);
  });

  const { tormentas } = validarTormentas(TORMENTAS_EJEMPLO);
  const r = calcularMce(coef, 10 / 60, 10 / 60, { dMin: 5, kTp: 1.5, kTb: 1.5 }, tormentas as number[][]);
  it("hidrograma unitario triangular", () => {
    expect(r.hu.proyecto.tpH).toBeCloseTo(0.2916666666666667, 12);
    expect(r.hu.proyecto.tbH).toBeCloseTo(0.4375, 12);
    expect(r.hu.proyecto.qpPorMm).toBeCloseTo(0.03920253968253968, 12);
    expect(r.hu.previa.qpPorMm).toBeCloseTo(0.03774984126984127, 12);
  });
  it("picos de los hidrogramas TR 2, 10 y 20", () => {
    const p = (e: keyof typeof r.picos) => r.picos[e].map((x) => x.q);
    const esperado = {
      proyecto: [0.33779102053256205, 0.5563616808771614, 0.6400997910091837],
      previa: [0.26057926133521997, 0.4291893716109509, 0.49378675152178314],
      amortiguada: [0.33444306158030906, 0.5508473955440389, 0.6337555494652085],
      sinAmortiguar: [0.0033479589522528905, 0.005514285333122413, 0.006344241543975023],
    } as const;
    for (const e of Object.keys(esperado) as (keyof typeof esperado)[]) p(e).forEach((q, i) => expect(q).toBeCloseTo(esperado[e][i], 7));
    expect(r.picos.proyecto[1].tH).toBeCloseTo(1.2, 10);
    // Ordenadas sueltas de la planilla
    expect(r.q.proyecto[1][1]).toBeCloseTo(0.0013165032707482991, 9);
    expect(r.q.proyecto[1][71]).toBeCloseTo(0.5382086651207877, 7);
    expect(r.q.proyecto[1][360]).toBeCloseTo(0.02707535401839476, 7);
  });
  it("caudal y volumen a amortiguar (hoja Caudales)", () => {
    expect(r.picos.proyecto[1].q - r.picos.previa[1].q).toBeCloseTo(0.12717230926621054, 7);
    expect(volumenSobre(r.q.proyecto[1], r.picos.previa[1].q)).toBeCloseTo(52.29125040553179, 3);
  });
  it("salida de SWMM: lectura, grilla y combinación con el área sin amortiguar", () => {
    const texto = readFileSync(join(__dirname, "__fixtures__/swmm-salida-amortiguador.txt"), "utf8");
    const s = leerSalidaSwmm(texto);
    expect(s.errores).toEqual([]);
    expect(s.tH.length).toBe(360);
    expect(s.tH[0]).toBeCloseTo(1 / 60, 12);
    expect(s.tH[359]).toBeCloseTo(6, 12);
    expect(Math.max(...s.q)).toBeCloseTo(0.3997, 10);
    const salida = aGrillaMinuto(s.tH, s.q, r.minutos);
    const total = salida.map((v, i) => v + r.q.sinAmortiguar[1][i]);
    // Esta es la corrida pegada cruda en la hoja Caudales (columnas Y–AA).
    expect(pico(total).q).toBeGreaterThan(0.3997);
    expect(pico(total).q).toBeLessThan(0.3997 + 0.0056);
    expect(pico(total).q).toBeLessThan(r.picos.previa[1].q);
    expect(almacenamientoMaximo(r.q.amortiguada[1], salida)).toBeGreaterThan(100);
  });
});

describe("MCE: utilidades", () => {
  it("lectura de formatos de SWMM y horas decimales", () => {
    const a = leerSalidaSwmm("Date Time Flow\n01/01/2024 23:58:00 0.1\n01/01/2024 23:59:00 0.2\n01/02/2024 00:00:00 0,3");
    expect(a.tH.map((t) => +t.toFixed(4))).toEqual([23.9667, 23.9833, 24]);
    expect(a.q).toEqual([0.1, 0.2, 0.3]);
    const b = leerSalidaSwmm("0.5\t0.01\n1\t0.02");
    expect(b.tH).toEqual([0.5, 1]);
    expect(leerSalidaSwmm("0.3").errores.length).toBe(1);
  });
  it("formato de hora y serie de SWMM", () => {
    expect(horaSwmm(0)).toBe("0:00");
    expect(horaSwmm(71)).toBe("1:11");
    expect(serieSwmm("x", [0, 0.5], 1, 2)).toBe(";x\r\n0:00\t0.00\r\n0:01\t0.50\r\n");
  });
  it("bloques alternos conservan la lámina total de Rodríguez Fontal", () => {
    const i = bloquesAlternos(85, 10, 0.03, 360, 5, 0.5);
    expect(i.length).toBe(72);
    const total = i.reduce((s, x) => s + (x * 5) / 60, 0);
    expect(total).toBeCloseTo(laminaUruguay(85, 6, 10, 0.03), 8);
    const k = i.indexOf(Math.max(...i));
    expect(k).toBe(36);
    expect(i[k + 1]).toBeGreaterThanOrEqual(i[k - 1]);
  });
});
