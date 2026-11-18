"use client";

import { useState } from "react";
import { fmt } from "@/lib/calculadoras/formato";

interface BarrasHietogramaProps {
  lluviasMm: readonly number[];
  etiquetas: readonly string[];
  intervaloMin: number;
  /** Ventana más intensa a resaltar: [inicio, cantidad de intervalos]. */
  ventana: [number, number] | null;
  etiquetaVentana?: string;
}

/**
 * Hietograma en barras, con la ventana crítica resaltada. Las barras van
 * pegadas a la línea de base con un gap de 2 px; el valor de cada barra está
 * en el tooltip y en la tabla.
 */
export function BarrasHietograma({ lluviasMm, etiquetas, intervaloMin, ventana, etiquetaVentana }: BarrasHietogramaProps) {
  const [activa, setActiva] = useState<number | null>(null);
  const ancho = 640;
  const alto = 200;
  const M = { izq: 44, der: 10, arr: 16, aba: 34 };
  const n = lluviasMm.length;
  const max = Math.max(...lluviasMm, 0.1);
  const util = ancho - M.izq - M.der;
  const paso = util / n;
  const barra = Math.max(1, paso - 2);
  const y = (v: number) => M.arr + (alto - M.arr - M.aba) * (1 - v / max);
  const marcas = [0, max / 2, max];
  const cadaCuanto = Math.max(1, Math.ceil(n / 8));

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
        Hietograma (lluvia por intervalo de {fmt(intervaloMin, 0)} min)
        {ventana && etiquetaVentana && (
          <span className="flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
            <svg width="12" height="10" aria-hidden="true">
              <rect width="12" height="10" rx="2" fill="var(--serie-2)" />
            </svg>
            {etiquetaVentana}
          </span>
        )}
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-label="Hietograma de la tormenta" onPointerLeave={() => setActiva(null)}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={M.izq} x2={ancho - M.der} y1={y(m)} y2={y(m)} stroke="var(--border)" />
              <text x={M.izq - 6} y={y(m)} textAnchor="end" dominantBaseline="middle" fontSize="10" className="fill-muted-foreground font-mono">
                {fmt(m, 1)}
              </text>
            </g>
          ))}
          {lluviasMm.map((v, i) => {
            const enVentana = ventana !== null && i >= ventana[0] && i < ventana[0] + ventana[1];
            const x = M.izq + i * paso + 1;
            const h = Math.max(0, alto - M.aba - y(v));
            return (
              <g key={i} onPointerEnter={() => setActiva(i)} onPointerDown={() => setActiva(i)}>
                <rect x={M.izq + i * paso} y={M.arr} width={paso} height={alto - M.arr - M.aba} fill="transparent" />
                <path
                  d={
                    h > 4
                      ? `M${x},${alto - M.aba} V${y(v) + 3} Q${x},${y(v)} ${x + 3},${y(v)} H${x + barra - 3} Q${x + barra},${y(v)} ${x + barra},${y(v) + 3} V${alto - M.aba} Z`
                      : `M${x},${alto - M.aba} V${alto - M.aba - h} H${x + barra} V${alto - M.aba} Z`
                  }
                  fill={enVentana ? "var(--serie-2)" : "var(--serie-1)"}
                  opacity={activa === null || activa === i ? 1 : 0.6}
                />
              </g>
            );
          })}
          <line x1={M.izq} x2={ancho - M.der} y1={alto - M.aba} y2={alto - M.aba} stroke="var(--muted-foreground)" opacity="0.6" />
          {etiquetas.map((e, i) =>
            i % cadaCuanto === 0 ? (
              <text key={i} x={M.izq + (i + 0.5) * paso} y={alto - M.aba + 14} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
                {e}
              </text>
            ) : null
          )}
          <text transform={`translate(11 ${(M.arr + alto - M.aba) / 2}) rotate(-90)`} textAnchor="middle" fontSize="10.5" className="fill-muted-foreground">
            mm
          </text>
        </svg>
        {activa !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md"
            style={{ left: `${Math.min(80, ((M.izq + (activa + 1) * paso) / ancho) * 100)}%` }}
          >
            <span className="font-mono font-semibold tabular-nums">{fmt(lluviasMm[activa], 2)} mm</span>{" "}
            <span className="text-muted-foreground">{etiquetas[activa]}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
