import { NextResponse, type NextRequest } from "next/server";
import { claveDelSitio, COOKIE_ACCESO, hashAcceso, iguales } from "@/lib/acceso";

/** Pide la contraseña del sitio antes de mostrar cualquier página. */
export async function proxy(request: NextRequest) {
  const clave = claveDelSitio();
  if (!clave) return NextResponse.next();

  const cookie = request.cookies.get(COOKIE_ACCESO)?.value;
  if (cookie && iguales(cookie, await hashAcceso(clave))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/acceso";
  url.search = "";
  const desde = request.nextUrl.pathname + request.nextUrl.search;
  if (desde !== "/") url.searchParams.set("desde", desde);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!acceso|api/acceso|_next/static|_next/image|icon.svg|favicon.ico|robots.txt).*)"],
};
