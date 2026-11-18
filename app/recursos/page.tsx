import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { GRUPOS_RECURSOS } from "@/lib/recursos";

export const metadata: Metadata = {
  title: "Recursos",
  description: "Links útiles: mapas (IDEuy, MonteviMap), normativa uruguaya de aguas, aire e impacto ambiental, organismos y software.",
};

export default function PaginaRecursos() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-12">
      <div className="text-center">
        <p className="spec-label">Para tener a mano</p>
        <h1 className="mt-2 text-5xl font-medium">Recursos</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Mapas, normativa, organismos y programas que se usan en el día a día del cálculo hidráulico y ambiental en Uruguay.
          Los links abren el sitio oficial en una pestaña nueva.
        </p>
      </div>

      {GRUPOS_RECURSOS.map((g) => (
        <section key={g.titulo} className="space-y-4">
          <div>
            <h2 className="text-3xl text-primary">{g.titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{g.descripcion}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.recursos.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col gap-2 rounded-3xl border border-border bg-card/80 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl">{r.nombre}</h3>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{r.descripcion}</p>
                  <div className="flex items-center gap-2 text-xs">
                    {r.etiqueta && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          r.etiqueta === "Vigente" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.etiqueta}
                      </span>
                    )}
                    <span className="truncate text-muted-foreground/80">{new URL(r.url).hostname.replace(/^www\./, "")}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-center text-xs text-muted-foreground">
        Los sitios externos pueden cambiar sus direcciones; si un link no funciona, buscá la norma por número en impo.com.uy.
      </p>
    </main>
  );
}
