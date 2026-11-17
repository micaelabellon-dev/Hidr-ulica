import { fmt } from "@/lib/calculadoras/formato";

interface DiagramaPerdidaCargaProps {
  longitudM: number;
  perdidaTotalM: number;
}

/**
 * Perfil esquemático del tramo: la tubería horizontal y la línea de energía
 * cayendo. La caída se exagera a propósito para que se vea — con una pérdida
 * real de centímetros en metros de tubería la pendiente no se distinguiría —
 * pero el rótulo siempre dice la pérdida real.
 */
export function DiagramaPerdidaCarga({ longitudM, perdidaTotalM }: DiagramaPerdidaCargaProps) {
  const x0 = 40;
  const x1 = 360;
  const pipeTopY = 100;
  const pipeBottomY = 120;
  const hglStartY = 60;
  const hglEndY = 100;

  return (
    <figure className="esquemas-acotados space-y-2">
      <svg viewBox="0 0 400 160" className="w-full" aria-hidden="true">
        {/* Tubería, en planta de perfil */}
        <g>
          <rect
            x={x0}
            y={pipeTopY}
            width={x1 - x0}
            height={pipeBottomY - pipeTopY}
            className="fill-mat-tuberia"
            stroke="var(--mat-tuberia-borde)"
            strokeWidth="1.2"
          />
          <line x1={x0} y1={(pipeTopY + pipeBottomY) / 2} x2={x1} y2={(pipeTopY + pipeBottomY) / 2}
            stroke="var(--mat-agua-borde)" strokeWidth="2" opacity="0.5" />
        </g>

        {/* Línea de energía (HGL), con caída exagerada para que se vea */}
        <line
          x1={x0}
          y1={hglStartY}
          x2={x1}
          y2={hglEndY}
          stroke="var(--mat-critico)"
          strokeWidth="1.3"
          strokeDasharray="5 3"
        />
        <circle cx={x0} cy={hglStartY} r="2.5" fill="var(--mat-critico)" />
        <circle cx={x1} cy={hglEndY} r="2.5" fill="var(--mat-critico)" />

        {/* Cota de pérdida de carga, a la derecha */}
        <g stroke="var(--mat-cota)" strokeWidth="1" opacity="0.8">
          <line x1={x1 + 14} y1={hglStartY} x2={x1 + 14} y2={hglEndY} />
          <line x1={x1 + 10} y1={hglStartY} x2={x1 + 18} y2={hglStartY} />
          <line x1={x1 + 10} y1={hglEndY} x2={x1 + 18} y2={hglEndY} />
        </g>
        <text
          x={x1 + 20}
          y={(hglStartY + hglEndY) / 2}
          dominantBaseline="middle"
          className="fill-current font-mono"
          fontSize="10"
        >
          hf = {fmt(perdidaTotalM, 2)} m
        </text>

        <text x={x1 + 20} y={(hglStartY + hglEndY) / 2 + 16} className="fill-current font-mono text-muted-foreground" fontSize="9">
          en L = {fmt(longitudM, 1)} m
        </text>

        <text x={(x0 + x1) / 2} y={hglStartY - 10} textAnchor="middle" className="fill-current font-mono text-muted-foreground" fontSize="8" opacity="0.7">
          línea de energía (caída exagerada para que se vea)
        </text>
      </svg>
    </figure>
  );
}
