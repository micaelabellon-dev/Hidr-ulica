import { describe, expect, it } from "vitest";
import { calcularPerdidaCarga, factorFriccionColebrook, G } from "@/lib/calc/hidraulica/perdida-carga";
import { viscosidadCinematicaAgua } from "@/lib/calc/hidraulica/materiales";

describe("factorFriccionColebrook", () => {
  it("satisface la propia ecuación de Colebrook-White (residuo ~0)", () => {
    const re = 126_000;
    const epsRel = 0.00045;
    const f = factorFriccionColebrook(re, epsRel);
    const izquierda = 1 / Math.sqrt(f);
    const derecha = -2 * Math.log10(epsRel / 3.7 + 2.51 / (re * Math.sqrt(f)));
    expect(izquierda).toBeCloseTo(derecha, 6);
  });

  it("a mayor rugosidad relativa, mayor fricción (monotonía)", () => {
    const re = 100_000;
    const fLiso = factorFriccionColebrook(re, 0.00001);
    const fRugoso = factorFriccionColebrook(re, 0.01);
    expect(fRugoso).toBeGreaterThan(fLiso);
  });
});

describe("calcularPerdidaCarga — Darcy-Weisbach", () => {
  // Caso de mano: tubería de acero nuevo, D=100mm, L=100m, Q=10 L/s, agua a 20°C.
  // V = Q/A = 0.01 / (π·0.05²) ≈ 1.273 m/s; Re ≈ 1,26×10⁵ (turbulento);
  // f (Colebrook, ε/D=4,5×10⁻⁴) ≈ 0,0195 ⇒ hf ≈ 0,0195·1000·1,62/19,62 ≈ 1,6 m.
  const base = {
    metodo: "darcy-weisbach" as const,
    caudalLs: 10,
    diametroMm: 100,
    longitudM: 100,
    rugosidadMm: 0.045,
    hazenC: 120,
    temperaturaC: 20,
    sumaK: 0,
  };

  it("da velocidad, Reynolds y pérdida del orden calculado a mano", () => {
    const r = calcularPerdidaCarga(base);
    expect(r.velocidadMs).toBeCloseTo(1.273, 2);
    expect(r.regimen).toBe("turbulento");
    expect(r.reynolds).toBeGreaterThan(100_000);
    expect(r.reynolds).toBeLessThan(140_000);
    expect(r.perdidaFriccionM).toBeCloseTo(1.6, 1);
    expect(r.perdidaTotalKPa).toBeCloseTo(r.perdidaTotalM * G, 6);
  });

  it("régimen laminar usa f = 64/Re exacto", () => {
    // Caudal muy chico para que Re < 2300.
    const r = calcularPerdidaCarga({ ...base, caudalLs: 0.05 });
    expect(r.regimen).toBe("laminar");
    expect(r.factorFriccion).toBeCloseTo(64 / (r.reynolds as number), 10);
  });

  it("a mayor longitud, mayor pérdida, en proporción directa", () => {
    const corto = calcularPerdidaCarga(base);
    const largo = calcularPerdidaCarga({ ...base, longitudM: 200 });
    expect(largo.perdidaFriccionM).toBeCloseTo(corto.perdidaFriccionM * 2, 3);
  });

  it("a mayor diámetro, menor velocidad y menor pérdida", () => {
    const chico = calcularPerdidaCarga(base);
    const grande = calcularPerdidaCarga({ ...base, diametroMm: 150 });
    expect(grande.velocidadMs).toBeLessThan(chico.velocidadMs);
    expect(grande.perdidaFriccionM).toBeLessThan(chico.perdidaFriccionM);
  });

  it("las pérdidas localizadas se suman a la de fricción", () => {
    const sinAccesorios = calcularPerdidaCarga(base);
    const conAccesorios = calcularPerdidaCarga({ ...base, sumaK: 2 });
    expect(conAccesorios.perdidaLocalizadaM).toBeCloseTo(
      2 * (conAccesorios.velocidadMs ** 2 / (2 * G)),
      6
    );
    expect(conAccesorios.perdidaTotalM).toBeCloseTo(
      sinAccesorios.perdidaFriccionM + conAccesorios.perdidaLocalizadaM,
      6
    );
  });

  it("a mayor temperatura, menor viscosidad y menor Reynolds para el mismo caudal", () => {
    const fria = calcularPerdidaCarga({ ...base, temperaturaC: 5 });
    const calida = calcularPerdidaCarga({ ...base, temperaturaC: 40 });
    expect(viscosidadCinematicaAgua(40)).toBeLessThan(viscosidadCinematicaAgua(5));
    expect(calida.reynolds as number).toBeGreaterThan(fria.reynolds as number);
  });
});

describe("calcularPerdidaCarga — Hazen-Williams", () => {
  it("no calcula Reynolds ni factor de fricción: el método no los usa", () => {
    const r = calcularPerdidaCarga({
      metodo: "hazen-williams",
      caudalLs: 10,
      diametroMm: 100,
      longitudM: 100,
      rugosidadMm: 0.045,
      hazenC: 120,
      temperaturaC: 20,
      sumaK: 0,
    });
    expect(r.reynolds).toBeNull();
    expect(r.factorFriccion).toBeNull();
    expect(r.perdidaFriccionM).toBeGreaterThan(0);
  });

  it("a mayor C (tubería más lisa), menor pérdida para el mismo caudal", () => {
    const comun = {
      metodo: "hazen-williams" as const,
      caudalLs: 10,
      diametroMm: 100,
      longitudM: 100,
      rugosidadMm: 0,
      temperaturaC: 20,
      sumaK: 0,
    };
    const rugosa = calcularPerdidaCarga({ ...comun, hazenC: 100 });
    const lisa = calcularPerdidaCarga({ ...comun, hazenC: 150 });
    expect(lisa.perdidaFriccionM).toBeLessThan(rugosa.perdidaFriccionM);
  });
});
