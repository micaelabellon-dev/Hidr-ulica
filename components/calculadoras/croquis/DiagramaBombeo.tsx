import { fmt } from "@/lib/calculadoras/formato";

export interface TramoCroquis {
  nombre: string;
  longitudM: number;
  diametroMm: number;
  perdidaM: number;
}

interface DiagramaBombeoProps {
  tipo: "aspiracion" | "sumergible";
  bombasOperacion: number;
  bombasInstaladas: number;
  caudalTotalLs: number;
  caudalBombaLs: number;
  cotaNivelMinimoM: number;
  cotaNivelMaximoM: number;
  cotaDescargaM: number;
  presionDescargaM: number;
  cotaEjeBombaM: number;
  cotaAdmisionM: number;
  tramos: TramoCroquis[];
  perdidaSuccionM: number;
  alturaTotalM: number;
}

const T = { fontSize: 10, className: "fill-current font-mono" } as const;
const T_SUAVE = { fontSize: 9.5, className: "fill-muted-foreground" } as const;

function CotaV({ x, z1, z2, y, texto, color = "var(--mat-cota)" }: { x: number; z1: number; z2: number; y: (z: number) => number; texto: string; color?: string }) {
  const y1 = y(z1);
  const y2 = y(z2);
  return (
    <g>
      <line x1={x} x2={x} y1={y1} y2={y2} stroke={color} />
      <line x1={x - 4} x2={x + 4} y1={y1} y2={y1} stroke={color} />
      <line x1={x - 4} x2={x + 4} y1={y2} y2={y2} stroke={color} />
      <text x={x + 6} y={(y1 + y2) / 2} dominantBaseline="middle" {...T}>
        {texto}
      </text>
    </g>
  );
}

/**
 * Elevación esquemática de la estación con el nivel mínimo (el caso más
 * desfavorable): pozo, bombas, impulsión por tramos (largo horizontal
 * proporcional a la longitud de cada tramo) y línea piezométrica, que baja en
 * cada tramo lo que pierde. La escala vertical es la de las cotas.
 */
export function DiagramaBombeo(p: DiagramaBombeoProps) {
  const ancho = 640;
  const alto = 300;
  const sumergible = p.tipo === "sumergible";
  const perdImp = p.tramos.reduce((s, t) => s + t.perdidaM, 0);
  const zFinal = p.cotaDescargaM + p.presionDescargaM;
  const zPiezoIni = zFinal + perdImp;
  const zFondo = Math.min(p.cotaAdmisionM, p.cotaNivelMinimoM, p.cotaEjeBombaM) - 0.6;
  const zTapa = Math.max(p.cotaNivelMaximoM + 0.8, sumergible ? p.cotaNivelMaximoM + 0.8 : p.cotaEjeBombaM + 0.6);
  const zArriba = Math.max(zPiezoIni, zFinal, zTapa, p.cotaNivelMinimoM + p.alturaTotalM) + 0.3;
  const top = 26;
  const bottom = alto - 30;
  const y = (z: number) => bottom - ((z - zFondo) / (zArriba - zFondo || 1)) * (bottom - top);

  // Pozo
  const px0 = 96;
  const px1 = 190;
  const pared = 7;
  const xRiser = sumergible ? (px0 + px1) / 2 : px1 + 40;
  // Impulsión: del montante hasta la descarga, por tramos a escala de longitud
  const xIni = xRiser;
  const xFin = ancho - 70;
  // Largo a escala, pero con un mínimo para que los tramos cortos se vean.
  const lTotal = p.tramos.reduce((s, t) => s + Math.max(0, t.longitudM), 0) || 1;
  const pesos = p.tramos.map((t) => Math.max(Math.max(0, t.longitudM) / lTotal, 0.28));
  const sumaPesos = pesos.reduce((a, b) => a + b, 0) || 1;
  const xs = [xIni];
  pesos.forEach((w) => xs.push(xs[xs.length - 1] + ((xFin - xIni) * w) / sumaPesos));
  if (p.tramos.length === 0) xs.push(xFin);
  const zCaño = Math.max(zTapa - 0.3, p.cotaDescargaM);
  // Traza del caño: sube en el montante, va por arriba del pozo y baja/sube hasta la descarga.
  const traza = `M${xRiser},${y(sumergible ? p.cotaAdmisionM + 0.4 : p.cotaEjeBombaM)} L${xRiser},${y(zCaño)} L${xFin - 30},${y(zCaño)} L${xFin},${y(p.cotaDescargaM)}`;
  // Línea piezométrica
  const piezo: [number, number][] = [[xs[0], zPiezoIni]];
  let z = zPiezoIni;
  p.tramos.forEach((t, i) => {
    z -= t.perdidaM;
    piezo.push([xs[i + 1], z]);
  });
  const zBomba = p.cotaNivelMinimoM + p.alturaTotalM;

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">Esquema con el nivel mínimo (caso más desfavorable)</figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-label="Elevación de la estación de bombeo con la línea piezométrica">
        {/* Terreno */}
        <rect x={0} y={y(zTapa)} width={px0 - pared} height={bottom - y(zTapa) + 20} fill="var(--mat-terreno)" opacity="0.7" />
        <rect x={px1 + pared} y={y(zTapa)} width={ancho - px1 - pared} height={bottom - y(zTapa) + 20} fill="var(--mat-terreno)" opacity="0.7" />
        {/* Pozo */}
        <rect x={px0} y={y(p.cotaNivelMinimoM)} width={px1 - px0} height={bottom - y(p.cotaNivelMinimoM)} className="fill-mat-agua" />
        <rect x={px0} y={y(p.cotaNivelMaximoM)} width={px1 - px0} height={y(p.cotaNivelMinimoM) - y(p.cotaNivelMaximoM)} fill="var(--mat-agua)" opacity="0.45" />
        <line x1={px0} x2={px1} y1={y(p.cotaNivelMinimoM)} y2={y(p.cotaNivelMinimoM)} stroke="var(--mat-agua-borde)" strokeWidth="1.5" />
        <line x1={px0} x2={px1} y1={y(p.cotaNivelMaximoM)} y2={y(p.cotaNivelMaximoM)} stroke="var(--mat-agua-borde)" strokeDasharray="4 3" />
        <rect x={px0 - pared} y={y(zTapa)} width={pared} height={bottom - y(zTapa) + pared} className="fill-mat-canal" stroke="var(--mat-canal-borde)" />
        <rect x={px1} y={y(zTapa)} width={pared} height={bottom - y(zTapa) + pared} className="fill-mat-canal" stroke="var(--mat-canal-borde)" />
        <rect x={px0 - pared} y={bottom} width={px1 - px0 + 2 * pared} height={pared} className="fill-mat-canal" stroke="var(--mat-canal-borde)" />
        <text x={px1 - 4} y={y(p.cotaNivelMinimoM) + 12} textAnchor="end" {...T_SUAVE}>
          mín. {fmt(p.cotaNivelMinimoM, 2)}
        </text>
        <text x={px1 - 4} y={y(p.cotaNivelMaximoM) - 4} textAnchor="end" {...T_SUAVE}>
          máx. {fmt(p.cotaNivelMaximoM, 2)}
        </text>

        {/* Bomba */}
        {sumergible ? (
          <rect x={xRiser - 13} y={y(p.cotaAdmisionM + 0.4)} width={26} height={Math.max(14, y(p.cotaAdmisionM) - y(p.cotaAdmisionM + 0.4))} rx="4" className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" />
        ) : (
          <>
            <path
              d={`M${(px0 + px1) / 2},${y(p.cotaAdmisionM)} L${(px0 + px1) / 2},${y(p.cotaEjeBombaM)} L${xRiser - 12},${y(p.cotaEjeBombaM)}`}
              fill="none"
              stroke="var(--mat-tuberia-borde)"
              strokeWidth="5"
              opacity="0.8"
            />
            <circle cx={xRiser} cy={y(p.cotaEjeBombaM)} r="12" className="fill-mat-tuberia" stroke="var(--mat-tuberia-borde)" />
            <text x={xRiser + 16} y={y(p.cotaEjeBombaM) + 14} {...T_SUAVE}>
              eje {fmt(p.cotaEjeBombaM, 2)}
            </text>
          </>
        )}
        <text x={(px0 + px1) / 2} y={bottom + 22} textAnchor="middle" {...T}>
          {p.bombasOperacion} en operación + {Math.max(0, p.bombasInstaladas - p.bombasOperacion)} reserva
        </text>

        {/* Impulsión */}
        <path d={traza} fill="none" stroke="var(--mat-tuberia-borde)" strokeWidth="6" strokeLinejoin="round" opacity="0.85" />
        <path d={traza} fill="none" stroke="var(--mat-tuberia)" strokeWidth="3" strokeLinejoin="round" />
        {p.tramos.map((t, i) => (
          <g key={i}>
            {i > 0 && <line x1={xs[i]} x2={xs[i]} y1={y(zCaño) - 5} y2={y(zCaño) + 5} stroke="var(--mat-tuberia-borde)" />}
            <text x={(xs[i] + xs[i + 1]) / 2} y={y(zCaño) + 16} textAnchor="middle" {...T_SUAVE}>
              {t.nombre || `Tramo ${i + 1}`}
            </text>
            <text x={(xs[i] + xs[i + 1]) / 2} y={y(zCaño) + 28} textAnchor="middle" {...T}>
              Ø{fmt(t.diametroMm, 0)} · {fmt(t.longitudM, 0)} m
            </text>
          </g>
        ))}
        {/* Descarga */}
        <rect x={xFin} y={y(p.cotaDescargaM) - 10} width={46} height={20} fill="var(--mat-agua)" stroke="var(--mat-agua-borde)" />
        <text x={xFin + 23} y={y(p.cotaDescargaM) + 24} textAnchor="middle" {...T}>
          {fmt(p.cotaDescargaM, 2)}
        </text>
        <text x={xFin + 23} y={y(p.cotaDescargaM) + 36} textAnchor="middle" {...T_SUAVE}>
          descarga
        </text>

        {/* Línea piezométrica */}
        <polyline points={piezo.map(([x, zz]) => `${x},${y(zz)}`).join(" ")} fill="none" stroke="var(--mat-critico)" strokeWidth="1.5" strokeDasharray="6 3" />
        {p.presionDescargaM > 0 && (
          <line x1={xs[xs.length - 1]} x2={xs[xs.length - 1]} y1={y(p.cotaDescargaM)} y2={y(zFinal)} stroke="var(--mat-critico)" strokeDasharray="2 2" />
        )}
        <text x={xs[0] + 8} y={y(zPiezoIni) - 6} {...T} className="fill-mat-critico font-mono">
          línea piezométrica {fmt(zPiezoIni, 2)}
        </text>
        {p.tramos.map((t, i) =>
          t.perdidaM > 0 ? (
            <text key={i} x={(xs[i] + xs[i + 1]) / 2} y={y((piezo[i][1] + piezo[i + 1][1]) / 2) - 6} textAnchor="middle" {...T_SUAVE}>
              −{fmt(t.perdidaM, 2)} m
            </text>
          ) : null
        )}

        {/* Alturas */}
        <CotaV x={24} z1={p.cotaNivelMinimoM} z2={p.cotaDescargaM} y={y} texto="" />
        <text transform={`translate(18 ${(y(p.cotaNivelMinimoM) + y(p.cotaDescargaM)) / 2}) rotate(-90)`} textAnchor="middle" {...T}>
          Hgeo {fmt(p.cotaDescargaM - p.cotaNivelMinimoM, 2)} m
        </text>
        <CotaV x={66} z1={p.cotaNivelMinimoM} z2={zBomba} y={y} texto="" />
        <text transform={`translate(60 ${(y(p.cotaNivelMinimoM) + y(zBomba)) / 2}) rotate(-90)`} textAnchor="middle" {...T}>
          H {fmt(p.alturaTotalM, 2)} m
        </text>
        <line x1={24} x2={px0} y1={y(p.cotaNivelMinimoM)} y2={y(p.cotaNivelMinimoM)} stroke="var(--mat-cota)" strokeDasharray="2 3" opacity="0.6" />
        <text x={xFin - 6} y={top - 8} textAnchor="end" {...T}>
          Q {fmt(p.caudalTotalLs, 1)} L/s ({fmt(p.caudalBombaLs, 1)} por bomba)
        </text>
        {p.perdidaSuccionM > 0 && (
          <text x={xFin - 6} y={top + 6} textAnchor="end" {...T_SUAVE}>
            pérdida en la succión {fmt(p.perdidaSuccionM, 2)} m
          </text>
        )}
      </svg>
    </figure>
  );
}
