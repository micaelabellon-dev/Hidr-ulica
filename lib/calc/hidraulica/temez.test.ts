import { describe, expect, it } from "vitest";
import { aguaDisponiblePonderada, calcularTemez } from "@/lib/calc/hidraulica/temez";

const params = { aguaDisponibleMm: 87.51665754923414, cad: 0.92, cpo: 0.3, imaxMm: 386, alfaDia: 0.0775, humedadInicialMm: 0, almacenamientoInicialMm: 0 };

describe("calcularTemez", () => {
  it("AD ponderado por unidad de suelo", () => {
    expect(aguaDisponiblePonderada([{ areaHa: 5425, adMm: 83.1 }, { areaHa: 1880, adMm: 100.1 }, { areaHa: 7, adMm: 130.9 }])).toBeCloseTo(87.51665754923414, 10);
  });

  it("reproduce los dos primeros meses de una planilla (INIA Las Brujas, 1985)", () => {
    const r = calcularTemez(
      [
        { fecha: "1985-01-01", dias: 31, precipitacionMm: 65.5, etpMm: 209.2 },
        { fecha: "1985-02-01", dias: 28, precipitacionMm: 92, etpMm: 161.99999999999997 },
      ],
      params
    );
    expect(r[0].aporteMm).toBeCloseTo(3.9182211570273315, 10);
    expect(r[1].aporteMm).toBeCloseTo(12.328879986999908, 10);
    expect(r[0].caudalEspecificoLsKm2).toBeCloseTo(1.462896190646405, 10);
  });

  it("sin lluvia no hay excedente y el acuífero se vacía exponencialmente", () => {
    const r = calcularTemez([{ fecha: "2000-01-01", dias: 30, precipitacionMm: 0, etpMm: 100 }], { ...params, almacenamientoInicialMm: 10 });
    expect(r[0].excedente).toBe(0);
    expect(r[0].almacenamiento).toBeCloseTo(10 * Math.exp(-0.0775 * 30), 12);
    expect(r[0].aporteMm).toBeCloseTo(10 - r[0].almacenamiento, 12);
  });
});
