import { fmt } from "@/lib/calculadoras/formato";

export interface FlujosEmbalse {
  aporte: number;
  precipitacion: number;
  evaporacion: number;
  infiltracion: number;
  suministro: number;
  qamb: number;
  vertido: number;
  deficit: number;
}

interface DiagramaEmbalseProps {
  /** Curva cota (m) – área (cualquier unidad, solo se usa la forma). */
  curva: readonly { cotaM: number; areaHa: number }[];
  cotaVertidoM: number;
  cotaTomaM: number;
  /** Nivel del agua que se dibuja. */
  cotaAguaM: number;
  /** Rango de niveles de la simulación (franja). */
  rangoM: [number, number] | null;
  etiquetaRango?: string;
  flujos: FlujosEmbalse;
  /** Formatea un volumen en la unidad elegida. */
  fv: (hm3: number) => string;
  titulo: string;
}

const T = { fontSize: 10, className: "fill-current font-mono" } as const;
const T_SUAVE = { fontSize: 9.5, className: "fill-muted-foreground" } as const;

function Flecha({ x1, y1, x2, y2, color = "var(--mat-agua-borde)", ancho = 2 }: { x1: number; y1: number; x2: number; y2: number; color?: string; ancho?: number }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a = 6;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={ancho} />
      <path
        d={`M${x2},${y2} L${x2 - a * Math.cos(ang - 0.45)},${y2 - a * Math.sin(ang - 0.45)} L${x2 - a * Math.cos(ang + 0.45)},${y2 - a * Math.sin(ang + 0.45)} Z`}
        fill={color}
      />
    </g>
  );
}

/**
 * Corte longitudinal esquemático del embalse. El largo del lago a cada cota
 * es proporcional a √área (la forma sale de la curva cota-área); la escala
 * vertical es la de las cotas. Las flechas llevan los volúmenes del período
 * o del paso elegido.
 */
export function DiagramaEmbalse(p: DiagramaEmbalseProps) {
  const ancho = 620;
  const alto = 290;
  const curva = [...p.curva].sort((a, b) => a.cotaM - b.cotaM);
  const zFondo = curva[0].cotaM;
  const zTope = Math.max(p.cotaVertidoM, curva[curva.length - 1].cotaM);
  const zCor = zTope + (zTope - zFondo) * 0.08;
  const top = 46;
  const bottom = alto - 34;
  const y = (z: number) => bottom - ((z - zFondo) / (zCor - zFondo || 1)) * (bottom - top);
  const xPresa = 430;
  const largoMax = 330;
  const aMax = Math.max(...curva.map((c) => c.areaHa), 1e-9);
  const largo = (a: number) => Math.sqrt(Math.max(0, a) / aMax) * largoMax;
  const areaEn = (z: number) => {
    if (z <= curva[0].cotaM) return curva[0].areaHa;
    for (let i = 1; i < curva.length; i++)
      if (z <= curva[i].cotaM) {
        const c0 = curva[i - 1];
        const c1 = curva[i];
        return c0.areaHa + ((c1.areaHa - c0.areaHa) * (z - c0.cotaM)) / (c1.cotaM - c0.cotaM || 1);
      }
    const n = curva.length;
    if (n < 2) return curva[0].areaHa;
    const c0 = curva[n - 2];
    const c1 = curva[n - 1];
    return c1.areaHa + ((c1.areaHa - c0.areaHa) * (z - c1.cotaM)) / (c1.cotaM - c0.cotaM || 1);
  };
  // Perfil del fondo desde el pie de la presa hasta la cota de coronamiento.
  const nPerfil = 40;
  const perfil = Array.from({ length: nPerfil + 1 }, (_, i) => {
    const z = zFondo + ((zCor - zFondo) * i) / nPerfil;
    return { x: xPresa - Math.max(6, largo(areaEn(z))), z };
  });
  const terreno = `M${xPresa},${bottom + 14} L${xPresa},${y(zFondo)} ${perfil.map((q) => `L${q.x},${y(q.z)}`).join(" ")} L${perfil[nPerfil].x - 20},${top - 8} L${perfil[nPerfil].x - 20},${bottom + 14} Z`;
  const zAgua = Math.min(Math.max(p.cotaAguaM, zFondo), zCor);
  const agua = perfil.filter((q) => q.z <= zAgua);
  const xOrilla = xPresa - Math.max(6, largo(areaEn(zAgua)));
  const pathAgua = `M${xPresa},${y(zFondo)} ${agua.map((q) => `L${q.x},${y(q.z)}`).join(" ")} L${xOrilla},${y(zAgua)} L${xPresa},${y(zAgua)} Z`;

  // Presa (trapecio) con escotadura del vertedero
  const bCor = 14;
  const bPie = 70;
  const presa = `M${xPresa},${y(zCor)} L${xPresa + bCor},${y(zCor)} L${xPresa + bPie},${bottom + 4} L${xPresa - 6},${bottom + 4} Z`;
  const yVert = y(p.cotaVertidoM);
  const yToma = y(p.cotaTomaM);
  const xAguas = xPresa + bPie + 8;
  const f = p.flujos;
  const xMedio = (xOrilla + xPresa) / 2;
  const cotas: [number, string, string, boolean][] = [
    [p.cotaVertidoM, "vertido", "var(--mat-cota)", false],
    [p.cotaTomaM, "toma mín.", "var(--mat-cota)", true],
  ];

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{p.titulo}</figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-label="Corte esquemático del embalse con sus entradas y salidas">
        {/* Franja de niveles de la simulación */}
        {p.rangoM && (
          <rect
            x={xPresa - largo(areaEn(p.rangoM[1])) - 4}
            y={y(p.rangoM[1])}
            width={largo(areaEn(p.rangoM[1])) + 4}
            height={Math.max(1, y(p.rangoM[0]) - y(p.rangoM[1]))}
            fill="var(--mat-cota)"
            opacity="0.1"
          />
        )}
        <path d={pathAgua} className="fill-mat-agua" />
        <line x1={xOrilla} x2={xPresa} y1={y(zAgua)} y2={y(zAgua)} stroke="var(--mat-agua-borde)" strokeWidth="1.5" />
        <path d={terreno} fill="var(--mat-terreno)" stroke="var(--mat-canal-borde)" strokeWidth="1" />
        <path d={presa} className="fill-mat-canal" stroke="var(--mat-canal-borde)" />
        {/* Terreno aguas abajo */}
        <path d={`M${xPresa + bPie - 4},${bottom + 4} L${ancho - 8},${bottom + 10} L${ancho - 8},${bottom + 14} L${xPresa},${bottom + 14} Z`} fill="var(--mat-terreno)" />
        {/* Vertedero: escotadura en el coronamiento */}
        <rect x={xPresa - 1} y={y(zCor) - 1} width={bCor + 2} height={yVert - y(zCor) + 1} fill="var(--background)" />
        <line x1={xPresa} x2={xPresa + bCor} y1={yVert} y2={yVert} stroke="var(--mat-canal-borde)" strokeWidth="2" />
        {/* Toma */}
        <rect x={xPresa - 4} y={yToma - 4} width={bPie * ((bottom - yToma) / (bottom - y(zCor))) + 12} height={7} className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" />

        {/* Cotas */}
        {cotas.map(([z, nombre, color, punteada]) => (
          <g key={nombre}>
            <line x1={18} x2={xPresa} y1={y(z)} y2={y(z)} stroke={color} strokeDasharray={punteada ? "4 3" : "2 3"} opacity="0.75" />
            <text x={18} y={y(z) - 4} {...T}>
              {fmt(z, 2)}
            </text>
            <text x={62} y={y(z) - 4} {...T_SUAVE}>
              {nombre}
            </text>
          </g>
        ))}
        <text x={xMedio} y={y(zAgua) + 16} textAnchor="middle" {...T}>
          nivel {fmt(p.cotaAguaM, 2)}
        </text>
        {p.rangoM && (
          <text x={xMedio} y={y(zAgua) + 29} textAnchor="middle" {...T_SUAVE}>
            {p.etiquetaRango ?? "simulado"} {fmt(p.rangoM[0], 2)} – {fmt(p.rangoM[1], 2)}
          </text>
        )}

        {/* Entradas */}
        <Flecha x1={perfil[nPerfil].x - 30} y1={top - 18} x2={Math.max(40, xOrilla + 6)} y2={y(zAgua) - 10} />
        <text x={perfil[nPerfil].x - 30} y={top - 24} {...T}>
          aporte {p.fv(f.aporte)}
        </text>
        {[0, 1, 2].map((i) => (
          <line key={i} x1={xMedio - 40 + i * 14} x2={xMedio - 46 + i * 14} y1={top - 6} y2={top + 10} stroke="var(--mat-agua-borde)" strokeWidth="1.5" strokeDasharray="3 3" />
        ))}
        <text x={xMedio - 52} y={top - 12} textAnchor="end" {...T}>
          lluvia {p.fv(f.precipitacion)}
        </text>
        {/* Evaporación */}
        <Flecha x1={xMedio + 30} y1={y(zAgua) - 4} x2={xMedio + 30} y2={top - 2} color="var(--mat-critico)" ancho={1.5} />
        <text x={xMedio + 38} y={top + 6} {...T}>
          evap. {p.fv(f.evaporacion)}
        </text>
        {/* Infiltración */}
        <Flecha x1={xPresa - 50} y1={y(zFondo) - 2} x2={xPresa - 58} y2={bottom + 10} color="var(--mat-critico)" ancho={1.5} />
        <text x={xPresa - 64} y={bottom + 24} textAnchor="end" {...T}>
          infiltración {p.fv(f.infiltracion)}
        </text>

        {/* Salidas aguas abajo */}
        <Flecha x1={xPresa + bCor + 2} y1={yVert + 4} x2={xAguas + 34} y2={yVert + 28} />
        <text x={xAguas + 38} y={yVert + 28} {...T}>
          vertido {p.fv(f.vertido)}
        </text>
        <Flecha x1={xAguas - 4} y1={yToma} x2={xAguas + 34} y2={yToma} />
        <text x={xAguas + 38} y={yToma - 8} {...T}>
          demanda {p.fv(f.suministro)}
        </text>
        <text x={xAguas + 38} y={yToma + 5} {...T}>
          Qamb {p.fv(f.qamb)}
        </text>
        {f.deficit > 0 && (
          <text x={xAguas + 38} y={yToma + 19} {...T} className="fill-mat-critico font-mono">
            déficit {p.fv(f.deficit)}
          </text>
        )}
      </svg>
    </figure>
  );
}
