/**
 * Acceso con contraseña a todo el sitio.
 *
 * La contraseña vive en la variable de entorno SITIO_CLAVE (en Vercel:
 * Settings → Environment Variables). Si no está definida, el sitio queda
 * abierto, para no dejar a nadie afuera antes de configurarla.
 *
 * La cookie no guarda la contraseña sino un hash SHA-256 de ella: si se
 * cambia la contraseña, las sesiones anteriores dejan de valer.
 */

export const COOKIE_ACCESO = "hidrocalc_acceso";
export const DURACION_ACCESO_S = 60 * 60 * 24 * 30;

export function claveDelSitio(): string | null {
  const c = process.env.SITIO_CLAVE?.trim();
  return c ? c : null;
}

export async function hashAcceso(clave: string): Promise<string> {
  const datos = new TextEncoder().encode(`hidrocalc-acceso:${clave}`);
  const digest = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante entre dos cadenas de igual largo. */
export function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Solo rutas internas, para no redirigir a otro sitio. */
export function destinoSeguro(desde: string | null | undefined): string {
  return desde && desde.startsWith("/") && !desde.startsWith("//") ? desde : "/";
}
