/**
 * Índice único de calculadoras: de acá salen la portada, la barra lateral y el
 * catálogo. Hoy son dos; se escribe igual que si fueran cuarenta para que
 * agregar la próxima no obligue a tocar la navegación a mano.
 */

export type IdCalculadora =
  | "perdida-carga"
  | "golpe-ariete"
  | "bombeo-pozo"
  | "pozo-humedo"
  | "canales-manning"
  | "balance-embalse"
  | "tormenta-tr"
  | "amoniaco-libre"
  | "laguna-facultativa"
  | "humedal-vertical"
  | "desinfeccion-cloro"
  | "mezcla-rapida"
  | "floculacion"
  | "sedimentador"
  | "daf"
  | "dispersion-chimenea"
  | "cumplimiento-aire";

export interface CalculadoraMeta {
  id: IdCalculadora;
  nombre: string;
  descripcion: string;
  ruta: string;
  categoria: "Flujo a presión" | "Estaciones de bombeo" | "Flujo a superficie libre" | "Hidrología" | "Calidad de agua" | "Tratamiento de efluentes" | "Potabilización" | "Calidad de aire";
  /** Métodos o fórmulas entre los que se puede elegir, para que la tarjeta los muestre como "norma". */
  metodosDisponibles: readonly string[];
}

export const registroCalculadoras: CalculadoraMeta[] = [
  {
    id: "perdida-carga",
    nombre: "Pérdida de carga en tuberías",
    descripcion:
      "Pérdida por fricción en un tramo a presión, con Darcy-Weisbach (Colebrook-White) o Hazen-Williams, y pérdidas localizadas por accesorios.",
    ruta: "/calculadoras/perdida-carga",
    categoria: "Flujo a presión",
    metodosDisponibles: ["Darcy-Weisbach", "Hazen-Williams"],
  },
  {
    id: "golpe-ariete",
    nombre: "Golpe de ariete",
    descripcion:
      "Celeridad, fase y tiempo de parada (Mendiluce), sobrepresión de Joukowsky o Michaud y presiones extremas en una impulsión, contra la presión nominal de la tubería.",
    ruta: "/calculadoras/golpe-ariete",
    categoria: "Flujo a presión",
    metodosDisponibles: ["Allievi", "Michaud", "Mendiluce"],
  },
  {
    id: "bombeo-pozo",
    nombre: "Bombeo: altura, bomba y potencia",
    descripcion:
      "Altura manométrica por tramos con accesorios en nivel mínimo, medio y máximo, curva del sistema, punto de operación con una o varias bombas, potencia del motor y verificación de NPSH o sumergencia.",
    ruta: "/calculadoras/bombeo-pozo",
    categoria: "Estaciones de bombeo",
    metodosDisponibles: ["Hazen-Williams", "Darcy-Weisbach"],
  },
  {
    id: "pozo-humedo",
    nombre: "Pozo de bombeo (cámara húmeda)",
    descripcion:
      "Volumen útil por arranques por hora, alturas y cotas de niveles y fondo, cantidad de aros y tiempo de detención de una cámara de bombeo.",
    ruta: "/calculadoras/pozo-humedo",
    categoria: "Estaciones de bombeo",
    metodosDisponibles: ["Arranques por hora"],
  },
  {
    id: "canales-manning",
    nombre: "Canales con Manning",
    descripcion:
      "Tirante normal, velocidad y régimen de un canal rectangular, trapecial o triangular para un caudal de diseño, por la ecuación de Manning.",
    ruta: "/calculadoras/canales-manning",
    categoria: "Flujo a superficie libre",
    metodosDisponibles: ["Manning"],
  },
  {
    id: "balance-embalse",
    nombre: "Balance hídrico de embalse",
    descripcion:
      "Operación de un embalse paso a paso, mensual o diario: volumen, cota, vertidos y déficit a partir de aportes, lluvia, evaporación, extracciones y la curva cota-área-volumen.",
    ruta: "/calculadoras/balance-embalse",
    categoria: "Hidrología",
    metodosDisponibles: ["Paso mensual", "Paso diario"],
  },
  {
    id: "tormenta-tr",
    nombre: "Período de retorno de una tormenta",
    descripcion:
      "TR de una lluvia observada (hietograma, acumulada o total) por duración, con las IDF de Uruguay (Rodríguez Fontal), una fórmula, una tabla IDF o un ajuste de Gumbel a máximos anuales.",
    ruta: "/calculadoras/tormenta-tr",
    categoria: "Hidrología",
    metodosDisponibles: ["Uruguay (Rodríguez Fontal)", "Fórmula IDF", "Tabla IDF", "Gumbel (máximos anuales)"],
  },
  {
    id: "amoniaco-libre",
    nombre: "Amoníaco libre (NH₃) a partir de amonio",
    descripcion:
      "Fracción de amoníaco no ionizado según pH y temperatura (Emerson et al., 1975), en mg como NH₄⁺, NH₃ o N, comparación con un límite y amonio total máximo admisible, para una o varias muestras.",
    ruta: "/calculadoras/amoniaco-libre",
    categoria: "Calidad de agua",
    metodosDisponibles: ["Emerson et al. (1975)"],
  },
  {
    id: "sedimentador",
    nombre: "Sedimentador",
    descripcion: "Decantador convencional (carga superficial, retención, vertedero, remoción primaria) o laminar de placas (Yao), y velocidad de Stokes.",
    ruta: "/calculadoras/sedimentador",
    categoria: "Tratamiento de efluentes",
    metodosDisponibles: ["Convencional", "Laminar (placas)"],
  },
  {
    id: "daf",
    nombre: "Flotación por aire disuelto (DAF)",
    descripcion: "Recirculación presurizada por la relación aire/sólidos, área por carga hidráulica, carga de sólidos y aire necesario.",
    ruta: "/calculadoras/daf",
    categoria: "Tratamiento de efluentes",
    metodosDisponibles: ["Relación A/S"],
  },
  {
    id: "laguna-facultativa",
    nombre: "Laguna facultativa",
    descripcion:
      "Área por carga superficial según la temperatura, volumen con taludes, tiempo de retención y remoción de DBO, coliformes, nitrógeno y fósforo por flujo disperso, limpia y con lodo, y años entre limpiezas.",
    ruta: "/calculadoras/laguna-facultativa",
    categoria: "Tratamiento de efluentes",
    metodosDisponibles: ["von Sperling", "Flujo disperso"],
  },
  {
    id: "humedal-vertical",
    nombre: "Humedal de flujo vertical",
    descripcion:
      "Área por tasa de carga hidráulica en trenes, capas filtrantes y materiales, tiempo de retención, remociones y verificación del área por el modelo P-k-C* de Kadlec.",
    ruta: "/calculadoras/humedal-vertical",
    categoria: "Tratamiento de efluentes",
    metodosDisponibles: ["Carga hidráulica", "P-k-C*"],
  },
  {
    id: "desinfeccion-cloro",
    nombre: "Desinfección con cloro",
    descripcion:
      "Concentración de cloro por Chick-Watson corregida por temperatura, dosis total, consumo de hipoclorito y caudal de la dosificadora, y volumen de contacto en cámara o tubería.",
    ruta: "/calculadoras/desinfeccion-cloro",
    categoria: "Tratamiento de efluentes",
    metodosDisponibles: ["Chick-Watson"],
  },
  {
    id: "mezcla-rapida",
    nombre: "Mezcla rápida (coagulación)",
    descripcion: "Gradiente y tiempo de mezcla con placa orificio o canaleta Parshall con resalto hidráulico, y comparación de medidas de Parshall.",
    ruta: "/calculadoras/mezcla-rapida",
    categoria: "Potabilización",
    metodosDisponibles: ["Placa orificio", "Canaleta Parshall"],
  },
  {
    id: "floculacion",
    nombre: "Floculación",
    descripcion: "Ajuste G·Tⁿ = K de ensayos de jarras y diseño de floculadores mecánicos de paletas o hidráulicos de tabiques con flujo horizontal o vertical.",
    ruta: "/calculadoras/floculacion",
    categoria: "Potabilización",
    metodosDisponibles: ["Paletas (mecánico)", "Tabiques flujo horizontal", "Tabiques flujo vertical"],
  },
  {
    id: "dispersion-chimenea",
    nombre: "Dispersión de contaminantes (chimenea)",
    descripcion: "Modelo gaussiano de pluma: viento con la altura, sobreelevación de Holland, σ de Briggs o leídos a mano, concentración en un receptor y máximo a nivel del suelo; emisión por factor.",
    ruta: "/calculadoras/dispersion-chimenea",
    categoria: "Calidad de aire",
    metodosDisponibles: ["Gaussiano", "Holland", "Briggs"],
  },
  {
    id: "cumplimiento-aire",
    nombre: "Cumplimiento de calidad de aire",
    descripcion: "Promedios diarios y del período a partir de mediciones horarias, contra los estándares diario y anual.",
    ruta: "/calculadoras/cumplimiento-aire",
    categoria: "Calidad de aire",
    metodosDisponibles: ["Promedios"],
  },
];

export function buscarCalculadora(id: IdCalculadora): CalculadoraMeta {
  const meta = registroCalculadoras.find((c) => c.id === id);
  if (!meta) throw new Error(`Calculadora no registrada: ${id}`);
  return meta;
}

export function agruparPorCategoria(
  items: readonly CalculadoraMeta[]
): [string, CalculadoraMeta[]][] {
  const grupos = new Map<string, CalculadoraMeta[]>();
  for (const item of items) {
    const lista = grupos.get(item.categoria) ?? [];
    lista.push(item);
    grupos.set(item.categoria, lista);
  }
  return [...grupos.entries()];
}
