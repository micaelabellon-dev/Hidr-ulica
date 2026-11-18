import { describe, expect, it } from "vitest";
import { calcularAmoniaco, convertirAmonio, fraccionLibre, pKaAmonio, totalMaximoAdmisible, validarMuestras, MUESTRAS_EJEMPLO } from "@/lib/calc/calidad/amoniaco";

describe("amoníaco libre (Emerson et al., 1975)", () => {
  it("reproduce la planilla: 0,05 mg NH₄/L, pH 7,3, 17 °C", () => {
    const r = calcularAmoniaco(0.05, "NH4", 7.3, 17);
    expect(r.y).toBeCloseTo(2.198506440584505, 12);
    expect(r.fraccion).toBeCloseTo(0.0062914764371879445, 14);
    expect(r.libre.NH4).toBeCloseTo(0.0003145738218593972, 15);
    expect(r.libre.NH3).toBeCloseTo((0.0003145738218593972 * 17) / 18, 15);
    expect(r.libre.N).toBeCloseTo((0.0003145738218593972 * 14) / 18, 15);
  });
  it("NH₄–N a NH₄⁺ es ÷14 × 18, como dice la nota de la planilla", () => {
    expect(convertirAmonio(14, "N", "NH4")).toBe(18);
    expect(calcularAmoniaco(1, "N", 8, 20).total.NH4).toBeCloseTo(18 / 14, 12);
  });
  it("en pH = pKa la mitad está libre, y crece con pH y temperatura", () => {
    expect(fraccionLibre(pKaAmonio(25), 25)).toBeCloseTo(0.5, 12);
    expect(pKaAmonio(25)).toBeCloseTo(9.245, 2);
    expect(fraccionLibre(8, 25)).toBeGreaterThan(fraccionLibre(7, 25));
    expect(fraccionLibre(8, 30)).toBeGreaterThan(fraccionLibre(8, 10));
  });
  it("total máximo admisible = límite / F", () => {
    const max = totalMaximoAdmisible(0.02, "NH3", "NH4", 8, 20);
    expect(calcularAmoniaco(max, "NH4", 8, 20).libre.NH3).toBeCloseTo(0.02, 12);
  });
  it("valida muestras", () => {
    expect(validarMuestras(MUESTRAS_EJEMPLO).errores).toEqual([]);
    expect(validarMuestras([["a", "1", "15", "20"]]).errores[0]).toMatch(/pH/);
  });
});
