import { describe, expect, it } from "vitest";
import { calcularGolpe, coeficienteMendiluceC, coeficienteMendiluceK } from "@/lib/calc/hidraulica/golpe-ariete";

// Planilla: 45 m³/h en PEAD DN160 e = 9,5 mm, L = 380 m, E = 9000 kp/cm², g = 9,8.
const base = {
  caudalLs: 12.5,
  diametroExteriorMm: 160,
  espesorMm: 9.5,
  longitudM: 380,
  moduloKpCm2: 9000,
  alturaManometricaM: 15.973191145465853,
  tiempoCierreS: 10,
  g: 9.8,
  presionNominalM: 100,
};

describe("calcularGolpe", () => {
  it("reproduce celeridad, fase, longitud crítica y Michaud con T = 10 s", () => {
    const r = calcularGolpe(base);
    expect(r.celeridadMs).toBeCloseTo(240.29247907285043, 9);
    expect(r.velocidadMs).toBeCloseTo(0.800537916060034, 9);
    expect(r.tiempoFaseS).toBeCloseTo(3.1628122650047144, 9);
    expect(r.longitudCriticaM).toBeCloseTo(1201.4623953642522, 9);
    expect(r.sobrepresionMichaudM).toBeCloseTo(6.208253226588019, 9);
    expect(r.sobrepresionJoukowskyM).toBeCloseTo(19.62890208590602, 9);
    expect(r.regimen).toBe("lento");
    expect(r.sobrepresionM).toBeCloseTo(6.208253226588019, 9);
  });

  it("con T = 2 s (menor que la fase) manda Joukowsky", () => {
    const r = calcularGolpe({ ...base, tiempoCierreS: 2 });
    expect(r.regimen).toBe("rapido");
    expect(r.sobrepresionM).toBeCloseTo(19.62890208590602, 9);
    expect(r.presionMaximaM).toBeCloseTo(base.alturaManometricaM + 19.62890208590602, 9);
  });

  it("Mendiluce", () => {
    expect(coeficienteMendiluceC(0.1)).toBe(1);
    expect(coeficienteMendiluceC(0.3)).toBeCloseTo(0.5, 10);
    expect(coeficienteMendiluceC(0.5)).toBe(0);
    expect(coeficienteMendiluceK(380)).toBe(2);
    expect(coeficienteMendiluceK(1000)).toBe(1.5);
    expect(coeficienteMendiluceK(2000)).toBe(1);
    const r = calcularGolpe({ ...base, tiempoCierreS: null });
    // Hm/L = 0,042 → C = 1; K = 2; T = 1 + 2·380·0,8005/(9,8·15,97)
    expect(r.tiempoCierreS).toBeCloseTo(1 + (2 * 380 * 0.800537916060034) / (9.8 * base.alturaManometricaM), 9);
  });
});
