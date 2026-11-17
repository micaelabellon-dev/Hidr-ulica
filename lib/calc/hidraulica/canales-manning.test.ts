import { describe, expect, it } from "vitest";
import {
  G,
  calcularCanalManning,
  caudalManning,
  geometriaCanal,
  resolverTiranteNormal,
  type DatosCanalManning,
} from "@/lib/calc/hidraulica/canales-manning";

describe("geometriaCanal", () => {
  it("rectangular: A = b·y, P = b + 2y", () => {
    const g = geometriaCanal("rectangular", 1.5, 2, 0);
    expect(g.areaM2).toBeCloseTo(3, 10);
    expect(g.perimetroMojadoM).toBeCloseTo(5, 10);
    expect(g.anchoSuperficialM).toBeCloseTo(2, 10);
  });

  it("triangular: A = z·y², P = 2y√(1+z²)", () => {
    const g = geometriaCanal("triangular", 1, 0, 1);
    expect(g.areaM2).toBeCloseTo(1, 10);
    expect(g.perimetroMojadoM).toBeCloseTo(2 * Math.SQRT2, 10);
  });

  it("trapecial con z=0 coincide con el rectangular", () => {
    const trap = geometriaCanal("trapecial", 1.5, 2, 0);
    const rect = geometriaCanal("rectangular", 1.5, 2, 0);
    expect(trap.areaM2).toBeCloseTo(rect.areaM2, 10);
    expect(trap.perimetroMojadoM).toBeCloseTo(rect.perimetroMojadoM, 10);
  });

  it("trapecial: A = (b+zy)·y, T = b+2zy", () => {
    const g = geometriaCanal("trapecial", 1, 2, 1);
    expect(g.areaM2).toBeCloseTo(3, 10); // (2+1)·1
    expect(g.anchoSuperficialM).toBeCloseTo(4, 10); // 2+2·1·1
  });
});

describe("resolverTiranteNormal", () => {
  const base: DatosCanalManning = {
    forma: "rectangular",
    caudalM3s: 5,
    baseM: 2,
    taludZ: 0,
    n: 0.015,
    pendiente: 0.001,
  };

  it("el tirante hallado conduce exactamente el caudal de diseño (autoconsistencia)", () => {
    const y = resolverTiranteNormal(base);
    const q = caudalManning(base.forma, y, base.baseM, base.taludZ, base.n, base.pendiente);
    expect(q).toBeCloseTo(base.caudalM3s, 6);
  });

  // Verificación de mano: Q = (1/n)·A·R^(2/3)·√S con b=2, n=0,015, S=0,001,
  // Q=5 m³/s da un tirante entre 1,60 y 1,66 m (A≈3,2–3,3 m², R≈0,62).
  it("el tirante calculado cae en el rango esperado a mano", () => {
    const y = resolverTiranteNormal(base);
    expect(y).toBeGreaterThan(1.55);
    expect(y).toBeLessThan(1.75);
  });

  it("a mayor caudal, mayor tirante (monotonía)", () => {
    const y1 = resolverTiranteNormal(base);
    const y2 = resolverTiranteNormal({ ...base, caudalM3s: 10 });
    expect(y2).toBeGreaterThan(y1);
  });

  it("a mayor rugosidad n, mayor tirante para el mismo caudal", () => {
    const yLiso = resolverTiranteNormal({ ...base, n: 0.011 });
    const yRugoso = resolverTiranteNormal({ ...base, n: 0.03 });
    expect(yRugoso).toBeGreaterThan(yLiso);
  });

  it("a mayor pendiente, menor tirante para el mismo caudal", () => {
    const yPlano = resolverTiranteNormal({ ...base, pendiente: 0.0005 });
    const yPendiente = resolverTiranteNormal({ ...base, pendiente: 0.01 });
    expect(yPendiente).toBeLessThan(yPlano);
  });

  it("funciona igual para trapecial y triangular", () => {
    const trap = resolverTiranteNormal({ ...base, forma: "trapecial", taludZ: 1 });
    const q = caudalManning("trapecial", trap, base.baseM, 1, base.n, base.pendiente);
    expect(q).toBeCloseTo(base.caudalM3s, 6);

    const tri = resolverTiranteNormal({ ...base, forma: "triangular", baseM: 0, taludZ: 1.5 });
    const qTri = caudalManning("triangular", tri, 0, 1.5, base.n, base.pendiente);
    expect(qTri).toBeCloseTo(base.caudalM3s, 6);
  });
});

describe("calcularCanalManning", () => {
  const base: DatosCanalManning = {
    forma: "rectangular",
    caudalM3s: 5,
    baseM: 2,
    taludZ: 0,
    n: 0.015,
    pendiente: 0.001,
  };

  it("V = Q/A, con el área del tirante resuelto", () => {
    const r = calcularCanalManning(base);
    expect(r.velocidadMs).toBeCloseTo(base.caudalM3s / r.areaM2, 10);
  });

  it("clasifica el régimen según Froude, con el rectangular D=y", () => {
    const r = calcularCanalManning(base);
    const froudeManual = r.velocidadMs / Math.sqrt(G * (r.areaM2 / r.anchoSuperficialM));
    expect(r.froude).toBeCloseTo(froudeManual, 10);
    expect(r.regimen).toBe(r.froude < 1 ? "subcritico" : "supercritico");
  });

  it("un canal de pendiente muy fuerte da régimen supercrítico", () => {
    const r = calcularCanalManning({ ...base, pendiente: 0.2 });
    expect(r.froude).toBeGreaterThan(1);
    expect(r.regimen).toBe("supercritico");
  });
});
