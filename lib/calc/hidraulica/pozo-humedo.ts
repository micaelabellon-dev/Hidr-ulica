/**
 * Pozo de bombeo (cámara húmeda) con bombas que arrancan y paran por nivel.
 *
 * Volumen útil entre niveles de arranque y parada, para no superar un número
 * de arranques por hora. El caso más desfavorable es con un caudal de entrada
 * igual a la mitad del de bombeo, que da el ciclo más corto:
 *   T_ciclo = 60 / arranques por hora  [min]
 *   V_útil  = Q_bomba · T_ciclo / 4     (Q en m³/min)
 *
 * Alturas, de arriba hacia abajo desde la tapa:
 *   nivel máx. = zampeado de la entrada más baja − revancha
 *   nivel mín. = nivel máx. − altura útil
 *   fondo      = nivel mín. − sumergencia de las bombas
 *
 * Tiempos con el caudal de entrada Qe y el de bombeo Qb:
 *   llenado t_ll = V / Qe ;  vaciado t_v = V / (Qb − Qe) ;  ciclo = t_ll + t_v
 *   detención con el caudal mínimo = V_efectivo / Q_mín  (≤ 30 min para que no
 *   se haga séptico un líquido cloacal)
 */

export type FormaPozo = "circular" | "rectangular";

export interface DatosPozoHumedo {
  /** Caudal de bombeo (de una bomba, o de las que arrancan juntas). */
  caudalBombeoLs: number;
  /** Caudal mínimo de entrada, para el tiempo de detención. */
  caudalMinimoLs: number;
  arranquesPorHora: number;
  forma: FormaPozo;
  diametroM: number;
  largoM: number;
  anchoM: number;
  /** Área en planta adoptada; si es null se calcula con la forma. */
  areaAdoptadaM2: number | null;
  /** Altura útil adoptada; si es null, la necesaria redondeada hacia arriba a 5 cm. */
  alturaUtilAdoptadaM: number | null;
  cotaTapaM: number;
  /** Cotas de zampeado de las entradas: manda la más baja. */
  cotasZampeadoM: number[];
  revanchaM: number;
  sumergenciaM: number;
  /** Altura de cada aro prefabricado (0 si no es de aros). */
  alturaAroM: number;
  tiempoDetencionMaxMin: number;
}

export interface ResultadoPozoHumedo {
  tiempoCicloMin: number;
  volumenUtilNecesarioM3: number;
  areaM2: number;
  areaCalculadaM2: number;
  alturaUtilNecesariaM: number;
  alturaUtilM: number;
  volumenUtilM3: number;
  cotaZampeadoM: number;
  profundidadZampeadoM: number;
  cotaNivelMaximoM: number;
  cotaNivelMinimoM: number;
  cotaFondoM: number;
  profundidadTotalM: number;
  cantidadAros: number | null;
  volumenTotalM3: number;
  /** Arranques por hora en el peor caso (entrada = Qb/2) con el volumen adoptado. */
  arranquesRealesPorHora: number;
  detencion: { llenadoMin: number; vaciadoMin: number | null; cicloMin: number | null; cumple: boolean };
  avisos: string[];
}

/** Redondea hacia arriba al múltiplo de `paso` (con tolerancia para no saltar por ruido). */
export function redondearArriba(x: number, paso: number): number {
  return Math.ceil(x / paso - 1e-9) * paso;
}

export function calcularPozoHumedo(d: DatosPozoHumedo): ResultadoPozoHumedo {
  const avisos: string[] = [];
  const qb = d.caudalBombeoLs / 1000; // m³/s
  const qMin = d.caudalMinimoLs / 1000;
  const tiempoCicloMin = 60 / d.arranquesPorHora;
  const volumenUtilNecesarioM3 = (qb * 60 * tiempoCicloMin) / 4;

  const areaCalculadaM2 = d.forma === "circular" ? (Math.PI * d.diametroM ** 2) / 4 : d.largoM * d.anchoM;
  const areaM2 = d.areaAdoptadaM2 ?? areaCalculadaM2;
  const alturaUtilNecesariaM = volumenUtilNecesarioM3 / areaM2;
  const alturaUtilM = d.alturaUtilAdoptadaM ?? redondearArriba(alturaUtilNecesariaM, 0.05);
  const volumenUtilM3 = alturaUtilM * areaM2;

  const cotaZampeadoM = Math.min(...d.cotasZampeadoM);
  const profundidadZampeadoM = d.cotaTapaM - cotaZampeadoM;
  const cotaNivelMaximoM = cotaZampeadoM - d.revanchaM;
  const cotaNivelMinimoM = cotaNivelMaximoM - alturaUtilM;
  const cotaFondoM = cotaNivelMinimoM - d.sumergenciaM;
  const profundidadTotalM = d.cotaTapaM - cotaFondoM;
  const cantidadAros = d.alturaAroM > 0 ? Math.ceil(profundidadTotalM / d.alturaAroM - 1e-9) : null;

  // Peor caso: entrada = Qb/2 → ciclo = 4·V/Qb.
  const cicloPeorMin = (4 * volumenUtilM3) / (qb * 60);
  const arranquesRealesPorHora = 60 / cicloPeorMin;

  const llenadoMin = volumenUtilM3 / (qMin * 60);
  const vaciadoMin = qb > qMin ? volumenUtilM3 / ((qb - qMin) * 60) : null;
  const detencion = {
    llenadoMin,
    vaciadoMin,
    cicloMin: vaciadoMin === null ? null : llenadoMin + vaciadoMin,
    cumple: llenadoMin <= d.tiempoDetencionMaxMin,
  };

  if (volumenUtilM3 < volumenUtilNecesarioM3 - 1e-9) {
    avisos.push(
      `La altura útil adoptada deja ${volumenUtilM3.toFixed(3).replace(".", ",")} m³, menos que los ${volumenUtilNecesarioM3.toFixed(3).replace(".", ",")} m³ necesarios: en el peor caso habría ${arranquesRealesPorHora.toFixed(1).replace(".", ",")} arranques por hora.`
    );
  }
  if (!detencion.cumple) {
    avisos.push(
      `Con el caudal mínimo el agua queda ${llenadoMin.toFixed(1).replace(".", ",")} min en el pozo, más que el máximo de ${d.tiempoDetencionMaxMin} min: riesgo de que un líquido cloacal se haga séptico. Achicá el volumen útil o subí los arranques permitidos.`
    );
  }
  if (cotaFondoM >= cotaZampeadoM) avisos.push("El fondo queda por encima del zampeado: revisá las alturas.");
  if (d.revanchaM < 0.1) avisos.push("Revancha menor a 10 cm entre el nivel máximo y el zampeado de entrada: el agua puede remansar en el colector.");

  return {
    tiempoCicloMin,
    volumenUtilNecesarioM3,
    areaM2,
    areaCalculadaM2,
    alturaUtilNecesariaM,
    alturaUtilM,
    volumenUtilM3,
    cotaZampeadoM,
    profundidadZampeadoM,
    cotaNivelMaximoM,
    cotaNivelMinimoM,
    cotaFondoM,
    profundidadTotalM,
    cantidadAros,
    volumenTotalM3: areaM2 * profundidadTotalM,
    arranquesRealesPorHora,
    detencion,
    avisos,
  };
}
