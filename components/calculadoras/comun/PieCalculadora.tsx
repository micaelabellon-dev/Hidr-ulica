import Link from "next/link";

/**
 * Pie de toda página de calculadora: qué respalda el número y quién responde
 * por él. Va en el layout y no en cada página porque es la condición en la
 * que se entrega cualquier resultado, no una nota opcional de un módulo.
 *
 * Se imprime a propósito: la hoja impresa es la que se adjunta a una memoria
 * de cálculo, así que es justo donde el alcance no puede faltar.
 */
export function PieCalculadora() {
  return (
    <footer className="mx-auto w-full max-w-7xl px-6 pb-10 print:px-0">
      <div className="space-y-3 border-t border-border pt-6 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">HidroCalc es una herramienta de verificación.</strong>{" "}
          No reemplaza el criterio del proyectista ni la firma de un técnico habilitado, y el
          resultado no vale como memoria de cálculo por sí solo. Cada página deja a la vista la
          fórmula y la sustitución numérica para poder rehacerla a mano.
        </p>
        <p className="print:hidden">
          <Link href="/alcance" className="underline underline-offset-2 hover:text-foreground">
            Alcance y responsabilidad
          </Link>
        </p>
      </div>
    </footer>
  );
}
