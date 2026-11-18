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
  | "balance-embalse";

export interface CalculadoraMeta {
  id: IdCalculadora;
  nombre: string;
  descripcion: string;
  ruta: string;
  categoria: "Flujo a presión" | "Estaciones de bombeo" | "Flujo a superficie libre" | "Hidrología y almacenamiento";
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
    categoria: "Hidrología y almacenamiento",
    metodosDisponibles: ["Paso mensual", "Paso diario"],
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
