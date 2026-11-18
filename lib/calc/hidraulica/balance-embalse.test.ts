import { describe, expect, it } from "vitest";
import {
  agregarDiarioAMensual,
  balanceConDemanda,
  demandaFirme,
  sensibilidadDemanda,
  calcularBalance,
  convertirCaudalSerie,
  FACTORES_PERCENTIL_S_SE,
  qambPorPercentil,
  unidadCaudalDeEncabezado,
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
  unidadCaudal: "m3s" as const,
  qambPorMesM3s: Array(12).fill(0),
  modoLiberacion: "completo" as const,
  infiltracionM3s: 0,
  coefEvaporacion: 1,
  areaEnPaso: "medio" as const,
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
    // Enero (31 d): aporte 2 m³/s = 5,3568 hm³; demanda 1 m³/s = 2,6784; Qamb 0,5 = 1,3392;
    // P 50 mm y E 150 mm sobre 100 ha = +0,05 y −0,15 hm³. ΔV = 5,3568+0,05−0,15−1,3392−2,6784 = 1,2392.
    const r = calcularBalance({
      ...base,
      qambPorMesM3s: Array(12).fill(0.5),
      paso: "mensual",
      serie: [{ fecha: "2024-01-01", aporte: 2, precipitacionMm: 50, evaporacionMm: 150, extraccion: 1 }],
    });
    const p = r.pasos[0];
    expect(p.volumenFinalHm3).toBeCloseTo(11.2392, 6);
    expect(p.cotaFinalM).toBeCloseTo(111.2392, 6);
    expect(p.qambLiberadoHm3).toBeCloseTo(1.3392, 6);
    expect(p.vertidoHm3).toBe(0);
    expect(r.cierreHm3).toBeCloseTo(0, 9);
  });

  it("vierte por encima del máximo y no suministra por debajo del volumen muerto", () => {
    const r = calcularBalance({
      ...base,
      paso: "diario",
      serie: [
        // +17,28 hm³ en un día: 10 + 17,28 = 27,28 → vierte 9,28
        { fecha: "2024-01-01", aporte: 200, precipitacionMm: 0, evaporacionMm: 0, extraccion: 0 },
        // demanda 25,92 hm³ con 18 − 1 = 17 disponibles sobre el volumen muerto → déficit 8,92
        { fecha: "2024-01-02", aporte: 0, precipitacionMm: 0, evaporacionMm: 0, extraccion: 300 },
      ],
    });
    expect(r.pasos[0].vertidoHm3).toBeCloseTo(9.28, 6);
    expect(r.pasos[0].volumenFinalHm3).toBeCloseTo(18, 9);
    expect(r.pasos[1].suministroHm3).toBeCloseTo(17, 6);
    expect(r.pasos[1].deficitHm3).toBeCloseTo(8.92, 6);
    expect(r.pasos[1].volumenFinalHm3).toBeCloseTo(1, 9);
    expect(r.pasosConVertido).toBe(1);
    expect(r.pasosConDeficit).toBe(1);
    expect(r.garantiaTemporal).toBe(0.5);
  });

  it("el caudal ambiental tiene prioridad y, en modo mín(aporte; Qamb), no supera al aporte", () => {
    const serie = [{ fecha: "2024-01-01", aporte: 0.2, precipitacionMm: 0, evaporacionMm: 0, extraccion: 0 }];
    const datos = { ...base, paso: "diario" as const, qambPorMesM3s: Array(12).fill(1), serie };
    const minimo = calcularBalance({ ...datos, modoLiberacion: "minimo-aporte" }).pasos[0];
    const completo = calcularBalance({ ...datos, modoLiberacion: "completo" }).pasos[0];
    expect(minimo.qambLiberadoHm3).toBeCloseTo(0.01728, 9); // 0,2 m³/s × 1 día
    expect(minimo.cumpleQamb).toBe(false);
    expect(completo.qambLiberadoHm3).toBeCloseTo(0.0864, 9); // 1 m³/s × 1 día
    expect(completo.cumpleQamb).toBe(true);
  });

  it("acepta la serie como volumen del paso (m³/mes)", () => {
    const r = calcularBalance({
      ...base,
      unidadCaudal: "volumen",
      paso: "mensual",
      serie: [{ fecha: "2024-02-01", aporte: 1_000_000, precipitacionMm: 0, evaporacionMm: 0, extraccion: 250_000 }],
    });
    expect(r.pasos[0].aporteHm3).toBeCloseTo(1, 12);
    expect(r.pasos[0].suministroHm3).toBeCloseTo(0.25, 12);
  });

  it("la evaporación no saca más agua que la que hay y aplica el coeficiente de tanque", () => {
    const r = calcularBalance({
      ...base,
      coefEvaporacion: 0.7,
      areaEnPaso: "inicio",
      paso: "diario",
      serie: [{ fecha: "2024-01-01", aporte: 0, precipitacionMm: 0, evaporacionMm: 100, extraccion: 0 }],
    });
    expect(r.pasos[0].evaporacionHm3).toBeCloseTo(100 * 0.7 * 100 * 1e-5, 12);
  });

  it("con área en el volumen medio, el área corresponde al volumen medio resultante", () => {
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
      serie: [{ fecha: "2024-01-01", aporte: 100, precipitacionMm: 0, evaporacionMm: 10, extraccion: 0 }],
    });
    const p = r.pasos[0];
    expect(p.areaHa).toBeCloseTo(((p.volumenInicialHm3 + p.volumenFinalHm3) / 2) * 10, 6);
  });
});

describe("caudal ambiental por percentil", () => {
  it("q(FF%) = q medio × factor × área, por cuatrimestre", () => {
    const q = qambPorPercentil({
      areaCuencaKm2: 73.1366,
      qMedioLsKm2: [14.9, 15.7, 5.9],
      factores: FACTORES_PERCENTIL_S_SE,
      percentil: "Q80",
      dicMarTodoElAnio: false,
    });
    expect(q[0] * 1000).toBeCloseTo(31.49993362, 6); // enero, DIC-MAR
    expect(q[4] * 1000).toBeCloseTo(89.35829788, 6); // mayo, ABR-JUL
    expect(q[8] * 1000).toBeCloseTo(181.42264996, 6); // setiembre, AGO-NOV
    const q60 = qambPorPercentil({
      areaCuencaKm2: 1,
      qMedioLsKm2: [10, 10, 10],
      factores: FACTORES_PERCENTIL_S_SE,
      percentil: "Q60",
      dicMarTodoElAnio: true,
    });
    expect(new Set(q60).size).toBe(1);
    expect(q60[5] * 1000).toBeCloseTo(1.43, 9);
  });
});

describe("unidades de la serie", () => {
  it("lee la unidad del encabezado y convierte", () => {
    expect(unidadCaudalDeEncabezado("aporte_m3_s")).toBe("m3s");
    expect(unidadCaudalDeEncabezado("aporte_l_s")).toBe("ls");
    expect(unidadCaudalDeEncabezado("aporte_cuenca_temez_m3_mes")).toBe("m3");
    expect(unidadCaudalDeEncabezado("aporte")).toBeNull();
    expect(convertirCaudalSerie(2, "m3s", "volumen", 86400)).toBe(172800);
    expect(convertirCaudalSerie(86400, "m3", "m3s", 86400)).toBe(1);
    expect(convertirCaudalSerie(500, "ls", "m3s", 3600)).toBe(0.5);
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

describe("sensibilidad y demanda firme", () => {
  const serie = Array.from({ length: 24 }, (_, i) => ({
    fecha: `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`,
    aporte: i % 12 < 6 ? 3 : 0.5,
    precipitacionMm: 0,
    evaporacionMm: 0,
    extraccion: 0,
  }));
  const datos = { ...base, paso: "mensual" as const, serie };

  it("la garantía no sube al subir la demanda", () => {
    const esc = sensibilidadDemanda(datos, [0.5, 1, 1.5, 2, 3]);
    for (let i = 1; i < esc.length; i++) {
      expect(esc[i].garantiaTemporal).toBeLessThanOrEqual(esc[i - 1].garantiaTemporal + 1e-12);
      expect(esc[i].garantiaVolumetrica).toBeLessThanOrEqual(esc[i - 1].garantiaVolumetrica + 1e-12);
    }
    expect(esc[0].garantiaTemporal).toBe(1);
  });

  it("la demanda firme cumple la garantía y un poco más no", () => {
    const d = demandaFirme(datos, 0.95, "temporal");
    expect(balanceConDemanda(datos, d).garantiaTemporal).toBeGreaterThanOrEqual(0.95);
    expect(balanceConDemanda(datos, d * 1.01).garantiaTemporal).toBeLessThan(0.95);
  });
});

describe("agregarDiarioAMensual", () => {
  it("suma la lluvia, completa E y ETP con el promedio y promedia caudales en m³/s", () => {
    const filas = [
      ["2024-02-01", "1", "10", "4", "0,5", "5"],
      ["2024-02-02", "3", "", "6", "0,5", ""],
    ];
    const r = agregarDiarioAMensual(filas, "m3s");
    expect(r.filas).toEqual([["2024-02-01", "2", "10", "145", "0,5", "145"]]);
    expect(r.faltantes[0]).toEqual({ mes: "2024-02", p: 28, e: 27, etp: 28 });
  });
});
