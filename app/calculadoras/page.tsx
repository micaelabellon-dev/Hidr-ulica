import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agruparPorCategoria, registroCalculadoras } from "@/lib/calculadoras/registry";

export const metadata: Metadata = {
  title: "Calculadoras",
  description: "Todas las calculadoras de HidroCalc, agrupadas por régimen de flujo.",
};

export default function PaginaCalculadoras() {
  const categorias = agruparPorCategoria(registroCalculadoras);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <p className="spec-label">Catálogo completo</p>
        <h1 className="text-3xl font-semibold tracking-tight">Calculadoras</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Agrupadas por régimen de flujo: a presión, dentro de una tubería, o a superficie libre,
          dentro de un canal.
        </p>
      </div>

      {categorias.map(([categoria, items]) => (
        <div key={categoria} className="space-y-3">
          <h2 className="spec-label">{categoria}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((c) => (
              <Link key={c.id} href={c.ruta} className="group block">
                <Card className="h-full transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:ring-primary/20">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{c.nombre}</CardTitle>
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{c.descripcion}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.metodosDisponibles.map((m) => (
                        <Badge key={m} variant="secondary" className="font-mono tracking-wide">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
