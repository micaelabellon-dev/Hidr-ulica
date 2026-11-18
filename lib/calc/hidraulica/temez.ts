/**
 * Modelo de Témez (1977): balance de humedad del suelo mes a mes para estimar
 * el escurrimiento de una cuenca a partir de la precipitación y la ETP.
 *
 *   Hmax = CAD · AD                         capacidad máxima de humedad del suelo
 *   δ    = Hmax − H(i−1) + ETP
 *   P0   = CPo · (Hmax − H(i−1))            umbral de escorrentía
 *   T    = 0 si P ≤ P0 ;  (P − P0)² / (P + δ − 2·P0) si no      excedente
 *   H    = máx(0; H(i−1) + P − T − ETP)     humedad al final del mes
 *   ETR  = mín(H(i−1) + P − T; ETP)
 *   I    = Imax · T / (T + Imax)            infiltración al acuífero
 *   Asup = T − I                            escorrentía superficial
 *   V    = V(i−1)·e^(−α·d) + I·e^(−α·d/2)   almacenamiento subterráneo (d = días del mes)
 *   Asub = V(i−1) − V + I                   escorrentía subterránea
 *   A    = Asup + Asub                      aporte total, en mm sobre la cuenca
 *
 * Parámetros de partida para Uruguay: Genta et al. (2001), CAD 0,92, CPo 0,3,
 * Imax 386 mm, α 0,0775 1/día; AD del suelo según las unidades CONEAT/CRSU.
 */

export interface ParametrosTemez {
  /** Agua disponible del suelo, mm. */
  aguaDisponibleMm: number;
  cad: number;
  cpo: number;
  imaxMm: number;
  /** Coeficiente de descarga del acuífero, 1/día. */
  alfaDia: number;
  humedadInicialMm: number;
  almacenamientoInicialMm: number;
}

export interface MesTemez {
  fecha: string;
  dias: number;
  precipitacionMm: number;
  etpMm: number;
}

export interface PasoTemez extends MesTemez {
  delta: number;
  p0: number;
  excedente: number;
  humedad: number;
  etr: number;
  infiltracion: number;
  escorrentiaSuperficial: number;
  almacenamiento: number;
  escorrentiaSubterranea: number;
  aporteMm: number;
  /** Caudal específico medio del mes, L/s/km². */
  caudalEspecificoLsKm2: number;
}

export const PARAMETROS_TEMEZ_URUGUAY = { cad: 0.92, cpo: 0.3, imaxMm: 386, alfaDia: 0.0775 } as const;

/** AD ponderado por área: Σ(Aᵢ·ADᵢ) / ΣAᵢ. */
export function aguaDisponiblePonderada(unidades: readonly { areaHa: number; adMm: number }[]): number {
  const area = unidades.reduce((s, u) => s + u.areaHa, 0);
  return unidades.reduce((s, u) => s + u.areaHa * u.adMm, 0) / area;
}

export function calcularTemez(meses: readonly MesTemez[], p: ParametrosTemez): PasoTemez[] {
  const hmax = p.cad * p.aguaDisponibleMm;
  let h = p.humedadInicialMm;
  let v = p.almacenamientoInicialMm;
  return meses.map((m) => {
    const delta = hmax - h + m.etpMm;
    const p0 = p.cpo * (hmax - h);
    const excedente = m.precipitacionMm <= p0 ? 0 : (m.precipitacionMm - p0) ** 2 / (m.precipitacionMm + delta - 2 * p0);
    const humedad = Math.max(0, h + m.precipitacionMm - excedente - m.etpMm);
    const etr = Math.min(h + m.precipitacionMm - excedente, m.etpMm);
    const infiltracion = (p.imaxMm * excedente) / (excedente + p.imaxMm);
    const escorrentiaSuperficial = excedente - infiltracion;
    const almacenamiento = v * Math.exp(-p.alfaDia * m.dias) + infiltracion * Math.exp((-p.alfaDia * m.dias) / 2);
    const escorrentiaSubterranea = v - almacenamiento + infiltracion;
    const aporteMm = escorrentiaSuperficial + escorrentiaSubterranea;
    h = humedad;
    v = almacenamiento;
    return {
      ...m,
      delta,
      p0,
      excedente,
      humedad,
      etr,
      infiltracion,
      escorrentiaSuperficial,
      almacenamiento,
      escorrentiaSubterranea,
      aporteMm,
      caudalEspecificoLsKm2: (aporteMm * 1000) / (m.dias * 86.4),
    };
  });
}
