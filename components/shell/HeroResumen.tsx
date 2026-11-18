import { registroCalculadoras } from "@/lib/calculadoras/registry";

/**
 * Bloque destacado de la portada, sobre superficie técnica oscura — mismo
 * lenguaje visual que el resto de las herramientas de cálculo de la oficina.
 */
export function HeroResumen() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[var(--superficie-tecnica)] px-6 py-10 text-white sm:px-10 sm:py-14">
      {/* Retícula de plano, muy tenue: textura, no fondo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #7cc6f5 1px, transparent 1px), linear-gradient(to bottom, #7cc6f5 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--celeste)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--exito)]" />
            Centro de cálculo
          </p>

          <h1 className="mt-5 text-3xl leading-[1.1] sm:text-4xl">
            Calculá el flujo con la fórmula a la vista.
            <br />
            <span className="text-[var(--celeste)]">Agua a presión o a superficie libre.</span>
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Pérdida de carga, bombeo desde pozos, canales con Manning y balance de embalses,
            con la sustitución numérica a la vista para poder rehacerla a mano.
          </p>

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6">
            <div>
              <dd className="font-mono text-2xl font-medium">
                {String(registroCalculadoras.length).padStart(2, "0")}
              </dd>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Calculadoras
              </dt>
            </div>
            <div>
              <dd className="font-mono text-2xl font-medium">
                {String(new Set(registroCalculadoras.map((c) => c.categoria)).size).padStart(2, "0")}
              </dd>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Áreas de cálculo
              </dt>
            </div>
            <div>
              <dd className="font-mono text-2xl font-medium">0</dd>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Backend — todo en el navegador
              </dt>
            </div>
          </dl>
        </div>

        <IlustracionFlujo />
      </div>
    </section>
  );
}

/**
 * Perfil de tubería con la línea de energía cayendo, dibujado en SVG.
 * Ilustrativo: no representa ningún cálculo concreto de la herramienta.
 */
function IlustracionFlujo() {
  return (
    <svg
      viewBox="0 0 320 130"
      className="hidden h-auto w-full max-w-sm text-[var(--celeste)] lg:block"
      fill="none"
      aria-hidden="true"
    >
      {/* Tubería */}
      <g stroke="currentColor" strokeWidth="1.4" opacity="0.85">
        <path d="M20 70 L300 95" />
        <path d="M20 95 L300 120" />
        <path d="M20 70 L20 95 M300 95 L300 120" />
      </g>

      {/* Línea de energía, cayendo más rápido que la tubería: la pérdida de carga. */}
      <g stroke="currentColor" strokeWidth="1" opacity="0.5" strokeDasharray="4 3">
        <path d="M20 40 L300 85" />
      </g>
      <text x="160" y="30" textAnchor="middle" className="fill-current font-mono" fontSize="7" opacity="0.6">
        línea de energía
      </text>

      {/* Flechas de flujo */}
      <g stroke="currentColor" strokeWidth="1.2" opacity="0.7" fill="currentColor">
        <path d="M60 85 L90 88" />
        <path d="M84 84 L92 88 L84 92" />
        <path d="M150 90 L180 93" />
        <path d="M174 89 L182 93 L174 97" />
        <path d="M230 96 L260 99" />
        <path d="M254 95 L262 99 L254 103" />
      </g>

      <text x="160" y="122" textAnchor="middle" className="fill-current font-mono" fontSize="6.5" opacity="0.45">
        esquema ilustrativo
      </text>
    </svg>
  );
}
