/**
 * Conversión y formato de números, compartidos por las dos calculadoras.
 */

/** Texto de un campo a número. Acepta coma decimal, que es como se escribe acá. */
export function aNumero(texto: string): number {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Número para mostrar, con coma decimal y punto de miles.
 * Se usa siempre junto a `tabular-nums` para que no cambie de ancho al
 * recalcular mientras se tipea.
 */
export function fmt(n: number, decimales = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
