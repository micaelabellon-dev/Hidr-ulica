import { fmt } from "@/lib/calculadoras/formato";

interface DiagramaPozoHumedoProps {
  cotaTapaM: number;
  cotaZampeadoM: number;
  cotaNivelMaximoM: number;
  cotaNivelMinimoM: number;
  cotaFondoM: number;
  cantidadAros: number | null;
  alturaAroM: number;
}

/**
 * Corte del pozo a escala vertical: tapa, entrada, niveles de arranque y
 * parada, fondo y la bomba sumergida. El ancho es esquemático.
 */
export function DiagramaPozoHumedo(p: DiagramaPozoHumedoProps) {
  const alto = 300;
  const top = 18;
  const bottom = alto - 16;
  const rango = p.cotaTapaM - p.cotaFondoM || 1;
  const y = (z: number) => top + ((p.cotaTapaM - z) / rango) * (bottom - top);
  const x0 = 120;
  const x1 = 250;
  const pared = 8;
  const cotas: [number, string, string][] = [
    [p.cotaTapaM, "Tapa", "var(--muted-foreground)"],
    [p.cotaZampeadoM, "Zampeado entrada", "var(--muted-foreground)"],
    [p.cotaNivelMaximoM, "Nivel máx. (arranque)", "var(--mat-cota)"],
    [p.cotaNivelMinimoM, "Nivel mín. (parada)", "var(--mat-cota)"],
    [p.cotaFondoM, "Fondo", "var(--muted-foreground)"],
  ];
  const aros =
    p.cantidadAros && p.alturaAroM > 0
      ? Array.from({ length: p.cantidadAros - 1 }, (_, i) => p.cotaTapaM - (i + 1) * p.alturaAroM).filter((z) => z > p.cotaFondoM)
      : [];

  return (
    <figure className="esquemas-acotados">
      <svg viewBox={`0 0 460 ${alto}`} className="w-full" role="img" aria-label="Corte del pozo de bombeo con sus cotas">
        {/* Agua entre el fondo y el nivel máximo */}
        <rect x={x0} y={y(p.cotaNivelMaximoM)} width={x1 - x0} height={y(p.cotaFondoM) - y(p.cotaNivelMaximoM)} className="fill-mat-agua" />
        <rect
          x={x0}
          y={y(p.cotaNivelMaximoM)}
          width={x1 - x0}
          height={y(p.cotaNivelMinimoM) - y(p.cotaNivelMaximoM)}
          fill="var(--mat-cota)"
          opacity="0.12"
        />
        {/* Paredes y losa de fondo */}
        <rect x={x0 - pared} y={top} width={pared} height={bottom - top + pared} className="fill-mat-canal" stroke="var(--mat-canal-borde)" />
        <rect x={x1} y={top} width={pared} height={bottom - top + pared} className="fill-mat-canal" stroke="var(--mat-canal-borde)" />
        <rect x={x0 - pared} y={bottom} width={x1 - x0 + 2 * pared} height={pared} className="fill-mat-canal" stroke="var(--mat-canal-borde)" />
        <line x1={x0 - pared - 6} x2={x1 + pared + 6} y1={top} y2={top} stroke="var(--foreground)" strokeWidth="2" />
        {aros.map((z) => (
          <line key={z} x1={x0 - pared} x2={x0} y1={y(z)} y2={y(z)} stroke="var(--mat-canal-borde)" strokeWidth="1" />
        ))}
        {/* Caño de entrada */}
        <rect x={x0 - pared - 60} y={y(p.cotaZampeadoM) - 14} width={60 + pared} height={14} className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" />
        {/* Bomba */}
        <rect x={(x0 + x1) / 2 - 16} y={y(p.cotaFondoM) - 34} width={32} height={30} rx="4" className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" />
        <line x1={(x0 + x1) / 2} x2={(x0 + x1) / 2} y1={y(p.cotaFondoM) - 34} y2={top + 4} stroke="var(--mat-tuberia-borde)" strokeWidth="5" opacity="0.7" />
        {/* Cotas */}
        {cotas.map(([z, nombre, color], i) => {
          const yy = y(z);
          return (
            <g key={nombre}>
              <line x1={x1 + pared} x2={x1 + 24} y1={yy} y2={yy} stroke={color} strokeDasharray={i === 2 || i === 3 ? "4 2" : undefined} />
              <line x1={x0} x2={x1} y1={yy} y2={yy} stroke={color} strokeDasharray="3 3" opacity={i === 2 || i === 3 ? 0.9 : 0} />
              <text x={x1 + 28} y={yy} dominantBaseline="middle" fontSize="10.5" className="fill-current font-mono">
                {fmt(z, 2)}
              </text>
              <text x={x1 + 70} y={yy} dominantBaseline="middle" fontSize="10" className="fill-muted-foreground">
                {nombre}
              </text>
            </g>
          );
        })}
        <text x={10} y={y(p.cotaZampeadoM) - 20} fontSize="10" className="fill-muted-foreground">
          entrada
        </text>
      </svg>
    </figure>
  );
}
