import { fmt } from "@/lib/calculadoras/formato";

/*
 * Croquis de las unidades de tratamiento. Reciben la geometría ya calculada y
 * la dibujan a escala entre sí (planta en escala real; cortes con la altura
 * exagerada, avisado en el rótulo), con la gramática de material de la
 * herramienta: el agua siempre del mismo celeste y las cotas del azul de cota.
 */

const T = { fontSize: 10, className: "fill-current font-mono" } as const;
const T_SUAVE = { fontSize: 9.5, className: "fill-muted-foreground" } as const;

function Cota({ x1, y1, x2, y2, texto, lado = "arriba" }: { x1: number; y1: number; x2: number; y2: number; texto: string; lado?: "arriba" | "derecha" | "izquierda" }) {
  const vertical = x1 === x2;
  const tick = 4;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--mat-cota)" strokeWidth="1" />
      {vertical ? (
        <>
          <line x1={x1 - tick} x2={x1 + tick} y1={y1} y2={y1} stroke="var(--mat-cota)" />
          <line x1={x1 - tick} x2={x1 + tick} y1={y2} y2={y2} stroke="var(--mat-cota)" />
          <text
            x={lado === "izquierda" ? x1 - 6 : x1 + 6}
            y={(y1 + y2) / 2}
            dominantBaseline="middle"
            textAnchor={lado === "izquierda" ? "end" : "start"}
            {...T}
          >
            {texto}
          </text>
        </>
      ) : (
        <>
          <line x1={x1} x2={x1} y1={y1 - tick} y2={y1 + tick} stroke="var(--mat-cota)" />
          <line x1={x2} x2={x2} y1={y2 - tick} y2={y2 + tick} stroke="var(--mat-cota)" />
          <text x={(x1 + x2) / 2} y={y1 - 6} textAnchor="middle" {...T}>
            {texto}
          </text>
        </>
      )}
    </g>
  );
}

function Flecha({ x1, y1, x2, y2, color = "var(--mat-agua-borde)" }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a = 6;
  const p1 = [x2 - a * Math.cos(ang - 0.45), y2 - a * Math.sin(ang - 0.45)];
  const p2 = [x2 - a * Math.cos(ang + 0.45), y2 - a * Math.sin(ang + 0.45)];
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.8" />
      <polygon points={`${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill={color} />
    </g>
  );
}

// ── Laguna facultativa ─────────────────────────────────────────────────────

interface DiagramaLagunaProps {
  largoM: number;
  anchoM: number;
  largoFondoM: number;
  anchoFondoM: number;
  profundidadM: number;
  alturaLodoM: number;
  taludZ: number;
}

export function DiagramaLaguna(p: DiagramaLagunaProps) {
  // Planta a escala.
  const W = 420;
  const planta = { x: 56, y: 34, w: 284, h: 130 };
  const esc = Math.min(planta.w / p.largoM, planta.h / p.anchoM);
  const lw = p.largoM * esc;
  const lh = p.anchoM * esc;
  const px = planta.x + (planta.w - lw) / 2;
  const py = planta.y + (planta.h - lh) / 2;
  const fw = Math.max(0, p.largoFondoM * esc);
  const fh = Math.max(0, p.anchoFondoM * esc);

  // Corte longitudinal, altura exagerada.
  const corte = { x: 40, y: 230, w: 300, h: 70 };
  const borde = 0.4; // borde libre dibujado, sólo ilustrativo
  const escH = corte.h / (p.profundidadM + borde);
  const escL = corte.w / (p.largoM + 2 * p.taludZ * borde);
  const xL = (m: number) => corte.x + (m + p.taludZ * borde) * escL;
  const yH = (m: number) => corte.y + corte.h - m * escH; // m desde el fondo
  const fondoIzq = xL(p.taludZ * p.profundidadM);
  const fondoDer = xL(p.largoM - p.taludZ * p.profundidadM);
  const agua = `${xL(0)},${yH(p.profundidadM)} ${xL(p.largoM)},${yH(p.profundidadM)} ${fondoDer},${yH(0)} ${fondoIzq},${yH(0)}`;
  const zl = p.taludZ * p.alturaLodoM;
  const lodo = `${fondoIzq - zl * escL},${yH(p.alturaLodoM)} ${fondoDer + zl * escL},${yH(p.alturaLodoM)} ${fondoDer},${yH(0)} ${fondoIzq},${yH(0)}`;
  const terreno = `${corte.x - 10},${yH(p.profundidadM + borde)} ${xL(-p.taludZ * borde)},${yH(p.profundidadM + borde)} ${fondoIzq},${yH(0)} ${fondoDer},${yH(0)} ${xL(p.largoM + p.taludZ * borde)},${yH(p.profundidadM + borde)} ${corte.x + corte.w + 10},${yH(p.profundidadM + borde)} ${corte.x + corte.w + 10},${yH(-0.25)} ${corte.x - 10},${yH(-0.25)}`;

  return (
    <figure className="esquemas-acotados space-y-1">
      <svg viewBox={`0 0 ${W} 330`} className="w-full" role="img" aria-label="Planta y corte de la laguna facultativa">
        <text x={planta.x} y={16} {...T_SUAVE} fontWeight="600">
          PLANTA
        </text>
        <rect x={px} y={py} width={lw} height={lh} fill="var(--mat-agua)" stroke="var(--mat-agua-borde)" strokeWidth="1.2" />
        <rect
          x={px + (lw - fw) / 2}
          y={py + (lh - fh) / 2}
          width={fw}
          height={fh}
          fill="none"
          stroke="var(--mat-agua-borde)"
          strokeDasharray="4 3"
          opacity="0.8"
        />
        <text x={px + lw / 2} y={py + lh / 2 + 3} textAnchor="middle" {...T_SUAVE}>
          fondo {fmt(p.largoFondoM, 1)} × {fmt(p.anchoFondoM, 1)} m
        </text>
        <Flecha x1={px - 26} y1={py + lh / 2} x2={px - 2} y2={py + lh / 2} />
        <text x={px - 2} y={py + lh / 2 - 8} textAnchor="end" {...T_SUAVE}>
          entrada
        </text>
        <Flecha x1={px + lw + 2} y1={py + lh / 2} x2={px + lw + 26} y2={py + lh / 2} />
        <text x={px + lw + 2} y={py + lh / 2 - 8} {...T_SUAVE}>
          salida
        </text>
        <Cota x1={px} y1={py - 10} x2={px + lw} y2={py - 10} texto={`L = ${fmt(p.largoM, 1)} m`} />
        <Cota x1={px + lw + 48} y1={py} x2={px + lw + 48} y2={py + lh} texto={`B = ${fmt(p.anchoM, 1)} m`} />

        <text x={corte.x} y={corte.y - 22} {...T_SUAVE} fontWeight="600">
          CORTE LONGITUDINAL (altura exagerada)
        </text>
        <polygon points={terreno} fill="var(--mat-terreno)" stroke="var(--mat-canal-borde)" strokeWidth="1" />
        <polygon points={agua} fill="var(--mat-agua)" />
        <line x1={xL(0)} x2={xL(p.largoM)} y1={yH(p.profundidadM)} y2={yH(p.profundidadM)} stroke="var(--mat-agua-borde)" strokeWidth="1.5" />
        {p.alturaLodoM > 0 && <polygon points={lodo} fill="var(--mat-lodo)" opacity="0.85" />}
        {p.alturaLodoM > 0 && (
          <text x={(fondoIzq + fondoDer) / 2} y={yH(p.alturaLodoM) - 4} textAnchor="middle" {...T_SUAVE}>
            lodo {fmt(p.alturaLodoM, 2)} m
          </text>
        )}
        <Cota x1={xL(p.largoM) + 34} y1={yH(p.profundidadM)} x2={xL(p.largoM) + 34} y2={yH(0)} texto={`H = ${fmt(p.profundidadM, 2)} m`} />
        <text x={(xL(0) + fondoIzq) / 2 - 4} y={yH(p.profundidadM / 2)} textAnchor="end" {...T_SUAVE}>
          {fmt(p.taludZ, 1)}:1
        </text>
        <text x={(xL(0) + xL(p.largoM)) / 2} y={yH(p.profundidadM) - 6} textAnchor="middle" {...T_SUAVE}>
          nivel de agua · {fmt(p.largoM, 1)} m
        </text>
      </svg>
    </figure>
  );
}

// ── Humedal de flujo vertical ──────────────────────────────────────────────

interface DiagramaHumedalProps {
  capas: { nombre: string; espesorM: number }[];
  largoM: number;
  anchoM: number;
  trenes: number;
  taludZ: number;
}

const COLOR_CAPA = ["var(--mat-arena)", "var(--mat-grava)", "var(--mat-grava-gruesa)", "var(--mat-canal)"];

export function DiagramaHumedal(p: DiagramaHumedalProps) {
  const W = 440;
  const total = p.capas.reduce((s, c) => s + c.espesorM, 0) || 1;
  // Corte: el lecho a lo ancho, altura exagerada.
  const c = { x: 20, y: 52, w: 240, h: 150 };
  const escH = c.h / (total + 0.35);
  const top = c.y + 0.35 * escH; // superficie del lecho
  const escB = c.w / (p.anchoM + 2 * p.taludZ * 0.35);
  const xB = (m: number) => c.x + (m + p.taludZ * 0.35) * escB;
  const acumulada = p.capas.map((_, i) => p.capas.slice(0, i).reduce((s, c) => s + c.espesorM, 0));
  const capas = p.capas.map((capa, i) => {
    const desde = acumulada[i];
    const hasta = desde + capa.espesorM;
    const y0 = top + desde * escH;
    const z0 = p.taludZ * desde;
    const y1 = top + hasta * escH;
    const z1 = p.taludZ * hasta;
    const pts = `${xB(z0)},${y0} ${xB(p.anchoM - z0)},${y0} ${xB(p.anchoM - z1)},${y1} ${xB(z1)},${y1}`;
    return { ...capa, pts, y0, y1, color: COLOR_CAPA[i % COLOR_CAPA.length] };
  });
  const fondoY = top + total * escH;
  const plantas = Array.from({ length: 9 }, (_, i) => xB(p.anchoM * (0.1 + (0.8 * i) / 8)));

  // Planta: trenes lado a lado.
  const pl = { x: 322, y: 52, w: 110, h: 140 };
  const tren = Math.max(1, Math.round(p.trenes));
  const sep = 6;
  const escP = Math.min((pl.w - sep * (tren - 1)) / (tren * p.anchoM), pl.h / p.largoM);
  const tw = p.anchoM * escP;
  const th = p.largoM * escP;

  return (
    <figure className="esquemas-acotados space-y-1">
      <svg viewBox={`0 0 ${W} 250`} className="w-full" role="img" aria-label="Corte y planta del humedal de flujo vertical">
        <text x={c.x} y={16} {...T_SUAVE} fontWeight="600">
          CORTE TRANSVERSAL (altura exagerada)
        </text>
        {/* membrana */}
        <polyline
          points={`${xB(-p.taludZ * 0.35)},${c.y} ${xB(p.taludZ * total)},${fondoY} ${xB(p.anchoM - p.taludZ * total)},${fondoY} ${xB(p.anchoM + p.taludZ * 0.35)},${c.y}`}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="1.6"
          opacity="0.7"
        />
        {capas.map((k) => (
          <g key={k.nombre}>
            <polygon points={k.pts} fill={k.color} stroke="var(--mat-canal-borde)" strokeWidth="0.6" />
          </g>
        ))}
        {/* plantas */}
        {plantas.map((x, i) => (
          <g key={i} stroke="var(--mat-planta)" strokeWidth="1.5" strokeLinecap="round">
            <line x1={x} y1={top} x2={x} y2={top - 22} />
            <line x1={x} y1={top - 6} x2={x - 6} y2={top - 20} />
            <line x1={x} y1={top - 6} x2={x + 6} y2={top - 19} />
          </g>
        ))}
        {/* alimentación y drenaje */}
        <line x1={xB(0) - 8} x2={xB(p.anchoM) + 8} y1={top - 30} y2={top - 30} stroke="var(--mat-tuberia-borde)" strokeWidth="4" />
        {[0.2, 0.5, 0.8].map((f) => (
          <Flecha key={f} x1={xB(p.anchoM * f)} y1={top - 26} x2={xB(p.anchoM * f)} y2={top - 8} />
        ))}
        <text x={xB(0)} y={top - 36} {...T_SUAVE}>
          alimentación intermitente
        </text>
        <circle cx={xB(p.anchoM / 2)} cy={fondoY - 7} r="5" fill="var(--background)" stroke="var(--mat-tuberia-borde)" strokeWidth="2" />
        <text x={xB(p.anchoM / 2) + 9} y={fondoY - 4} {...T_SUAVE}>
          drenaje
        </text>
        {capas.map((k) => (
          <text key={`t${k.nombre}`} x={c.x + c.w + 2} y={(k.y0 + k.y1) / 2 + 3} {...T} fontSize={9}>
            {fmt(k.espesorM, 2)} m
          </text>
        ))}
        <Cota x1={xB(0)} y1={fondoY + 22} x2={xB(p.anchoM)} y2={fondoY + 22} texto={`B = ${fmt(p.anchoM, 1)} m`} />
        {capas.map((k, i) => (
          <g key={`l${k.nombre}`}>
            <rect x={c.x + i * 82} y={226} width="10" height="9" rx="2" fill={k.color} stroke="var(--mat-canal-borde)" strokeWidth="0.6" />
            <text x={c.x + i * 82 + 14} y={234} {...T_SUAVE} fontSize={9}>
              {k.nombre.split(/[ (,]/)[0]}
            </text>
          </g>
        ))}

        <text x={pl.x} y={16} {...T_SUAVE} fontWeight="600">
          PLANTA
        </text>
        {Array.from({ length: tren }, (_, i) => {
          const x = pl.x + i * (tw + sep);
          return (
            <g key={i}>
              <rect x={x} y={pl.y} width={tw} height={th} fill="var(--mat-arena)" stroke="var(--mat-canal-borde)" />
              {Array.from({ length: 4 }, (_, k) => (
                <circle key={k} cx={x + tw / 2} cy={pl.y + ((k + 0.5) * th) / 4} r={Math.min(3, tw / 8)} fill="var(--mat-planta)" opacity="0.8" />
              ))}
              <text x={x + tw / 2} y={pl.y + th + 12} textAnchor="middle" {...T_SUAVE} fontSize={9}>
                {i + 1}
              </text>
            </g>
          );
        })}
        <text x={pl.x} y={pl.y + th + 26} {...T} fontSize={9.5}>
          {tren} trenes de
        </text>
        <text x={pl.x} y={pl.y + th + 38} {...T} fontSize={9.5}>
          {fmt(p.largoM, 1)} × {fmt(p.anchoM, 1)} m
        </text>
      </svg>
    </figure>
  );
}

// ── Desinfección con cloro ─────────────────────────────────────────────────

interface DiagramaCloroProps {
  largoM: number;
  anchoM: number;
  alturaM: number;
  dosisMgL: number;
  litrosDia: number;
  tiempoMin: number;
}

export function DiagramaCloro(p: DiagramaCloroProps) {
  const W = 420;
  // Cámara en planta con tabiques (flujo en serpentín).
  const cam = { x: 190, y: 40, w: 190, h: 120 };
  const esc = Math.min(cam.w / p.largoM, cam.h / p.anchoM);
  const cw = p.largoM * esc;
  const ch = p.anchoM * esc;
  const cx = cam.x + (cam.w - cw) / 2;
  const cy = cam.y + (cam.h - ch) / 2;
  const tabiques = 3;
  const paso = cw / (tabiques + 1);

  return (
    <figure className="esquemas-acotados space-y-1">
      <svg viewBox={`0 0 ${W} 200`} className="w-full" role="img" aria-label="Esquema de la desinfección con cloro">
        <text x={20} y={16} {...T_SUAVE} fontWeight="600">
          ESQUEMA
        </text>
        {/* tanque de hipoclorito */}
        <rect x={30} y={30} width={50} height={64} rx="6" fill="var(--mat-cloro)" stroke="var(--mat-tuberia-borde)" />
        <text x={55} y={58} textAnchor="middle" {...T} fontSize={9}>
          NaOCl
        </text>
        <text x={55} y={72} textAnchor="middle" {...T_SUAVE} fontSize={8.5}>
          {fmt(p.litrosDia, 1)} L/d
        </text>
        {/* dosificadora */}
        <circle cx={120} cy={62} r="13" fill="var(--background)" stroke="var(--mat-tuberia-borde)" strokeWidth="1.6" />
        <text x={120} y={65} textAnchor="middle" {...T_SUAVE} fontSize={8}>
          P
        </text>
        <line x1={80} y1={62} x2={107} y2={62} stroke="var(--mat-tuberia-borde)" strokeWidth="2" />
        <line x1={133} y1={62} x2={150} y2={62} stroke="var(--mat-tuberia-borde)" strokeWidth="2" />
        <line x1={150} y1={62} x2={150} y2={cy + ch / 2 - 4} stroke="var(--mat-tuberia-borde)" strokeWidth="2" strokeDasharray="3 2" />
        <text x={120} y={92} textAnchor="middle" {...T_SUAVE} fontSize={8.5}>
          dosificadora
        </text>
        {/* llegada del efluente */}
        <line x1={20} y1={cy + ch / 2} x2={cx} y2={cy + ch / 2} stroke="var(--mat-agua-borde)" strokeWidth="5" opacity="0.6" />
        <Flecha x1={20} y1={cy + ch / 2 + 14} x2={70} y2={cy + ch / 2 + 14} />
        <text x={20} y={cy + ch / 2 + 30} {...T_SUAVE}>
          efluente
        </text>
        <circle cx={150} cy={cy + ch / 2} r="4" fill="var(--mat-cloro)" stroke="var(--mat-tuberia-borde)" />
        <text x={150} y={cy + ch / 2 + 18} textAnchor="middle" {...T} fontSize={9}>
          {fmt(p.dosisMgL, p.dosisMgL % 1 ? 1 : 0)} mg/L
        </text>
        {/* cámara */}
        <rect x={cx} y={cy} width={cw} height={ch} fill="var(--mat-agua)" stroke="var(--mat-canal-borde)" strokeWidth="2" />
        {Array.from({ length: tabiques }, (_, i) => {
          const x = cx + paso * (i + 1);
          const desdeArriba = i % 2 === 0;
          return (
            <line
              key={i}
              x1={x}
              x2={x}
              y1={desdeArriba ? cy : cy + ch * 0.25}
              y2={desdeArriba ? cy + ch * 0.75 : cy + ch}
              stroke="var(--mat-canal-borde)"
              strokeWidth="3"
            />
          );
        })}
        <polyline
          points={(() => {
            const xs = Array.from({ length: tabiques + 1 }, (_, i) => cx + paso * (i + 0.5));
            const abajo = cy + ch * 0.88;
            const arriba = cy + ch * 0.12;
            const pts: string[] = [`${cx},${cy + ch / 2}`, `${xs[0]},${cy + ch / 2}`];
            xs.forEach((x, i) => {
              const y = i % 2 === 0 ? abajo : arriba;
              pts.push(`${x},${y}`);
              if (i < xs.length - 1) pts.push(`${xs[i + 1]},${y}`);
            });
            pts.push(`${cx + cw},${xs.length % 2 === 0 ? arriba : abajo}`);
            return pts.join(" ");
          })()}
          fill="none"
          stroke="var(--mat-agua-borde)"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
        <Flecha x1={cx + cw} y1={(tabiques + 1) % 2 === 0 ? cy + ch * 0.12 : cy + ch * 0.88} x2={cx + cw + 26} y2={(tabiques + 1) % 2 === 0 ? cy + ch * 0.12 : cy + ch * 0.88} />
        <text x={cx + cw - 2} y={cy - 6} textAnchor="end" {...T_SUAVE}>
          contacto {fmt(p.tiempoMin, 0)} min
        </text>
        <Cota x1={cx} y1={cy + ch + 16} x2={cx + cw} y2={cy + ch + 16} texto="" />
        <text x={cx + cw / 2} y={cy + ch + 30} textAnchor="middle" {...T}>
          {fmt(p.largoM, 2)} × {fmt(p.anchoM, 2)} m · H agua {fmt(p.alturaM, 2)} m
        </text>
      </svg>
    </figure>
  );
}
