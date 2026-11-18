import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { destinoSeguro } from "@/lib/acceso";

export const metadata: Metadata = {
  title: "Acceso",
  robots: { index: false, follow: false },
};

export default async function PaginaAcceso({ searchParams }: PageProps<"/acceso">) {
  const sp = await searchParams;
  const error = sp.error === "1";
  const desde = destinoSeguro(typeof sp.desde === "string" ? sp.desde : "/");

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-[2rem] border border-border bg-card/90 p-8 shadow-sm backdrop-blur">
        <Logo className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-center text-4xl">Acceso privado</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">El sitio está en preparación. Ingresá la contraseña para entrar.</p>

        <form action="/api/acceso" method="post" className="mt-8 space-y-4">
          <input type="hidden" name="desde" value={desde} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Contraseña</span>
            <input
              type="password"
              name="clave"
              required
              autoFocus
              autoComplete="current-password"
              className="h-11 w-full rounded-full border border-input bg-background/60 px-4 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              Contraseña incorrecta.
            </p>
          )}
          <button
            type="submit"
            className="h-11 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
