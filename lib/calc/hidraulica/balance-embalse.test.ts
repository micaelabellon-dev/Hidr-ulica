import { describe, expect, it } from "vitest";
import {
  calcularBalance,
  caudalAVolumenHm3,
  CURVA_EJEMPLO,
  duracionPasoS,
  interpolarCurva,
  laminaAVolumenHm3,
  serieEjemplo,
  validarCurva,
  validarSerie,
  type PuntoCurva,
} from "@/lib/calc/hidraulica/balance-embalse";

// Embalse de paredes verticales: área constante 100 ha, 1 m de cota = 1 hm³.
const CUBO: PuntoCurva[] = [
  { cotaM: 100, areaHa: 100, volumenHm3: 0 },
  { cotaM: 120, areaHa: 100, volumenHm3: 20 },
];

const base = {
  curva: CUBO,
  caudalEcologicoM3s: 0,
  infiltracionM3s: 0,
  volumenInicialHm3: 10,
  volumenMinimoHm3: 1,
  volumenMaximoHm3: 18,
};

describe("conversiones", () => {
  it("1 m³/s durante un mes de 31 días son 2,6784 hm³", () => {
    expect(caudalAVolumenHm3(1, duracionPasoS("2024-01-01", "mensual"))).toBeCloseTo(2.6784, 6);
  });
  it("respeta febrero bisiesto y el paso diario", () => {
    expect(duracionPasoS("2024-02-01", "mensual")).toBe(29 * 86400);
    expect(duracionPasoS("2023-02-01", "mensual")).toBe(28 * 86400);
    expect(duracionPasoS("2023-02-14", "diario")).toBe(86400);
  });
  it("100 mm sobre 100 ha son 0,1 hm³", () => {
    expect(laminaAVolumenHm3(100, 100)).toBeCloseTo(0.1, 10);
  });
  it("interpola linealmente y recorta en los extremos", () => {
    expect(interpolarCurva(CUBO, "volumenHm3", 5, "cotaM")).toBeCloseTo(105, 10);
    expect(interpolarCurva(CUBO, "volumenHm3", 50, "cotaM")).toBe(120);
  });
});

describe("calcularBalance", () => {
  it("cierra el balance de un paso a mano", () => {
    // Enero (31 d): aporte 2 m³/s = 5,3568 hm³; extracción 1 m³/s = 2,6784; ecológico 0,5 = 1,3392;
    // P 50 mm y E 150 mm sobre 100 ha = +0,05 y −0,15 hm³. ΔV = 5,3568+0,05−2,6784−1,3392−0,15 = 1,2392.
    const r = calcularBalance({
      ...base,
      caudalEcologicoM3s: 0.5,
      paso: "mensual",
      serie: [{ fecha: "2024-01-01", aporteM3s: 2, precipitacionMm: 50, evaporacionMm: 150, extraccionM3s: 1 }],
    });
    const p = r.pasos[0];
    expect(p.deltaVHm3).toBeCloseTo(1.2392, 6);
    expect(p.volumenFinalHm3).toBeCloseTo(11.2392, 6);
    expect(p.cotaFinalM).toBeCloseTo(111.2392, 6);
    expect(p.vertidoHm3).toBe(0);
  });

  it("vierte el excedente por encima del máximo y registra el déficit bajo el mínimo", () => {
    const r = calcularBalance({
      ...base,
      paso: "diario",
      serie: [
        // +17,28 hm³ en un día: 10 + 17,28 = 27,28 → vierte 9,28
        { fecha: "2024-01-01", aporteM3s: 200, precipitacionMm: 0, evaporacionMm: 0, extraccionM3s: 0 },
        // −25,92 hm³: 18 − 25,92 = −7,92 → déficit 8,92 con mínimo 1
        { fecha: "2024-01-02", aporteM3s: 0, precipitacionMm: 0, evaporacionMm: 0, extraccionM3s: 300 },
      ],
    });
    expect(r.pasos[0].vertidoHm3).toBeCloseTo(9.28, 6);
    expect(r.pasos[0].volumenFinalHm3).toBe(18);
    expect(r.pasos[1].deficitHm3).toBeCloseTo(8.92, 6);
    expect(r.pasos[1].volumenFinalHm3).toBe(1);
    expect(r.pasosConVertido).toBe(1);
    expect(r.pasosConDeficit).toBe(1);
    expect(r.volumenMinimo.fecha).toBe("2024-01-02");
  });

  it("toma el área en el volumen medio del paso (cono: área crece con el volumen)", () => {
    const curva: PuntoCurva[] = [
      { cotaM: 0, areaHa: 0, volumenHm3: 0 },
      { cotaM: 10, areaHa: 1000, volumenHm3: 100 },
    ];
    const r = calcularBalance({
      ...base,
      curva,
      volumenInicialHm3: 40,
      volumenMinimoHm3: 0,
      volumenMaximoHm3: 100,
      paso: "diario",
      serie: [{ fecha: "2024-01-01", aporteM3s: 100, precipitacionMm: 0, evaporacionMm: 10, extraccionM3s: 0 }],
    });
    const p = r.pasos[0];
    // Consistencia del punto fijo: el área es la del volumen medio resultante.
    expect(p.areaHa).toBeCloseTo(((p.volumenInicialHm3 + p.volumenFinalHm3) / 2) * 10, 6);
  });
});

describe("validarSerie", () => {
  it("acepta la serie de ejemplo en ambos pasos", () => {
    expect(validarSerie(serieEjemplo("mensual"), "mensual").errores).toEqual([]);
    expect(validarSerie(serieEjemplo("diario"), "diario").errores).toEqual([]);
  });

  it("informa meses faltantes, negativos, fechas ilegibles y repetidas", () => {
    const filas = [
      ["2024-01-01", "1", "10", "50", "0,5"],
      ["2024-04-01", "1", "-3", "50", "0,5"],
      ["2024-04-01", "1", "10", "50", "0,5"],
      ["abc", "1", "10", "x", "0,5"],
    ];
    const { serie, errores } = validarSerie(filas, "mensual");
    expect(serie).toBeNull();
    const texto = errores.join("\n");
    expect(texto).toMatch(/Faltan 2 meses.*2024-02, 2024-03/);
    expect(texto).toMatch(/Fila 2: precipitación negativo/);
    expect(texto).toMatch(/Fila 3: la fecha 2024-04-01 está repetida/);
    expect(texto).toMatch(/Fila 4: la fecha «abc» no se reconoce/);
    expect(texto).toMatch(/Fila 4: evaporación «x» no es un número/);
  });

  it("acepta dd/mm/aaaa y detecta días faltantes", () => {
    const filas = [
      ["30/12/2024", "1", "0", "5", "0"],
      ["02/01/2025", "1", "0", "5", "0"],
    ];
    expect(validarSerie(filas, "diario").errores[0]).toMatch(/Faltan 2 días.*2024-12-31, 2025-01-01/);
  });
});

describe("validarCurva", () => {
  it("acepta la curva de ejemplo", () => {
    expect(validarCurva(CURVA_EJEMPLO).errores).toEqual([]);
  });
  it("rechaza volúmenes no crecientes", () => {
    const { errores } = validarCurva([["1", "1", "5"], ["2", "2", "4"]]);
    expect(errores[0]).toMatch(/volumen tiene que ser mayor/);
  });
});
