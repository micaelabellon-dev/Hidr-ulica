/**
 * Índice único de calculadoras: de acá salen la portada, la barra lateral y el
 * catálogo. Hoy son dos; se escribe igual que si fueran cuarenta para que
 * agregar la próxima no obligue a tocar la navegación a mano.
 */

export type IdCalculadora = "perdida-carga" | "canales-manning";

export interface CalculadoraMeta {
  id: IdCalculadora;
  nombre: string;
  descripcion: string;
  ruta: string;
  categoria: "Flujo a presión" | "Flujo a superficie libre";
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
    id: "canales-manning",
    nombre: "Canales con Manning",
    descripcion:
      "Tirante normal, velocidad y régimen de un canal rectangular, trapecial o triangular para un caudal de diseño, por la ecuación de Manning.",
    ruta: "/calculadoras/canales-manning",
    categoria: "Flujo a superficie libre",
    metodosDisponibles: ["Manning"],
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
