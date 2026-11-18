/**
 * Logotipo de HidroCalc: una gota y la palabra en serif, con «Calc» en
 * cursiva rosa terracota.
 *
 * Va dibujado en SVG, no como imagen: escala sin perder filo a cualquier
 * tamaño, hereda el color del texto —funciona igual en tema claro y oscuro, y
 * sale en negro en las hojas impresas—, y pesa unos pocos cientos de bytes.
 */

interface LogoProps {
  className?: string;
  titulo?: string;
}

export function Logo({ className, titulo = "HidroCalc" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 300 80"
      className={className}
      role={titulo ? "img" : "presentation"}
      aria-label={titulo || undefined}
      aria-hidden={titulo ? undefined : true}
      fill="currentColor"
    >
      {/* Gota, con el rosa terracota de la marca. */}
      <g className="text-[var(--brillante)]">
        <Gota x={2} y={16} escala={1.45} />
      </g>
      <text x={42} y={60} fontFamily="var(--font-display), Georgia, serif" fontWeight={500} fontSize={60} letterSpacing={0.5}>
        Hidro
        <tspan className="text-[var(--brillante)]" fill="currentColor" fontStyle="italic">
          Calc
        </tspan>
      </text>
    </svg>
  );
}

/** Marca sola, para los lugares donde no entra la palabra completa. */
export function MarcaGota({ className, titulo = "HidroCalc" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 40 52"
      className={className}
      role={titulo ? "img" : "presentation"}
      aria-label={titulo || undefined}
      aria-hidden={titulo ? undefined : true}
      fill="currentColor"
    >
      <Gota x={0} y={0} escala={1.9} />
    </svg>
  );
}

function Gota({ x, y, escala = 1 }: { x: number; y: number; escala?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <path d="M10 0 C10 0 19 13.5 19 20.5 C19 25.7 14.97 30 10 30 C5.03 30 1 25.7 1 20.5 C1 13.5 10 0 10 0 Z" />
    </g>
  );
}
