"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Fila {
  etiqueta: string;
  valor: string;
  formula?: string;
  sustitucion?: string;
}

interface PanelFormulasProps {
  titulo: string;
  filas: Fila[];
}

/** "Ver cálculo": fórmula, sustitución numérica y resultado, como se escribe a mano. */
export function PanelFormulas({ titulo, filas }: PanelFormulasProps) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between border-t border-border/60 py-2 text-left">
        <span className="spec-label group-hover:text-foreground">{titulo}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground ${abierto ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent hiddenUntilFound>
        <dl className="space-y-2 pb-3 pt-1 text-sm">
          {filas.map((fila) =>
            fila.formula ? (
              <div
                key={fila.etiqueta}
                className="grid grid-cols-[auto_1fr] gap-x-2 border-l-2 border-border/60 pl-3 font-mono text-[13px] leading-relaxed"
              >
                <dt className="text-muted-foreground">{fila.etiqueta}</dt>
                <dd className="tabular-nums">= {fila.formula}</dd>

                {fila.sustitucion && (
                  <>
                    <dt aria-hidden="true" />
                    <dd className="tabular-nums text-muted-foreground">= {fila.sustitucion}</dd>
                  </>
                )}

                <dt aria-hidden="true" />
                <dd className="font-semibold tabular-nums text-primary">= {fila.valor}</dd>
              </div>
            ) : (
              <div
                key={fila.etiqueta}
                className="grid grid-cols-2 gap-x-4 border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
              >
                <dt className="text-muted-foreground">{fila.etiqueta}</dt>
                <dd className="text-right font-mono tabular-nums">{fila.valor}</dd>
              </div>
            )
          )}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}
