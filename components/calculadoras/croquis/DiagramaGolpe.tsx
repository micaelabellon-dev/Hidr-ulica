import { fmt } from "@/lib/calculadoras/formato";

interface DiagramaGolpeProps {
  longitudM: number;
  alturaManometricaM: number;
  alturaEstaticaM: number;
  /** Sobrepresión en función de la distancia a la bomba. */
  deltaEn: (x: number) => number;
  sobrepresionM: number;
  longitudCriticaM: number;
  regimen: "rapido" | "lento";
  celeridadMs: number;
  presionNominalM: number | null;
  diametroExteriorMm: number;
  espesorMm: number;
  diametroInteriorMm: number;
}

const T = { fontSize: 10, className: "fill-current font-mono" } as const;
const T_SUAVE = { fontSize: 9.5, className: "fill-muted-foreground" } as const;

/**
 * Impulsión recta y horizontal: bomba con válvula de retención, tubería y
 * depósito. Encima, la piezométrica de régimen y la envolvente de máximas y
 * mínimas tras la parada; en rojo, donde la mínima cae por debajo del eje
 * (depresión). A la derecha, el corte del caño a escala.
 */
export function DiagramaGolpe(p: DiagramaGolpeProps) {
  const ancho = 640;
  const alto = 300;
  const L = p.longitudM;
  const n = 80;
  const xs = Array.from({ length: n + 1 }, (_, i) => (L * i) / n);
  const reg = (x: number) => p.alturaManometricaM - (p.alturaManometricaM - p.alturaEstaticaM) * (x / L);
  const maxs = xs.map((x) => reg(x) + p.deltaEn(x));
  const mins = xs.map((x) => reg(x) - p.deltaEn(x));
  const zSup = Math.max(...maxs, p.presionNominalM ?? -Infinity, p.alturaManometricaM) * 1.08 + 0.5;
  const zInf = Math.min(...mins, 0) - Math.max(1, (zSup - Math.min(...mins, 0)) * 0.12);
  const x0 = 92;
  const x1 = 470;
  const top = 26;
  const bottom = alto - 46;
  const X = (x: number) => x0 + ((x1 - x0) * x) / L;
  const Y = (z: number) => bottom - ((z - zInf) / (zSup - zInf || 1)) * (bottom - top);
  const linea = (zs: number[]) => zs.map((z, i) => `${i ? "L" : "M"}${X(xs[i])},${Y(z)}`).join(" ");
  const banda = `${linea(maxs)} ${[...mins].reverse().map((z, i) => `L${X(xs[n - i])},${Y(z)}`).join(" ")} Z`;
  // Tramos en depresión (mínima < 0)
  const depresion: [number, number][] = [];
  let ini: number | null = null;
  mins.forEach((z, i) => {
    if (z < 0 && ini === null) ini = i;
    if ((z >= 0 || i === n) && ini !== null) {
      depresion.push([ini, z < 0 ? i : i - 1]);
      ini = null;
    }
  });
  const yEje = Y(0);
  const xLc = L - Math.min(L, p.longitudCriticaM);

  // Corte del caño
  const cx = 570;
  const cy = 92;
  const rExt = 34;
  const rInt = rExt * (p.diametroInteriorMm / p.diametroExteriorMm);

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">Esquema de la impulsión y envolvente tras la parada</figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-label="Esquema de la impulsión con la envolvente de presiones del golpe de ariete">
        {/* Envolvente */}
        <path d={banda} fill="var(--serie-2)" opacity="0.12" />
        <path d={linea(maxs)} fill="none" stroke="var(--serie-2)" strokeWidth="1.8" />
        <path d={linea(mins)} fill="none" stroke="var(--serie-3)" strokeWidth="1.8" strokeDasharray="5 3" />
        <path d={`M${X(0)},${Y(reg(0))} L${X(L)},${Y(reg(L))}`} stroke="var(--serie-1)" strokeWidth="1.8" />
        {depresion.map(([a, b], k) => (
          <path
            key={k}
            d={`M${X(xs[a])},${yEje} ${xs.slice(a, b + 1).map((x, j) => `L${X(x)},${Y(Math.min(0, mins[a + j]))}`).join(" ")} L${X(xs[b])},${yEje} Z`}
            fill="var(--mat-critico)"
            opacity="0.3"
          />
        ))}
        {p.presionNominalM !== null && (
          <g>
            <line x1={x0} x2={x1} y1={Y(p.presionNominalM)} y2={Y(p.presionNominalM)} stroke="var(--mat-critico)" strokeDasharray="2 3" />
            <text x={x1} y={Y(p.presionNominalM) - 4} textAnchor="end" {...T} className="fill-mat-critico font-mono">
              PN {fmt(p.presionNominalM, 1)} m
            </text>
          </g>
        )}

        {/* Lc: tramo con la sobrepresión completa */}
        {p.regimen === "lento" || xLc > 0 ? (
          <g>
            <line x1={X(0)} x2={X(xLc)} y1={top - 8} y2={top - 8} stroke="var(--mat-cota)" />
            <line x1={X(xLc)} x2={X(L)} y1={top - 8} y2={top - 8} stroke="var(--mat-cota)" strokeDasharray="3 2" />
            {[0, xLc, L].map((x) => (
              <line key={x} x1={X(x)} x2={X(x)} y1={top - 12} y2={top - 4} stroke="var(--mat-cota)" />
            ))}
            {xLc > 0 && (
              <text x={(X(0) + X(xLc)) / 2} y={top - 12} textAnchor="middle" {...T_SUAVE}>
                ΔH = {fmt(p.sobrepresionM, 2)} m
              </text>
            )}
            <text x={(X(xLc) + X(L)) / 2} y={top - 12} textAnchor="middle" {...T_SUAVE}>
              Lc {fmt(Math.min(L, p.longitudCriticaM), 0)} m
            </text>
          </g>
        ) : null}

        {/* Bomba, válvula, tubería y depósito sobre el eje */}
        <rect x={x0 - 66} y={yEje + 12} width={60} height={8} className="fill-mat-canal" />
        <circle cx={x0 - 36} cy={yEje} r="13" className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" strokeWidth="1.5" />
        <path d={`M${x0 - 36},${yEje} L${x0 - 28},${yEje - 7}`} stroke="var(--mat-tuberia-borde)" strokeWidth="2" />
        <text x={x0 - 36} y={yEje + 34} textAnchor="middle" {...T_SUAVE}>
          bomba
        </text>
        <rect x={x0 - 23} y={yEje - 4} width={23} height={8} className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" />
        {/* Retención */}
        <path d={`M${x0 - 14},${yEje - 8} L${x0 - 14},${yEje + 8} L${x0 - 4},${yEje} Z`} fill="var(--foreground)" opacity="0.7" />
        <rect x={x0} y={yEje - 4} width={x1 - x0} height={8} className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" />
        <rect x={x0 + 2} y={yEje - 2} width={x1 - x0 - 4} height={4} className="fill-mat-agua" />
        <text x={cx} y={cy + rExt + 60} textAnchor="middle" {...T}>
          c = {fmt(p.celeridadMs, 0)} m/s
        </text>
        <text x={cx} y={cy + rExt + 73} textAnchor="middle" {...T}>
          L = {fmt(L, 0)} m
        </text>
        {/* Depósito de descarga */}
        <rect x={x1} y={Y(p.alturaEstaticaM) - 2} width={44} height={yEje - Y(p.alturaEstaticaM) + 18} fill="none" stroke="var(--mat-canal-borde)" strokeWidth="2" />
        <rect x={x1 + 1} y={Y(p.alturaEstaticaM)} width={42} height={yEje - Y(p.alturaEstaticaM) + 15} className="fill-mat-agua" />
        <text x={x1 + 22} y={yEje + 34} textAnchor="middle" {...T_SUAVE}>
          depósito
        </text>
        <line x1={x0 - 70} x2={x1 + 50} y1={yEje} y2={yEje} stroke="var(--muted-foreground)" strokeDasharray="1 3" opacity="0.6" />
        <text x={x0 - 72} y={yEje - 4} {...T_SUAVE}>
          eje
        </text>

        {/* Rótulos de las líneas */}
        <text x={X(0) + 6} y={Y(maxs[0]) - 6} {...T}>
          máx {fmt(maxs[0], 1)}
        </text>
        <text x={X(0) + 6} y={Y(reg(0)) + 13} {...T_SUAVE}>
          régimen {fmt(reg(0), 1)}
        </text>
        <text x={X(0) + 6} y={Y(mins[0]) + (mins[0] > 0 && Y(mins[0]) + 13 > yEje - 6 ? -5 : 13)} {...T}>
          mín {fmt(mins[0], 1)}
        </text>

        {/* Corte del caño */}
        <circle cx={cx} cy={cy} r={rExt} className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={rInt} className="fill-mat-agua" stroke="var(--mat-agua-borde)" />
        <line x1={cx - rExt} x2={cx + rExt} y1={cy + rExt + 10} y2={cy + rExt + 10} stroke="var(--mat-cota)" />
        <text x={cx} y={cy + rExt + 24} textAnchor="middle" {...T}>
          DN {fmt(p.diametroExteriorMm, 0)}
        </text>
        <text x={cx} y={cy + rExt + 37} textAnchor="middle" {...T_SUAVE}>
          e {fmt(p.espesorMm, 1)} · Di {fmt(p.diametroInteriorMm, 1)} mm
        </text>
        <text x={cx} y={cy - rExt - 8} textAnchor="middle" {...T_SUAVE}>
          corte
        </text>

        {/* Leyenda */}
        <g transform={`translate(${x0}, ${alto - 8})`}>
          {(
            [
              ["var(--serie-2)", "máxima", false],
              ["var(--serie-1)", "régimen", false],
              ["var(--serie-3)", "mínima", true],
            ] as const
          ).map(([c, t, d], i) => (
            <g key={t} transform={`translate(${i * 92}, 0)`}>
              <line x1={0} x2={18} y1={-4} y2={-4} stroke={c} strokeWidth="2" strokeDasharray={d ? "5 3" : undefined} />
              <text x={22} y={0} {...T_SUAVE}>
                {t}
              </text>
            </g>
          ))}
          {depresion.length > 0 && (
            <g transform="translate(276, 0)">
              <rect x={0} y={-9} width={14} height={9} fill="var(--mat-critico)" opacity="0.3" />
              <text x={18} y={0} {...T_SUAVE}>
                depresión
              </text>
            </g>
          )}
        </g>
      </svg>
    </figure>
  );
}
