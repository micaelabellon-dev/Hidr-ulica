import { describe, expect, it } from "vitest";
import { calcularPozoHumedo, type DatosPozoHumedo } from "@/lib/calc/hidraulica/pozo-humedo";

// Caso de una planilla de estación de bombeo industrial: 12,5 L/s, 6 arranques por hora.
const base: DatosPozoHumedo = {
  caudalBombeoLs: 12.5,
  caudalMinimoLs: 5,
  arranquesPorHora: 6,
  forma: "circular",
  diametroM: 1.5,
  largoM: 0,
  anchoM: 0,
  areaAdoptadaM2: 1.8,
  alturaUtilAdoptadaM: 1,
  cotaTapaM: 4.5,
  cotasZampeadoM: [2.84, 2.58],
  revanchaM: 0.15,
  sumergenciaM: 0.33,
  alturaAroM: 0.5,
  tiempoDetencionMaxMin: 30,
};

describe("calcularPozoHumedo", () => {
  it("reproduce la planilla: volumen, alturas, cotas, aros y detención", () => {
    const r = calcularPozoHumedo(base);
    expect(r.tiempoCicloMin).toBe(10);
    expect(r.volumenUtilNecesarioM3).toBeCloseTo(1.875, 10);
    expect(r.alturaUtilNecesariaM).toBeCloseTo(1.0416666666666667, 10);
    expect(r.profundidadZampeadoM).toBeCloseTo(1.92, 10);
    expect(r.profundidadTotalM).toBeCloseTo(3.4, 10);
    expect(r.cantidadAros).toBe(7);
    expect(r.cotaNivelMaximoM).toBeCloseTo(2.43, 10);
    expect(r.cotaNivelMinimoM).toBeCloseTo(1.43, 10);
    expect(r.cotaFondoM).toBeCloseTo(1.1, 10);
    expect(r.detencion.llenadoMin).toBeCloseTo(6, 10);
    expect(r.detencion.cumple).toBe(true);
    // 1,8 m³ < 1,875 m³: avisa que el redondeo de la altura baja el volumen.
    expect(r.avisos.join()).toMatch(/menos que los 1,875/);
  });

  it("sin altura adoptada redondea hacia arriba y calcula el área con el diámetro", () => {
    const r = calcularPozoHumedo({ ...base, areaAdoptadaM2: null, alturaUtilAdoptadaM: null });
    expect(r.areaM2).toBeCloseTo((Math.PI * 1.5 ** 2) / 4, 10);
    expect(r.alturaUtilM).toBeCloseTo(1.1, 10);
    expect(r.volumenUtilM3).toBeGreaterThanOrEqual(r.volumenUtilNecesarioM3);
    expect(r.arranquesRealesPorHora).toBeLessThanOrEqual(6 + 1e-9);
  });
});
