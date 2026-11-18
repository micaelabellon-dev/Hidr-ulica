import { NextResponse, type NextRequest } from "next/server";
import { claveDelSitio, COOKIE_ACCESO, destinoSeguro, DURACION_ACCESO_S, hashAcceso, iguales } from "@/lib/acceso";

/** Recibe el formulario de /acceso: si la contraseña es correcta, deja la cookie y vuelve a donde iba. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const ingresada = String(form.get("clave") ?? "");
  const desde = destinoSeguro(String(form.get("desde") ?? "/"));
  const clave = claveDelSitio();

  if (!clave) return NextResponse.redirect(new URL(desde, request.url), 303);

  const [hIngresada, hClave] = await Promise.all([hashAcceso(ingresada), hashAcceso(clave)]);
  if (!iguales(hIngresada, hClave)) {
    const url = new URL("/acceso", request.url);
    url.searchParams.set("error", "1");
    if (desde !== "/") url.searchParams.set("desde", desde);
    return NextResponse.redirect(url, 303);
  }

  const res = NextResponse.redirect(new URL(desde, request.url), 303);
  res.cookies.set(COOKIE_ACCESO, hClave, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_ACCESO_S,
  });
  return res;
}
