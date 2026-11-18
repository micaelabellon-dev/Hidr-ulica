/**
 * Flotación por aire disuelto (DAF) con recirculación presurizada
 * (Metcalf & Eddy):
 *   A/S = 1,3·sa·(f·P − 1)·R / (Sa·Q)
 * sa: solubilidad del aire (mL/L) según temperatura; f: fracción de
 * saturación (≈ 0,5); P: presión absoluta en atm = (p + 101,35)/101,35, p en
 * kPa manométricos; Sa: sólidos del afluente (mg/L).
 * Se despeja R para la relación A/S de diseño; el área sale de la carga
 * hidráulica sobre (Q + R) y se verifica la carga de sólidos.
 */

const SOLUBILIDAD_AIRE: [number, number][] = [
  [0, 29.2],
  [10, 22.8],
  [20, 18.7],
  [30, 15.7],
];

export function solubilidadAire(t: number): number {
  const s = SOLUBILIDAD_AIRE;
  if (t <= s[0][0]) return s[0][1];
  for (let i = 0; i < s.length - 1; i++) {
    if (t <= s[i + 1][0]) return s[i][1] + ((t - s[i][0]) / (s[i + 1][0] - s[i][0])) * (s[i + 1][1] - s[i][1]);
  }
  return s[s.length - 1][1];
}

export interface DatosDaf {
  caudalM3d: number;
  solidosMgL: number;
  temperaturaC: number;
  presionKPa: number;
  saturacion: number;
  relacionAS: number;
  cargaHidraulicaMh: number;
  cargaSolidosMaxKgM2h: number | null;
  relacionLB: number;
}

export function calcularDaf(d: DatosDaf) {
  const sa = solubilidadAire(d.temperaturaC);
  const P = (d.presionKPa + 101.35) / 101.35;
  const recirculacion = (d.relacionAS * d.solidosMgL * d.caudalM3d) / (1.3 * sa * (d.saturacion * P - 1));
  const qTotalM3h = (d.caudalM3d + recirculacion) / 24;
  const area = qTotalM3h / d.cargaHidraulicaMh;
  const solidosKgH = (d.solidosMgL * d.caudalM3d) / 1000 / 24;
  const cargaSolidos = solidosKgH / area;
  const aireKgH = d.relacionAS * solidosKgH;
  const ancho = Math.sqrt(area / d.relacionLB);
  return {
    sa,
    P,
    recirculacion,
    porcentajeRecirculacion: (recirculacion / d.caudalM3d) * 100,
    qTotalM3h,
    area,
    ancho,
    largo: ancho * d.relacionLB,
    solidosKgH,
    cargaSolidos,
    aireKgH,
    aireLh: (aireKgH / 1.204) * 1000,
    cumpleSolidos: d.cargaSolidosMaxKgM2h === null ? null : cargaSolidos <= d.cargaSolidosMaxKgM2h,
  };
}
