import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { registroCalculadoras } from "@/lib/calculadoras/registry";

/**
 * Bloque destacado de la portada: título en serif sobre crema, botón rosa
 * terracota y, debajo, la franja de indicadores en una cápsula.
 */
export function HeroResumen() {
  const indicadores = [
    [`+${registroCalculadoras.length}`, "calculadoras"],
    [String(new Set(registroCalculadoras.map((c) => c.categoria)).size), "áreas de cálculo"],
    ["100 %", "en el navegador"],
  ] as const;

  return (
    <section className="space-y-8">
      <div className="relative grid gap-10 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--superficie-tecnica)] via-card to-accent/70 px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="relative max-w-xl">
          <p className="spec-label">Centro de cálculo</p>
          <h1 className="mt-4 text-5xl leading-[1.02] sm:text-6xl">
            Tu cálculo,
            <br />
            <span className="italic text-primary">con la fórmula a la vista.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Hidráulica, hidrología, tratamiento de efluentes, potabilización y calidad de aire: cada resultado con su sustitución
            numérica para poder rehacerlo a mano.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/calculadoras"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Ver calculadoras
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/alcance"
              className="inline-flex h-11 items-center rounded-full border border-primary/40 px-6 text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              Alcance y responsabilidad
            </Link>
          </div>
        </div>

        <IlustracionAgua />
      </div>

      <dl className="mx-auto grid max-w-3xl grid-cols-3 divide-x divide-border rounded-full border border-border bg-card/80 px-2 py-4 shadow-sm backdrop-blur">
        {indicadores.map(([valor, etiqueta]) => (
          <div key={etiqueta} className="flex flex-col items-center gap-0.5 px-2 text-center sm:flex-row sm:justify-center sm:gap-2">
            <dd className="font-heading text-2xl font-semibold text-primary">{valor}</dd>
            <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Ilustración: un círculo de agua con un perfil de tubería y su línea de
 * energía. Decorativa, no representa un cálculo concreto.
 */
function IlustracionAgua() {
  return (
    <svg viewBox="0 0 360 300" className="mx-auto hidden h-auto w-full max-w-sm lg:block" fill="none" aria-hidden="true">
      <circle cx="190" cy="150" r="128" fill="var(--accent)" />
      <circle cx="190" cy="150" r="98" fill="var(--card)" opacity="0.7" />
      {/* Ondas de agua dentro del círculo */}
      <clipPath id="hero-circulo">
        <circle cx="190" cy="150" r="98" />
      </clipPath>
      <g clipPath="url(#hero-circulo)">
        <path d="M80 175 Q115 160 150 175 T220 175 T290 175 V260 H80 Z" fill="var(--mat-agua)" />
        <path d="M80 190 Q115 178 150 190 T220 190 T290 190" stroke="var(--mat-agua-borde)" strokeWidth="1.5" opacity="0.7" />
      </g>
      {/* Gota */}
      <path d="M190 64 C190 64 222 108 222 130 C222 148 207 162 190 162 C173 162 158 148 158 130 C158 108 190 64 190 64 Z" fill="var(--primary)" opacity="0.9" />
      <path d="M176 128 C176 118 182 108 186 102" stroke="var(--primary-foreground)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      {/* Línea de energía punteada */}
      <path d="M40 92 L330 150" stroke="var(--primary)" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.6" />
      <text x="44" y="84" fontSize="11" fontStyle="italic" className="fill-[var(--muted-foreground)]" style={{ fontFamily: "var(--font-display), serif" }}>
        línea de energía
      </text>
    </svg>
  );
}
