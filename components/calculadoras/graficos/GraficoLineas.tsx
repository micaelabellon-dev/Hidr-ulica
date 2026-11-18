"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface PuntoXY {
  x: number;
  y: number;
}

export interface SerieGrafico {
  id: string;
  nombre: string;
  /** Color como variable CSS, p. ej. "var(--serie-1)". */
  color: string;
  puntos: PuntoXY[];
  discontinua?: boolean;
  /** Puntos sueltos (datos de catálogo) en lugar de línea. */
  soloMarcadores?: boolean;
  /** No entra en el tooltip (p. ej. los puntos de catálogo, ya cubiertos por el ajuste). */
  sinTooltip?: boolean;
}

export interface ReferenciaY {
  y: number;
  etiqueta: string;
}

export interface Destacado {
  x: number;
  y: number;
  etiqueta: string;
  color: string;
}

interface GraficoLineasProps {
  titulo: string;
  series: SerieGrafico[];
  formatoX: (x: number) => string;
  formatoY: (y: number) => string;
  /** Formatos del tooltip, con más precisión que las marcas de los ejes. */
  formatoXTooltip?: (x: number) => string;
  formatoValor?: (y: number) => string;
  ejeX: string;
  ejeY: string;
  /** Valores de x donde poner las marcas del eje; si no, se eligen solos. */
  ticksX?: number[];
  referenciasY?: ReferenciaY[];
  destacados?: Destacado[];
  /** Franja sombreada en x, p. ej. el rango recomendado de la bomba. */
  bandaX?: { desde: number; hasta: number; etiqueta: string };
  /** Filas extra del tooltip para el x señalado. */
  extraTooltip?: (x: number) => { etiqueta: string; valor: string }[];
  /** Arrancar el eje y en cero. */
  desdeCero?: boolean;
  alto?: number;
}

const M = { izq: 56, der: 14, arr: 14, aba: 40 };

/** Marcas "lindas" (1, 2, 2,5 o 5 × 10ⁿ) para un rango. */
function ticksLindos(min: number, max: number, cantidad = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max === min) return [min];
  const crudo = (max - min) / cantidad;
  const pot = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= crudo) ?? crudo;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / paso - 1e-9) * paso; v <= max + paso * 1e-9; v += paso) ticks.push(+v.toPrecision(12));
  return ticks;
}

/** El punto de la serie con x más cercano, por búsqueda binaria (las series vienen ordenadas en x). */
function masCercano(puntos: PuntoXY[], x: number): PuntoXY | null {
  if (puntos.length === 0) return null;
  let lo = 0;
  let hi = puntos.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (puntos[mid].x < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(puntos[lo].x - x) <= Math.abs(puntos[hi].x - x) ? puntos[lo] : puntos[hi];
}

/**
 * Gráfico de líneas en SVG, un solo eje y. La retícula es tenue y el tooltip
 * sigue al puntero: una línea vertical que se engancha al dato más cercano y
 * muestra el valor de todas las series en ese x. Con el teclado, las flechas
 * mueven el cursor.
 */
export function GraficoLineas({
  titulo,
  series,
  formatoX,
  formatoY,
  formatoXTooltip = formatoX,
  formatoValor = formatoY,
  ejeX,
  ejeY,
  ticksX,
  referenciasY = [],
  destacados = [],
  bandaX,
  extraTooltip,
  desdeCero = false,
  alto = 260,
}: GraficoLineasProps) {
  const idTitulo = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  // El ancho del viewBox sigue al del contenedor, para que el texto no se achique en columnas angostas.
  const [ANCHO, setAncho] = useState(640);
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(280, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const conDatos = series.filter((s) => s.puntos.length > 0);
  const todosX = conDatos.flatMap((s) => s.puntos.map((p) => p.x));
  const todosY = [
    ...conDatos.flatMap((s) => s.puntos.map((p) => p.y)),
    ...referenciasY.map((r) => r.y),
    ...destacados.map((d) => d.y),
  ].filter(Number.isFinite);

  const xMin = Math.min(...todosX);
  const xMax = Math.max(...todosX);
  let yMin = Math.min(...todosY);
  let yMax = Math.max(...todosY);
  if (desdeCero) yMin = Math.min(0, yMin);
  const margenY = (yMax - yMin) * 0.06 || Math.abs(yMax) * 0.1 || 1;
  yMax += margenY;
  if (!desdeCero || yMin < 0) yMin -= margenY;
  const marcasY = ticksLindos(yMin, yMax);
  if (marcasY.length > 1) {
    yMin = Math.min(yMin, marcasY[0]);
    yMax = Math.max(yMax, marcasY[marcasY.length - 1]);
  }

  const anchoUtil = ANCHO - M.izq - M.der;
  const altoUtil = alto - M.arr - M.aba;
  const sx = (x: number) => M.izq + (xMax === xMin ? anchoUtil / 2 : ((x - xMin) / (xMax - xMin)) * anchoUtil);
  const sy = (y: number) => M.arr + altoUtil - ((y - yMin) / (yMax - yMin || 1)) * altoUtil;
  const marcasX = ticksX ?? ticksLindos(xMin, xMax, ANCHO < 420 ? 4 : 6);

  // Posiciones en x a las que se engancha el cursor: las de todas las series.
  const xsCursor = useMemo(
    () => [...new Set(series.filter((s) => !s.sinTooltip).flatMap((s) => s.puntos.map((p) => p.x)))].sort((a, b) => a - b),
    [series]
  );

  if (conDatos.length === 0) return null;

  const moverA = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || xsCursor.length === 0) return;
    const r = svg.getBoundingClientRect();
    const xSvg = ((clientX - r.left) / r.width) * ANCHO;
    const x = xMin + ((xSvg - M.izq) / anchoUtil) * (xMax - xMin);
    const p = masCercano(xsCursor.map((v) => ({ x: v, y: 0 })), x);
    setCursor(p ? p.x : null);
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    if (xsCursor.length === 0) return;
    const i = cursor === null ? -1 : xsCursor.indexOf(cursor);
    const salto = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowRight") setCursor(xsCursor[Math.min(xsCursor.length - 1, Math.max(0, i + salto))]);
    else if (e.key === "ArrowLeft") setCursor(xsCursor[Math.max(0, i < 0 ? 0 : i - salto)]);
    else if (e.key === "Escape") setCursor(null);
    else return;
    e.preventDefault();
  };

  const filasTooltip =
    cursor === null
      ? []
      : series
          .filter((s) => !s.sinTooltip)
          .map((s) => {
            const p = masCercano(s.puntos, cursor);
            const fuera = !p || cursor < s.puntos[0].x - 1e-9 || cursor > s.puntos[s.puntos.length - 1].x + 1e-9;
            return { s, valor: fuera || !p ? "—" : formatoValor(p.y) };
          });
  const extras = cursor !== null && extraTooltip ? extraTooltip(cursor) : [];
  const xCursorSvg = cursor !== null ? sx(cursor) : 0;
  const tooltipIzquierda = xCursorSvg > ANCHO * 0.6;

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span id={idTitulo} className="text-sm font-medium">
          {titulo}
        </span>
        {series.length > 1 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {series.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <svg width="16" height="8" aria-hidden="true">
                  {s.soloMarcadores ? (
                    <circle cx="8" cy="4" r="3.5" fill="var(--background)" stroke={s.color} strokeWidth="1.5" />
                  ) : (
                    <line x1="0" y1="4" x2="16" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.discontinua ? "4 2" : undefined} />
                  )}
                </svg>
                {s.nombre}
              </li>
            ))}
          </ul>
        )}
      </figcaption>

      <div ref={contenedor} className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${ANCHO} ${alto}`}
          className="w-full touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          role="img"
          aria-labelledby={idTitulo}
          tabIndex={0}
          onPointerMove={(e) => moverA(e.clientX)}
          onPointerDown={(e) => moverA(e.clientX)}
          onPointerLeave={() => setCursor(null)}
          onKeyDown={alTeclear}
          onBlur={() => setCursor(null)}
        >
          {bandaX && (
            <g>
              <rect
                x={sx(Math.max(xMin, bandaX.desde))}
                y={M.arr}
                width={Math.max(0, sx(Math.min(xMax, bandaX.hasta)) - sx(Math.max(xMin, bandaX.desde)))}
                height={altoUtil}
                fill="var(--serie-1)"
                opacity="0.07"
              />
              <text
                x={sx(Math.max(xMin, bandaX.desde)) + 4}
                y={M.arr + altoUtil - 6}
                fontSize="10"
                className="fill-muted-foreground"
              >
                {bandaX.etiqueta}
              </text>
            </g>
          )}

          {/* Retícula y ejes */}
          {marcasY.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.izq} x2={ANCHO - M.der} y1={sy(t)} y2={sy(t)} stroke="var(--border)" strokeWidth="1" />
              <text x={M.izq - 6} y={sy(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" className="fill-muted-foreground font-mono">
                {formatoY(t)}
              </text>
            </g>
          ))}
          {marcasX.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={alto - M.aba + 15} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
              {formatoX(t)}
            </text>
          ))}
          <line x1={M.izq} x2={ANCHO - M.der} y1={M.arr + altoUtil} y2={M.arr + altoUtil} stroke="var(--muted-foreground)" strokeWidth="1" opacity="0.6" />
          <text x={M.izq + anchoUtil / 2} y={alto - 4} textAnchor="middle" fontSize="10.5" className="fill-muted-foreground">
            {ejeX}
          </text>
          <text
            transform={`translate(12 ${M.arr + altoUtil / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize="10.5"
            className="fill-muted-foreground"
          >
            {ejeY}
          </text>

          {/* Referencias horizontales: límites como el volumen muerto o el vertedero */}
          {referenciasY.map((r) => (
            <g key={r.etiqueta}>
              <line
                x1={M.izq}
                x2={ANCHO - M.der}
                y1={sy(r.y)}
                y2={sy(r.y)}
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text x={ANCHO - M.der - 4} y={sy(r.y) - 4} textAnchor="end" fontSize="10" className="fill-muted-foreground">
                {r.etiqueta}
              </text>
            </g>
          ))}

          {/* Series */}
          {series.map((s) =>
            s.soloMarcadores ? (
              <g key={s.id}>
                {s.puntos.map((p, i) => (
                  <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4" fill="var(--background)" stroke={s.color} strokeWidth="1.5" />
                ))}
              </g>
            ) : (
              <path
                key={s.id}
                d={s.puntos.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("")}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.discontinua ? "6 4" : undefined}
              />
            )
          )}

          {/* Puntos destacados con rótulo, con un anillo del color de fondo para separarlos de las líneas */}
          {destacados.map((d) => (
            <g key={d.etiqueta}>
              <circle cx={sx(d.x)} cy={sy(d.y)} r="6" fill={d.color} stroke="var(--background)" strokeWidth="2" />
              <text
                x={sx(d.x) + (sx(d.x) > ANCHO * 0.75 ? -10 : 10)}
                y={sy(d.y) - 9}
                textAnchor={sx(d.x) > ANCHO * 0.75 ? "end" : "start"}
                fontSize="11"
                fontWeight="600"
                className="fill-foreground"
                paintOrder="stroke"
                stroke="var(--background)"
                strokeWidth="3"
              >
                {d.etiqueta}
              </text>
            </g>
          ))}

          {/* Cursor */}
          {cursor !== null && (
            <g pointerEvents="none">
              <line x1={xCursorSvg} x2={xCursorSvg} y1={M.arr} y2={M.arr + altoUtil} stroke="var(--foreground)" strokeWidth="1" opacity="0.35" />
              {series
                .filter((s) => !s.sinTooltip && !s.soloMarcadores)
                .map((s) => {
                  const p = masCercano(s.puntos, cursor);
                  if (!p || Math.abs(p.x - cursor) > (xMax - xMin) / 50) return null;
                  return <circle key={s.id} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={s.color} stroke="var(--background)" strokeWidth="2" />;
                })}
            </g>
          )}
        </svg>

        {cursor !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-md"
            style={
              tooltipIzquierda
                ? { right: `${((ANCHO - xCursorSvg) / ANCHO) * 100 + 1.5}%` }
                : { left: `${(xCursorSvg / ANCHO) * 100 + 1.5}%` }
            }
          >
            <p className="mb-1 font-mono text-[11px] text-muted-foreground">{formatoXTooltip(cursor)}</p>
            <dl className="space-y-0.5">
              {filasTooltip.map(({ s, valor }) => (
                <div key={s.id} className="flex items-center gap-2">
                  <svg width="12" height="4" aria-hidden="true" className="shrink-0">
                    <line x1="0" y1="2" x2="12" y2="2" stroke={s.color} strokeWidth="2" />
                  </svg>
                  <dd className="font-mono font-semibold tabular-nums">{valor}</dd>
                  <dt className="text-muted-foreground">{s.nombre}</dt>
                </div>
              ))}
              {extras.map((e) => (
                <div key={e.etiqueta} className="flex items-center gap-2 pl-5">
                  <dd className="font-mono font-semibold tabular-nums">{e.valor}</dd>
                  <dt className="text-muted-foreground">{e.etiqueta}</dt>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </figure>
  );
}
