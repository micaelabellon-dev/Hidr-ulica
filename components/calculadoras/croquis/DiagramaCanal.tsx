import { fmt } from "@/lib/calculadoras/formato";
import type { FormaCanal } from "@/lib/calc/hidraulica/canales-manning";

interface DiagramaCanalProps {
  forma: FormaCanal;
  tiranteM: number;
  baseM: number;
  taludZ: number;
  anchoSuperficialM: number;
}

/**
 * Sección transversal del canal con el tirante calculado, a escala entre sí
 * (no respecto de la realidad: un canal de 20 cm y uno de 20 m se dibujan con
 * el mismo tamaño de trazo). El dibujo recibe la geometría ya resuelta, no la
 * calcula — mismo criterio que los croquis de las verificaciones estructurales.
 */
export function DiagramaCanal({ forma, tiranteM, baseM, taludZ, anchoSuperficialM }: DiagramaCanalProps) {
  const y = tiranteM;
  // b y z ya vienen en la convención correcta para cada forma: b=0 en
  // triangular, z=0 en rectangular, así que una sola fórmula trapecial dibuja
  // las tres sin bifurcar el trazado.
  const b = forma === "triangular" ? 0 : baseM;
  const z = forma === "rectangular" ? 0 : taludZ;

  const bancoAlturaM = y * 1.35 + 0.05;
  const xMin = -z * bancoAlturaM;
  const xMax = b + z * bancoAlturaM;
  const anchoModeloM = Math.max(xMax - xMin, 0.2);
  const altoModeloM = bancoAlturaM;

  const padX = 46;
  const padTop = 28;
  const padBottom = 40;
  const anchoSvg = 400;
  const altoSvg = 220;

  const escala = Math.min(
    (anchoSvg - 2 * padX) / anchoModeloM,
    (altoSvg - padTop - padBottom) / altoModeloM
  );

  const toSvg = (x: number, yArriba: number): [number, number] => [
    padX + (x - xMin) * escala,
    altoSvg - padBottom - yArriba * escala,
  ];

  const [bedLeftX, bedLeftY] = toSvg(0, 0);
  const [bedRightX, bedRightY] = toSvg(b, 0);
  const [bankLeftX, bankLeftY] = toSvg(-z * bancoAlturaM, bancoAlturaM);
  const [bankRightX, bankRightY] = toSvg(b + z * bancoAlturaM, bancoAlturaM);

  const puntosAgua = [
    toSvg(0, 0),
    toSvg(b, 0),
    toSvg(b + z * y, y),
    toSvg(-z * y, y),
  ]
    .map(([x, py]) => `${x},${py}`)
    .join(" ");

  const [superficieIzqX, superficieIzqY] = toSvg(-z * y, y);
  const [superficieDerX, superficieDerY] = toSvg(b + z * y, y);

  return (
    <figure className="esquemas-acotados space-y-2">
      <svg viewBox={`0 0 ${anchoSvg} ${altoSvg}`} className="w-full" aria-hidden="true">
        {/* Agua */}
        <polygon points={puntosAgua} className="fill-mat-agua" stroke="var(--mat-agua-borde)" strokeWidth="1.2" />

        {/* Contorno del canal: banco izquierdo, solera, banco derecho */}
        <g stroke="var(--mat-canal-borde)" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d={`M${bankLeftX} ${bankLeftY} L${bedLeftX} ${bedLeftY} L${bedRightX} ${bedRightY} L${bankRightX} ${bankRightY}`} />
        </g>

        {/* Línea de superficie libre, por si no coincide con el borde del agua dibujada */}
        <line
          x1={superficieIzqX}
          y1={superficieIzqY}
          x2={superficieDerX}
          y2={superficieDerY}
          stroke="var(--mat-agua-borde)"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.6"
        />

        {/* Cota del tirante y, a la izquierda del dibujo */}
        <g stroke="var(--mat-cota)" strokeWidth="1" opacity="0.8">
          <line x1={bedLeftX - 14} y1={bedLeftY} x2={bedLeftX - 14} y2={superficieIzqY} />
          <line x1={bedLeftX - 18} y1={bedLeftY} x2={bedLeftX - 10} y2={bedLeftY} />
          <line x1={bedLeftX - 18} y1={superficieIzqY} x2={bedLeftX - 10} y2={superficieIzqY} />
        </g>
        <text
          x={bedLeftX - 20}
          y={(bedLeftY + superficieIzqY) / 2}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-current font-mono text-[var(--mat-cota)]"
          fontSize="10"
        >
          y = {fmt(y, 2)} m
        </text>

        {/* Cota del ancho de solera b, si hay */}
        {b > 0 && (
          <>
            <g stroke="var(--mat-cota)" strokeWidth="1" opacity="0.8">
              <line x1={bedLeftX} y1={bedLeftY + 14} x2={bedRightX} y2={bedRightY + 14} />
            </g>
            <text
              x={(bedLeftX + bedRightX) / 2}
              y={bedLeftY + 28}
              textAnchor="middle"
              className="fill-current font-mono text-[var(--mat-cota)]"
              fontSize="10"
            >
              b = {fmt(b, 2)} m
            </text>
          </>
        )}

        {/* Cota del ancho superficial T, arriba */}
        <g stroke="var(--mat-cota)" strokeWidth="1" opacity="0.6">
          <line x1={superficieIzqX} y1={superficieIzqY - 10} x2={superficieDerX} y2={superficieDerY - 10} />
        </g>
        <text
          x={(superficieIzqX + superficieDerX) / 2}
          y={Math.min(superficieIzqY, superficieDerY) - 16}
          textAnchor="middle"
          className="fill-current font-mono text-[var(--mat-cota)]"
          fontSize="10"
        >
          T = {fmt(anchoSuperficialM, 2)} m
        </text>
      </svg>
      <p className="text-xs text-muted-foreground">
        El dibujo escala la sección para que se lea igual en cualquier tamaño de canal; el rótulo
        siempre dice el número real.
      </p>
    </figure>
  );
}
