"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * Campo de formulario que recuerda su valor entre recargas y navegaciones.
 *
 * Reemplaza a useState en las páginas de calculadora: sin esto, salir a mirar
 * la otra calculadora borraba todo lo cargado.
 *
 * Los valores se guardan por ruta, así que cada calculadora tiene su propio
 * juego de datos. Al leerse con useSyncExternalStore, el servidor renderiza el
 * valor por defecto y el navegador el guardado sin romper la hidratación, y
 * dos pestañas abiertas con la misma calculadora quedan sincronizadas.
 */

const PREFIJO = "hidrocalc:v1";
const EVENTO_CAMBIO = "hidrocalc:campo";

function claveDe(ruta: string, nombre: string) {
  return `${PREFIJO}:${ruta}:${nombre}`;
}

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO_CAMBIO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO_CAMBIO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

function useCampoBase(nombre: string, inicial: string): [string, (valor: string) => void] {
  const ruta = usePathname();
  const clave = claveDe(ruta, nombre);

  const valor = useSyncExternalStore(
    suscribir,
    () => leer(clave) ?? inicial,
    () => inicial
  );

  const guardar = useCallback(
    (nuevo: string) => {
      try {
        window.localStorage.setItem(clave, nuevo);
      } catch {
        // Si no se puede guardar, al menos se refleja en pantalla.
      }
      window.dispatchEvent(new Event(EVENTO_CAMBIO));
    },
    [clave]
  );

  return [valor, guardar];
}

// El valor inicial es un literal en las páginas ("20", "pvc"), así que sin las
// sobrecargas TypeScript infiere el tipo literal y rechaza cualquier otro valor.
export function useCampo(nombre: string, inicial: string): [string, (valor: string) => void];
export function useCampo<T extends string>(nombre: string, inicial: T): [T, (valor: T) => void];
export function useCampo(nombre: string, inicial: string): [string, (valor: string) => void] {
  return useCampoBase(nombre, inicial);
}

/** Borra los valores guardados de una ruta y devuelve los campos a su valor por defecto. */
export function restablecerCampos(ruta: string) {
  try {
    const prefijo = `${PREFIJO}:${ruta}:`;
    const aBorrar: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(prefijo)) aBorrar.push(k);
    }
    aBorrar.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Si el almacenamiento no está disponible igual conviene refrescar la pantalla.
  }
  window.dispatchEvent(new Event(EVENTO_CAMBIO));
}
