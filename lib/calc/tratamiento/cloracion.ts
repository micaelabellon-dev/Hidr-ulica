/**
 * Desinfección con cloro.
 *
 * Chick-Watson:  log10(N0/N) = λ_T · Cⁿ · t     →   C = [log10(N0/N) / (λ_T·t)]^(1/n)
 * con λ corregido por temperatura: λ_T = λ_20 · Q10^((T − 20)/10).
 * Dosis total = C (inactivación) + residual + demanda inmediata + consumo previo,
 * redondeada al mg/L.
 * Producto: masa de cloro = dosis·Q; hipoclorito = masa / fracción de cloro
 * activo; volumen = masa de producto / densidad; caudal de la dosificadora
 * según las horas de dosificación por día.
 * Contacto: V = Q·t; en cámara (L·B → H) o en tubería (D → L).
 */

export interface DatosCloracion {
  caudalM3d: number;
  cfInicial: number;
  cfFinal: number;
  tiempoMin: number;
  lambda20: number;
  q10: number;
  temperaturaC: number;
  n: number;
  residualMgL: number;
  demandaInmediataMgL: number;
  consumoPrevioMgL: number;
  redondearDosis: boolean;
  fraccionActiva: number;
  densidadGmL: number;
  horasDosificacion: number;
  camara: { largoM: number; anchoM: number };
  tuberiaDiametroM: number;
}

export interface ResultadoCloracion {
  lambdaT: number;
  logRemocion: number;
  remocionPct: number;
  concentracionMgL: number;
  ctMgMinL: number;
  dosisTotalMgL: number;
  masaCloroGd: number;
  masaProductoGd: number;
  volumenProductoLd: number;
  caudalDosificadoraLh: number;
  volumenContactoM3: number;
  alturaCamaraM: number;
  largoTuberiaM: number;
}

export function calcularCloracion(d: DatosCloracion): ResultadoCloracion {
  const lambdaT = d.lambda20 * d.q10 ** ((d.temperaturaC - 20) / 10);
  const logRemocion = Math.log10(d.cfInicial / d.cfFinal);
  const concentracionMgL = (logRemocion / (lambdaT * d.tiempoMin)) ** (1 / d.n);
  const suma = concentracionMgL + d.residualMgL + d.demandaInmediataMgL + d.consumoPrevioMgL;
  const dosisTotalMgL = d.redondearDosis ? Math.round(suma) : suma;
  const masaCloroGd = dosisTotalMgL * d.caudalM3d;
  const masaProductoGd = masaCloroGd / d.fraccionActiva;
  const volumenProductoLd = masaProductoGd / d.densidadGmL / 1000;
  const volumenContactoM3 = (d.caudalM3d * d.tiempoMin) / (60 * 24);
  return {
    lambdaT,
    logRemocion,
    remocionPct: ((d.cfInicial - d.cfFinal) * 100) / d.cfInicial,
    concentracionMgL,
    ctMgMinL: concentracionMgL * d.tiempoMin,
    dosisTotalMgL,
    masaCloroGd,
    masaProductoGd,
    volumenProductoLd,
    caudalDosificadoraLh: volumenProductoLd / d.horasDosificacion,
    volumenContactoM3,
    alturaCamaraM: volumenContactoM3 / (d.camara.largoM * d.camara.anchoM),
    largoTuberiaM: (4 * volumenContactoM3) / (Math.PI * d.tuberiaDiametroM ** 2),
  };
}
