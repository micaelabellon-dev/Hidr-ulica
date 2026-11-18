import { fmt } from "@/lib/calculadoras/formato";

interface DiagramaMceProps {
  areaAmortM2: number;
  areaImpM2: number;
  areaSinAmortM2: number;
  qEntradaM3s: number;
  qPreviaM3s: number;
  /** Pico de salida del amortiguador (SWMM), si ya se cargó. */
  qSalidaM3s: number | null;
  qSinAmortM3s: number;
  /** Pico total con MCE (salida + sin amortiguar), si ya se cargó. */
  qTotalM3s: number | null;
  trEtiqueta: string;
}

const T = { fontSize: 10, className: "fill-current font-mono" } as const;
const T_SUAVE = { fontSize: 9.5, className: "fill-muted-foreground" } as const;

function Flecha({ x1, y1, x2, y2, color = "var(--mat-agua-borde)" }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a = 6;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" />
      <path
        d={`M${x2},${y2} L${x2 - a * Math.cos(ang - 0.45)},${y2 - a * Math.sin(ang - 0.45)} L${x2 - a * Math.cos(ang + 0.45)},${y2 - a * Math.sin(ang + 0.45)} Z`}
        fill={color}
      />
    </g>
  );
}

/**
 * Esquema del sistema: el predio se divide en el área que drena al
 * amortiguador (con su parte impermeable) y el área que descarga directo;
 * ambas llegan al punto de descarga, donde se compara con la situación previa.
 * Las áreas del predio están a escala entre sí; el resto es esquemático.
 */
export function DiagramaMce(p: DiagramaMceProps) {
  const ancho = 560;
  const alto = 230;
  const total = p.areaAmortM2 + p.areaSinAmortM2 || 1;
  const px = 16;
  const py = 30;
  const pw = 170;
  const ph = 170;
  const hAmort = Math.max(24, (p.areaAmortM2 / total) * ph);
  const hSin = ph - hAmort;
  const fImp = Math.min(1, Math.max(0, p.areaImpM2 / (p.areaAmortM2 || 1)));
  const yAmort = py + hAmort / 2;
  // Amortiguador (corte)
  const ax = 268;
  const aw = 118;
  const ay = 78;
  const ah = 58;
  // Descarga
  const dx = 470;
  const dy = 150;
  const cumple = p.qTotalM3s !== null ? p.qTotalM3s <= p.qPreviaM3s : null;

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-label="Esquema del predio, el amortiguador y la descarga">
        <defs>
          <pattern id="mce-imp" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--mat-canal-borde)" strokeWidth="2" />
          </pattern>
        </defs>
        <text x={px} y={py - 12} {...T_SUAVE}>
          Predio (áreas a escala)
        </text>
        {/* Área al amortiguador: permeable + franja impermeable */}
        <rect x={px} y={py} width={pw} height={hAmort} fill="var(--mat-planta)" opacity="0.28" stroke="var(--mat-planta)" />
        <rect x={px} y={py} width={pw * fImp} height={hAmort} fill="url(#mce-imp)" opacity="0.9" />
        <rect x={px} y={py} width={pw * fImp} height={hAmort} fill="var(--mat-canal)" opacity="0.45" />
        <text x={px + 6} y={py + 14} {...T}>
          al MCE: {fmt(p.areaAmortM2, 0)} m²
        </text>
        <text x={px + 6} y={py + 27} {...T_SUAVE}>
          impermeable {fmt(fImp * 100, 0)} %
        </text>
        {/* Área sin amortiguar */}
        {hSin > 0.5 && (
          <rect x={px} y={py + hAmort} width={pw} height={hSin} fill="var(--mat-terreno)" stroke="var(--mat-canal-borde)" />
        )}
        <text x={px} y={py + ph + 16} {...T_SUAVE}>
          sin amortiguar: {fmt(p.areaSinAmortM2, 0)} m²
        </text>

        {/* Entrada al amortiguador */}
        <Flecha x1={px + pw + 4} y1={yAmort} x2={ax - 6} y2={ay + 18} />
        <text x={(px + pw + ax) / 2} y={Math.min(yAmort, ay + 18) - 10} textAnchor="middle" {...T}>
          {fmt(p.qEntradaM3s, 3)} m³/s
        </text>
        <text x={(px + pw + ax) / 2} y={Math.min(yAmort, ay + 18) + 22} textAnchor="middle" {...T_SUAVE}>
          {p.trEtiqueta}
        </text>

        {/* Amortiguador: corte trapecial con agua y orificio de salida */}
        <path d={`M${ax},${ay} L${ax + 14},${ay + ah} L${ax + aw - 14},${ay + ah} L${ax + aw},${ay}`} fill="none" stroke="var(--mat-canal-borde)" strokeWidth="3" />
        <path d={`M${ax + 5},${ay + 18} L${ax + 14},${ay + ah - 1} L${ax + aw - 14},${ay + ah - 1} L${ax + aw - 5},${ay + 18} Z`} className="fill-mat-agua" />
        <line x1={ax + 5} x2={ax + aw - 5} y1={ay + 18} y2={ay + 18} stroke="var(--mat-agua-borde)" strokeWidth="1.5" />
        <text x={ax + aw / 2} y={ay - 10} textAnchor="middle" {...T}>
          Amortiguador (SWMM)
        </text>
        <rect x={ax + aw - 16} y={ay + ah - 12} width={20} height={9} className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" />

        {/* Salida del amortiguador a la descarga */}
        <Flecha x1={ax + aw + 6} y1={ay + ah - 8} x2={dx - 14} y2={dy - 8} />
        <text x={ax + aw + 8} y={ay + ah - 22} {...T}>
          {p.qSalidaM3s !== null ? `${fmt(p.qSalidaM3s, 3)} m³/s` : "salida SWMM"}
        </text>

        {/* Área sin amortiguar directo a la descarga */}
        <path
          d={`M${px + pw + 4},${py + hAmort + Math.max(hSin, 6) / 2} H${dx - 30} Q${dx - 18},${py + hAmort + Math.max(hSin, 6) / 2} ${dx - 14},${dy + 2}`}
          fill="none"
          stroke="var(--mat-agua-borde)"
          strokeWidth="2"
          strokeDasharray="5 3"
        />
        <text x={(px + pw + dx) / 2 - 20} y={py + hAmort + Math.max(hSin, 6) / 2 - 6} textAnchor="middle" {...T_SUAVE}>
          sin amortiguar {fmt(p.qSinAmortM3s, 4)} m³/s
        </text>

        {/* Descarga */}
        <circle cx={dx} cy={dy} r="12" fill="none" stroke={cumple === false ? "var(--mat-critico)" : "var(--mat-cota)"} strokeWidth="2.5" />
        <circle cx={dx} cy={dy} r="4" fill={cumple === false ? "var(--mat-critico)" : "var(--mat-cota)"} />
        <text x={dx + 16} y={dy - 18} textAnchor="middle" {...T}>
          {p.qTotalM3s !== null ? `${fmt(p.qTotalM3s, 3)} m³/s` : "descarga"}
        </text>
        <text x={dx + 16} y={dy + 30} textAnchor="middle" {...T_SUAVE}>
          previa ≤ {fmt(p.qPreviaM3s, 3)} m³/s
        </text>
      </svg>
    </figure>
  );
}
