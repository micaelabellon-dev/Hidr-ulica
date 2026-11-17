import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Alcance y responsabilidad",
  description: "Qué respalda cada resultado de HidroCalc y quién responde por el cálculo.",
};

export default function AlcancePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <div className="flex items-center justify-between gap-4 print:hidden md:hidden">
        <Link href="/" aria-label="HidroCalc — inicio">
          <Logo className="h-7 w-auto" titulo="" />
        </Link>
      </div>

      <div>
        <p className="spec-label">Antes de usar un resultado</p>
        <h1 className="text-3xl font-semibold tracking-tight">Alcance y responsabilidad</h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Qué es esto, y qué no es</h2>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            HidroCalc es una <strong className="text-foreground">herramienta de verificación</strong>:
            resuelve la pérdida de carga de un tramo de tubería (Darcy-Weisbach o Hazen-Williams) y el
            tirante normal de un canal (Manning) a partir de los datos que se cargan, y deja a la
            vista la fórmula y la sustitución numérica para que el resultado se pueda rehacer a mano.
          </p>
          <p>
            <strong className="text-foreground">No es un programa de diseño</strong> y no decide por
            vos: no elige el trazado de la red ni del canal, no evalúa el riesgo de erosión o
            sedimentación, no agrega el resguardo (borde libre) necesario sobre el tirante calculado,
            y no avisa cuando el problema real no es el que se está calculando. Esas decisiones siguen
            siendo del proyectista.
          </p>
          <p>
            <strong className="text-foreground">No reemplaza la firma de un técnico habilitado</strong>{" "}
            ni vale como memoria de cálculo por sí solo. La hoja que se imprime desde cada calculadora
            sirve para adjuntar al expediente, pero quien la firma es quien responde por ella.
          </p>
          <p className="rounded-md border p-3">
            Este texto describe el alcance de la herramienta con la mayor honestidad posible, pero{" "}
            <strong className="text-foreground">no fue revisado por un abogado</strong> y no pretende
            ser una cláusula de exención de responsabilidad.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Qué hipótesis usa cada calculadora</h2>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Pérdida de carga.</strong> Tubería llena, flujo
            permanente e incompresible. El factor de fricción de Darcy-Weisbach sale de
            Colebrook-White, resuelto por iteración numérica; en régimen laminar (Re &lt; 2300) se usa
            f = 64/Re. Hazen-Williams es una fórmula empírica, válida sólo para agua a temperatura
            ambiente. Las pérdidas localizadas se suman como un único Σ K, a cargo de quien calcula
            elegir los coeficientes de catálogo que correspondan a los accesorios reales del tramo.
          </p>
          <p>
            <strong className="text-foreground">Canales con Manning.</strong> Flujo uniforme y
            permanente, sección prismática (no varía a lo largo del canal) y pendiente de fondo
            pequeña. El tirante es el normal, el que se alcanza lejos de cualquier control de aguas
            abajo: no corresponde a un resalto, una curva ni una transición de sección.
          </p>
        </div>
      </section>

      <p className="print:hidden">
        <Link href="/" className="text-sm underline underline-offset-2 hover:text-foreground">
          ← Volver al inicio
        </Link>
      </p>
    </main>
  );
}
