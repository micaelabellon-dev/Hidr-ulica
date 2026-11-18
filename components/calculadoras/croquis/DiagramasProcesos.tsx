import { fmt } from "@/lib/calculadoras/formato";

/*
 * Croquis de sedimentadores y DAF. Esquemáticos (no a escala real), con las
 * medidas calculadas en los rótulos y la gramática de material de la
 * herramienta: agua celeste, lodo marrón, cotas en azul de cota.
 */

const T = { fontSize: 10, className: "fill-current font-mono" } as const;
const TS = { fontSize: 9.5, className: "fill-muted-foreground" } as const;

function Flecha({ x1, y1, x2, y2, color = "var(--mat-agua-borde)", ancho = 1.8 }: { x1: number; y1: number; x2: number; y2: number; color?: string; ancho?: number }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a = 6;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={ancho} />
      <polygon
        points={`${x2},${y2} ${x2 - a * Math.cos(ang - 0.45)},${y2 - a * Math.sin(ang - 0.45)} ${x2 - a * Math.cos(ang + 0.45)},${y2 - a * Math.sin(ang + 0.45)}`}
        fill={color}
      />
    </g>
  );
}

function CotaH({ x1, x2, y, texto }: { x1: number; x2: number; y: number; texto: string }) {
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke="var(--mat-cota)" />
      <line x1={x1} x2={x1} y1={y - 4} y2={y + 4} stroke="var(--mat-cota)" />
      <line x1={x2} x2={x2} y1={y - 4} y2={y + 4} stroke="var(--mat-cota)" />
      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" {...T}>
        {texto}
      </text>
    </g>
  );
}

function CotaV({ x, y1, y2, texto }: { x: number; y1: number; y2: number; texto: string }) {
  return (
    <g>
      <line x1={x} x2={x} y1={y1} y2={y2} stroke="var(--mat-cota)" />
      <line x1={x - 4} x2={x + 4} y1={y1} y2={y1} stroke="var(--mat-cota)" />
      <line x1={x - 4} x2={x + 4} y1={y2} y2={y2} stroke="var(--mat-cota)" />
      <text x={x + 6} y={(y1 + y2) / 2} dominantBaseline="middle" {...T}>
        {texto}
      </text>
    </g>
  );
}

// ── Sedimentador rectangular ───────────────────────────────────────────────

export function DiagramaSedimentadorRectangular(p: { largoM: number; anchoM: number; profundidadM: number; unidades: number; tiempoH: number }) {
  const x0 = 50;
  const x1 = 360;
  const yAgua = 40;
  const yFondo = 130;
  const tolva = 34;
  return (
    <figure className="esquemas-acotados space-y-1">
      <svg viewBox="0 0 470 270" className="w-full" role="img" aria-label="Corte y planta del sedimentador rectangular">
        <text x={x0} y={16} {...TS} fontWeight="600">
          CORTE LONGITUDINAL
        </text>
        {/* agua */}
        <polygon points={`${x0},${yAgua} ${x1},${yAgua} ${x1},${yFondo} ${x0 + tolva * 1.4},${yFondo} ${x0 + tolva},${yFondo + tolva} ${x0 + 6},${yFondo + tolva} ${x0},${yFondo}`} fill="var(--mat-agua)" />
        {/* lodo en el fondo y la tolva */}
        <polygon points={`${x0},${yFondo - 6} ${x1},${yFondo - 2} ${x1},${yFondo} ${x0 + tolva * 1.4},${yFondo} ${x0 + tolva},${yFondo + tolva} ${x0 + 6},${yFondo + tolva} ${x0},${yFondo}`} fill="var(--mat-lodo)" opacity="0.85" />
        {/* paredes */}
        <polyline points={`${x0},${yAgua - 14} ${x0},${yFondo} ${x0 + 6},${yFondo + tolva} ${x0 + tolva},${yFondo + tolva} ${x0 + tolva * 1.4},${yFondo} ${x1},${yFondo} ${x1},${yAgua - 14}`} fill="none" stroke="var(--mat-canal-borde)" strokeWidth="3" />
        <line x1={x0} x2={x1} y1={yAgua} y2={yAgua} stroke="var(--mat-agua-borde)" strokeWidth="1.5" />
        {/* pantalla deflectora */}
        <line x1={x0 + 22} x2={x0 + 22} y1={yAgua - 10} y2={yAgua + 34} stroke="var(--mat-canal-borde)" strokeWidth="3" />
        {/* vertedero */}
        <rect x={x1 - 22} y={yAgua - 6} width={16} height={14} fill="var(--background)" stroke="var(--mat-canal-borde)" strokeWidth="1.5" />
        <Flecha x1={x0 - 34} y1={yAgua + 8} x2={x0 + 4} y2={yAgua + 8} />
        <text x={x0 - 34} y={yAgua - 2} {...TS}>
          entrada
        </text>
        <Flecha x1={x1 + 2} y1={yAgua} x2={x1 + 36} y2={yAgua} />
        <text x={x1 + 4} y={yAgua - 8} {...TS}>
          vertedero
        </text>
        {/* trayectorias de partículas */}
        {[0.15, 0.3, 0.45].map((f, i) => (
          <line key={i} x1={x0 + 30} y1={yAgua + 10 + i * 14} x2={x0 + 30 + (x1 - x0 - 60) * (0.55 + f)} y2={yFondo - 8} stroke="var(--mat-lodo)" strokeDasharray="2 3" opacity="0.9" />
        ))}
        <Flecha x1={x0 + 20} y1={yFondo + tolva - 6} x2={x0 - 26} y2={yFondo + tolva - 6} color="var(--mat-lodo)" />
        <text x={x0 - 40} y={yFondo + tolva + 10} {...TS}>
          purga de lodos
        </text>
        <text x={(x0 + x1) / 2} y={yFondo - 12} textAnchor="middle" {...TS}>
          zona de sedimentación · t = {fmt(p.tiempoH, 2)} h
        </text>
        <CotaH x1={x0} x2={x1} y={yFondo + tolva + 26} texto={`L = ${fmt(p.largoM, 2)} m`} />
        <CotaV x={x1 + 30} y1={yAgua + 14} y2={yFondo} texto={`H = ${fmt(p.profundidadM, 2)} m`} />

        <text x={x0} y={238} {...TS} fontWeight="600">
          PLANTA
        </text>
        {Array.from({ length: Math.min(4, Math.max(1, Math.round(p.unidades))) }, (_, i) => {
          const w = 70;
          const h = Math.max(8, Math.min(22, (w * p.anchoM) / p.largoM));
          return (
            <g key={i}>
              <rect x={x0 + 50 + i * (w + 8)} y={230} width={w} height={h} fill="var(--mat-agua)" stroke="var(--mat-canal-borde)" />
            </g>
          );
        })}
        <text x={x0 + 50} y={265} {...T} fontSize={9.5}>
          {Math.round(p.unidades)} × {fmt(p.largoM, 2)} × {fmt(p.anchoM, 2)} m
        </text>
      </svg>
    </figure>
  );
}

// ── Sedimentador circular ──────────────────────────────────────────────────

export function DiagramaSedimentadorCircular(p: { diametroM: number; profundidadM: number; unidades: number; tiempoH: number }) {
  const cx = 200;
  const r = 150;
  const yAgua = 50;
  const yFondo = 140;
  const cono = 26;
  return (
    <figure className="esquemas-acotados space-y-1">
      <svg viewBox="0 0 430 230" className="w-full" role="img" aria-label="Corte del sedimentador circular">
        <text x={cx - r} y={16} {...TS} fontWeight="600">
          CORTE DIAMETRAL
        </text>
        <polygon points={`${cx - r},${yAgua} ${cx + r},${yAgua} ${cx + r},${yFondo} ${cx + 14},${yFondo + cono} ${cx - 14},${yFondo + cono} ${cx - r},${yFondo}`} fill="var(--mat-agua)" />
        <polygon points={`${cx - r},${yFondo - 4} ${cx + r},${yFondo - 4} ${cx + r},${yFondo} ${cx + 14},${yFondo + cono} ${cx - 14},${yFondo + cono} ${cx - r},${yFondo}`} fill="var(--mat-lodo)" opacity="0.85" />
        <polyline points={`${cx - r},${yAgua - 12} ${cx - r},${yFondo} ${cx - 14},${yFondo + cono} ${cx + 14},${yFondo + cono} ${cx + r},${yFondo} ${cx + r},${yAgua - 12}`} fill="none" stroke="var(--mat-canal-borde)" strokeWidth="3" />
        <line x1={cx - r} x2={cx + r} y1={yAgua} y2={yAgua} stroke="var(--mat-agua-borde)" strokeWidth="1.5" />
        {/* campana central y alimentación */}
        <rect x={cx - 22} y={yAgua - 12} width={44} height={46} fill="none" stroke="var(--mat-canal-borde)" strokeWidth="2.5" />
        <line x1={cx} x2={cx} y1={yFondo + cono + 18} y2={yAgua + 8} stroke="var(--mat-tuberia-borde)" strokeWidth="5" opacity="0.7" />
        <Flecha x1={cx} y1={yAgua + 30} x2={cx - 60} y2={yAgua + 50} />
        <Flecha x1={cx} y1={yAgua + 30} x2={cx + 60} y2={yAgua + 50} />
        {/* barredor */}
        <line x1={cx - r + 10} x2={cx + r - 10} y1={yFondo - 8} y2={yFondo - 8} stroke="var(--foreground)" strokeWidth="1.5" opacity="0.6" />
        <text x={cx + 30} y={yFondo - 12} {...TS}>
          barredor
        </text>
        {/* vertederos perimetrales */}
        <rect x={cx - r + 2} y={yAgua - 6} width={14} height={12} fill="var(--background)" stroke="var(--mat-canal-borde)" />
        <rect x={cx + r - 16} y={yAgua - 6} width={14} height={12} fill="var(--background)" stroke="var(--mat-canal-borde)" />
        <Flecha x1={cx + r} y1={yAgua} x2={cx + r + 34} y2={yAgua} />
        <text x={cx + r - 30} y={yAgua - 10} {...TS}>
          vertedero perimetral
        </text>
        <text x={cx + 8} y={yFondo + cono + 14} {...TS}>
          alimentación · purga
        </text>
        <line x1={cx - r} x2={cx + r} y1={yFondo + cono + 30} y2={yFondo + cono + 30} stroke="var(--mat-cota)" />
        <text x={cx} y={yFondo + cono + 44} textAnchor="middle" {...T}>
          Ø = {fmt(p.diametroM, 2)} m · H = {fmt(p.profundidadM, 2)} m · {Math.round(p.unidades)} unidad{Math.round(p.unidades) > 1 ? "es" : ""} · t = {fmt(p.tiempoH, 2)} h
        </text>
      </svg>
    </figure>
  );
}

// ── Sedimentador laminar ───────────────────────────────────────────────────

export function DiagramaSedimentadorLaminar(p: { anguloGrados: number; espaciamientoM: number; largoPlacaM: number; v0Md: number; areaM2: number }) {
  const th = (p.anguloGrados * Math.PI) / 180;
  const largo = 120;
  const dx = largo * Math.cos(th);
  const dy = largo * Math.sin(th);
  const base = { x: 90, y: 170 };
  const placas = 7;
  const sep = 26;
  return (
    <figure className="esquemas-acotados space-y-1">
      <svg viewBox="0 0 430 230" className="w-full" role="img" aria-label="Corte del módulo de placas del sedimentador laminar">
        <text x={20} y={16} {...TS} fontWeight="600">
          CORTE DEL MÓDULO DE PLACAS
        </text>
        <rect x={40} y={26} width={340} height={186} fill="var(--mat-agua)" stroke="var(--mat-canal-borde)" strokeWidth="2" />
        <rect x={40} y={190} width={340} height={22} fill="var(--mat-lodo)" opacity="0.8" />
        {Array.from({ length: placas }, (_, i) => {
          const x = base.x + i * sep;
          return <line key={i} x1={x} y1={base.y} x2={x + dx} y2={base.y - dy} stroke="var(--mat-tuberia-borde)" strokeWidth="3" />;
        })}
        {/* flujo ascendente entre placas */}
        <Flecha x1={base.x + 2.5 * sep + dx * 0.15} y1={base.y - dy * 0.15} x2={base.x + 2.5 * sep + dx * 0.8} y2={base.y - dy * 0.8} />
        {/* lodo que desliza */}
        <Flecha x1={base.x + 4 * sep + dx * 0.75 + 4} y1={base.y - dy * 0.75 + 6} x2={base.x + 4 * sep + dx * 0.2 + 4} y2={base.y - dy * 0.2 + 6} color="var(--mat-lodo)" ancho={1.4} />
        {/* canaletas de salida */}
        {[120, 220, 320].map((x) => (
          <rect key={x} x={x} y={34} width={30} height={10} fill="var(--background)" stroke="var(--mat-canal-borde)" />
        ))}
        <Flecha x1={60} y1={200} x2={110} y2={182} />
        <text x={46} y={186} {...TS}>
          agua floculada
        </text>
        <text x={240} y={60} {...TS}>
          agua decantada
        </text>
        {/* ángulo */}
        <path d={`M ${base.x + 30} ${base.y} A 30 30 0 0 0 ${base.x + 30 * Math.cos(th)} ${base.y - 30 * Math.sin(th)}`} fill="none" stroke="var(--mat-cota)" />
        <text x={base.x + 34} y={base.y - 8} {...T}>
          θ = {fmt(p.anguloGrados, 0)}°
        </text>
        <text x={base.x + 6 * sep + dx + 6} y={base.y - dy + 6} {...T}>
          l = {fmt(p.largoPlacaM, 2)} m
        </text>
        <text x={base.x + 6 * sep + 18} y={base.y - 4} {...T}>
          e = {fmt(p.espaciamientoM * 100, 1)} cm
        </text>
        <text x={210} y={225} textAnchor="middle" {...T} fontSize={9.5}>
          v0 = {fmt(p.v0Md, 0)} m/d entre placas · área en planta {fmt(p.areaM2, 1)} m²
        </text>
      </svg>
    </figure>
  );
}

// ── DAF ────────────────────────────────────────────────────────────────────

export function DiagramaDaf(p: { largoM: number; anchoM: number; recirculacionM3d: number; porcentaje: number; presionKPa: number; caudalM3d: number }) {
  const tk = { x: 150, y: 50, w: 230, h: 100 };
  const burbujas = Array.from({ length: 26 }, (_, i) => ({
    x: tk.x + 20 + ((i * 37) % (tk.w - 60)),
    y: tk.y + 26 + ((i * 23) % (tk.h - 40)),
    r: 1.6 + (i % 3) * 0.6,
  }));
  return (
    <figure className="esquemas-acotados space-y-1">
      <svg viewBox="0 0 470 250" className="w-full" role="img" aria-label="Esquema de la flotación por aire disuelto">
        <text x={20} y={16} {...TS} fontWeight="600">
          ESQUEMA
        </text>
        {/* tanque */}
        <rect x={tk.x} y={tk.y} width={tk.w} height={tk.h} fill="var(--mat-agua)" stroke="var(--mat-canal-borde)" strokeWidth="2.5" />
        <rect x={tk.x + 2} y={tk.y + 2} width={tk.w - 4} height={12} fill="var(--mat-lodo)" opacity="0.85" />
        <text x={tk.x + tk.w / 2} y={tk.y - 6} textAnchor="middle" {...TS}>
          manto de flotantes · barredor superficial →
        </text>
        {burbujas.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="var(--background)" stroke="var(--mat-agua-borde)" strokeWidth="0.8" />
        ))}
        {/* tabique de contacto */}
        <line x1={tk.x + 40} x2={tk.x + 40} y1={tk.y + tk.h} y2={tk.y + 30} stroke="var(--mat-canal-borde)" strokeWidth="2.5" />
        {/* entrada y salida */}
        <Flecha x1={40} y1={tk.y + tk.h - 18} x2={tk.x + 4} y2={tk.y + tk.h - 18} />
        <text x={20} y={tk.y + tk.h - 26} {...TS}>
          afluente Q = {fmt(p.caudalM3d, 0)} m³/d
        </text>
        <Flecha x1={tk.x + tk.w} y1={tk.y + tk.h - 10} x2={tk.x + tk.w + 36} y2={tk.y + tk.h - 10} />
        <text x={tk.x + tk.w - 30} y={tk.y + tk.h + 14} {...TS}>
          clarificado
        </text>
        <Flecha x1={tk.x + tk.w - 10} y1={tk.y + 8} x2={tk.x + tk.w + 36} y2={tk.y + 8} color="var(--mat-lodo)" />
        <text x={tk.x + tk.w + 4} y={tk.y - 2} {...TS}>
          lodo flotado
        </text>
        {/* circuito de recirculación */}
        <polyline points={`${tk.x + tk.w + 18},${tk.y + tk.h - 10} ${tk.x + tk.w + 18},${215} ${120},${215}`} fill="none" stroke="var(--mat-tuberia-borde)" strokeWidth="2.5" />
        <circle cx={300} cy={215} r={11} fill="var(--background)" stroke="var(--mat-tuberia-borde)" strokeWidth="1.8" />
        <text x={300} y={218} textAnchor="middle" {...TS} fontSize={8}>
          B
        </text>
        <rect x={150} y={196} width={70} height={36} rx="14" fill="var(--mat-cloro)" stroke="var(--mat-tuberia-borde)" />
        <text x={185} y={212} textAnchor="middle" {...T} fontSize={9}>
          saturador
        </text>
        <text x={185} y={225} textAnchor="middle" {...TS} fontSize={8.5}>
          {fmt(p.presionKPa, 0)} kPa
        </text>
        <Flecha x1={185} y1={176} x2={185} y2={195} color="var(--foreground)" ancho={1.2} />
        <text x={192} y={182} {...TS} fontSize={8.5}>
          aire
        </text>
        <polyline points={`120,215 100,215 100,${tk.y + tk.h - 18} 128,${tk.y + tk.h - 18}`} fill="none" stroke="var(--mat-tuberia-borde)" strokeWidth="2.5" />
        <polygon points={`94,${190} 106,${190} 100,${200}`} fill="var(--background)" stroke="var(--mat-tuberia-borde)" />
        <text x={46} y={196} {...TS} fontSize={8.5}>
          válvula
        </text>
        <text x={230} y={244} {...T} fontSize={9.5}>
          R = {fmt(p.recirculacionM3d, 0)} m³/d ({fmt(p.porcentaje, 0)} %)
        </text>
        <text x={tk.x + tk.w / 2} y={tk.y + tk.h / 2 + 4} textAnchor="middle" {...T}>
          {fmt(p.largoM, 2)} × {fmt(p.anchoM, 2)} m
        </text>
      </svg>
    </figure>
  );
}
