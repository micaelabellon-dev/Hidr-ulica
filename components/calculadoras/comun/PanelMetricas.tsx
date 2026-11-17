export interface Metrica {
  etiqueta: string;
  valor: string;
  nota?: string;
  destacada?: boolean;
}

/** Las magnitudes en fila, sin caja, separadas por una línea vertical. */
export function PanelMetricas({ metricas, horizontal = false }: { metricas: Metrica[]; horizontal?: boolean }) {
  if (horizontal) {
    return (
      <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-4">
        {metricas.map((m) => (
          <div key={m.etiqueta} className="border-l border-border/70 pl-3">
            <dt className="text-[11px] text-muted-foreground">{m.etiqueta}</dt>
            <dd className="font-mono text-lg font-medium tabular-nums">{m.valor}</dd>
            {m.nota && <p className="text-[11px] leading-snug text-muted-foreground">{m.nota}</p>}
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-1">
      {metricas.map((m) => (
        <div
          key={m.etiqueta}
          className={`rounded-lg border p-2.5 ${m.destacada ? "border-primary/40 bg-accent/60" : "border-border/70"}`}
        >
          <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {m.etiqueta}
          </dt>
          <dd className="mt-0.5 font-mono text-lg font-medium tabular-nums">{m.valor}</dd>
          {m.nota && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.nota}</p>}
        </div>
      ))}
    </dl>
  );
}
