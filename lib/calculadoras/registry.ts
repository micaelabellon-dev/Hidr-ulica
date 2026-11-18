/**
 * Índice único de calculadoras: de acá salen la portada, la barra lateral y el
 * catálogo. Hoy son dos; se escribe igual que si fueran cuarenta para que
 * agregar la próxima no obligue a tocar la navegación a mano.
 */

export type IdCalculadora = "perdida-carga" | "bombeo-pozo" | "canales-manning" | "balance-embalse";

export interface CalculadoraMeta {
  id: IdCalculadora;
  nombre: string;
  descripcion: string;
  ruta: string;
  categoria: "Flujo a presión" | "Flujo a superficie libre" | "Hidrología y almacenamiento";
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
    id: "bombeo-pozo",
    nombre: "Bombeo desde pozo",
    descripcion:
      "Altura manométrica en nivel mínimo y máximo, curva del sistema y punto de operación con la curva de la bomba, rendimiento, potencia y verificación de NPSH o sumergencia.",
    ruta: "/calculadoras/bombeo-pozo",
    categoria: "Flujo a presión",
    metodosDisponibles: ["Darcy-Weisbach", "Hazen-Williams"],
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
