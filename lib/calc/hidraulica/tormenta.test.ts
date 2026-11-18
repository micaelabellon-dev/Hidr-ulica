import { describe, expect, it } from "vitest";
import {
  ajustarGumbel,
  analizarTormenta,
  coefArea,
  coefDuracion,
  coefTr,
  intensidadIdf,
  laminaUruguay,
  maximosPorDuracion,
  periodoRetorno,
  trDesdeCoefTr,
  validarHietograma,
  validarMaximos,
  validarTablaIdf,
  variableGumbel,
  TABLA_IDF_EJEMPLO,
  MAXIMOS_EJEMPLO,
  type ModeloIdf,
} from "@/lib/calc/hidraulica/tormenta";

describe("Rodríguez Fontal (planilla de escurrimientos extremos)", () => {
  it("método racional: P(3,10) = 94 mm, T = 10, A = 5,6 km², d = tc", () => {
    const d = 1.854812019;
    expect(coefTr(10)).toBeCloseTo(1.000021295, 8);
    expect(coefDuracion(d)).toBeCloseTo(0.8093848556, 8);
    expect(coefArea(5.6, d)).toBeCloseTo(0.9913007726, 8);
    expect(laminaUruguay(94, d, 10, 5.6)).toBeCloseTo(75.42192634, 6);
  });
  it("tormenta NRCS: P(3,10) = 76 mm, T = 5, A = 12,7 km², d = 0,265 h y > 3 h", () => {
    expect(laminaUruguay(76, 0.2649731456, 5, 12.7)).toBeCloseTo(21.10573094, 6);
    expect(laminaUruguay(76, 3.179677747, 5, 12.7)).toBeCloseTo(65.83915824, 6);
  });
  it("la inversión de CT en forma cerrada", () => {
    for (const T of [1.5, 2, 10, 100, 1000]) expect(trDesdeCoefTr(coefTr(T))).toBeCloseTo(T, 6);
  });
});

describe("período de retorno", () => {
  const uru: ModeloIdf = { tipo: "uruguay", p310Mm: 85, areaKm2: 0 };
  it("invierte la IDF: la lluvia de diseño de T años da T años", () => {
    for (const T of [2, 10, 50]) {
      const i = intensidadIdf(uru, 90, T);
      expect(periodoRetorno(uru, 90, i).T).toBeCloseTo(T, 4);
    }
  });
  it("fórmula i = K·T^m/(d+c)^n", () => {
    const f: ModeloIdf = { tipo: "formula", K: 800, m: 0.2, c: 10, n: 0.75 };
    expect(intensidadIdf(f, 60, 10)).toBeCloseTo((800 * 10 ** 0.2) / 70 ** 0.75, 10);
    expect(periodoRetorno(f, 60, intensidadIdf(f, 60, 25)).T).toBeCloseTo(25, 4);
  });
  it("tabla: reproduce los puntos y queda entre ellos", () => {
    const { puntos } = validarTablaIdf(TABLA_IDF_EJEMPLO, false);
    const t: ModeloIdf = { tipo: "tabla", puntos: puntos! };
    const i10 = Number(TABLA_IDF_EJEMPLO.find((f) => f[0] === "60" && f[1] === "10")![2].replace(",", "."));
    expect(periodoRetorno(t, 60, i10).T).toBeCloseTo(10, 3);
    const tr = periodoRetorno(t, 45, intensidadIdf({ tipo: "formula", K: 800, m: 0.2, c: 10, n: 0.75 }, 45, 10)).T;
    expect(tr).toBeGreaterThan(8);
    expect(tr).toBeLessThan(12);
  });
  it("Gumbel por momentos", () => {
    const a = ajustarGumbel([10, 20, 30, 40, 50], 60);
    expect(a.beta).toBeCloseTo((Math.sqrt(6) * a.desvio) / Math.PI, 12);
    expect(a.mu).toBeCloseTo(30 - 0.5772 * a.beta, 12);
    const { ajustes } = validarMaximos(MAXIMOS_EJEMPLO);
    const g: ModeloIdf = { tipo: "gumbel", ajustes: ajustes! };
    const a60 = ajustes!.find((x) => x.duracionMin === 60)!;
    const P50 = a60.mu + a60.beta * variableGumbel(50);
    expect(periodoRetorno(g, 60, P50).T).toBeCloseTo(50, 3);
  });
  it("fuera de rango", () => {
    expect(periodoRetorno(uru, 60, 0.1).fuera).toBe("menor");
    expect(periodoRetorno(uru, 60, 10000).fuera).toBe("mayor");
  });
});

describe("tormenta", () => {
  it("ventanas móviles", () => {
    const m = maximosPorDuracion([1, 5, 2, 0, 4], 10);
    expect(m.map((x) => x.laminaMm)).toEqual([5, 7, 8, 11, 12]);
    expect(m[1].inicio).toBe(1);
    expect(m[0].intensidadMmH).toBe(30);
  });
  it("lluvia acumulada se desacumula", () => {
    expect(validarHietograma([["", "1"], ["", "6"], ["", "8"]], true).lluvias).toEqual([1, 5, 2]);
    expect(validarHietograma([["", "3"], ["", "2"]], true).errores[0]).toMatch(/baja/);
  });
  it("el TR crítico es el máximo entre duraciones", () => {
    const r = analizarTormenta([0, 30, 2, 0], 15, { tipo: "uruguay", p310Mm: 85, areaKm2: 0 });
    expect(r.critico.T).toBe(Math.max(...r.maximos.map((m) => m.T)));
    expect(r.critico.duracionMin).toBe(15);
  });
});
