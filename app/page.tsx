import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HeroResumen } from "@/components/shell/HeroResumen";
import { registroCalculadoras } from "@/lib/calculadoras/registry";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
      <HeroResumen />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Biblioteca de calculadoras
            </p>
            <h2 className="mt-1 text-2xl">¿Qué necesitás calcular?</h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {registroCalculadoras.map((c, i) => (
            <Link key={c.id} href={c.ruta} className="group block">
              <Card className="h-full transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base">{c.nombre}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.descripcion}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                    {c.metodosDisponibles.map((m) => (
                      <Badge key={m} variant="secondary" className="font-mono tracking-wide">
                        {m}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground">{c.categoria}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
        HidroCalc es una herramienta de verificación: no reemplaza el criterio del proyectista ni
        la firma de un técnico habilitado, y el resultado no vale como memoria de cálculo por sí
        solo.{" "}
        <Link href="/alcance" className="underline underline-offset-2 hover:text-foreground">
          Alcance y responsabilidad
        </Link>
        .
      </p>
    </main>
  );
}
