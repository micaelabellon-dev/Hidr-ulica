import type { Metadata } from "next";
import { Fredoka, IBM_Plex_Mono, Manrope } from "next/font/google";
import { Shell } from "@/components/shell/Shell";
import { scriptTemaInicial } from "@/components/TemaToggle";
import "./globals.css";

/**
 * Manrope para toda la interfaz, incluidos los títulos. La monoespaciada no
 * es decorativa: números, cotas y unidades van en ancho fijo para que no
 * bailen al recalcular mientras se tipea. Mismo criterio tipográfico que el
 * resto de las herramientas de cálculo de la oficina.
 */
const sans = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono-tecnica",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

const logo = Fredoka({
  variable: "--font-logo",
  subsets: ["latin"],
  display: "swap",
  weight: ["600"],
});

const descripcion =
  "Calculadoras de hidráulica: pérdida de carga en tuberías, bombeo desde pozos con elección de bomba, tirante normal en canales con Manning y balance hídrico de embalses.";

export const metadata: Metadata = {
  title: {
    default: "HidroCalc · Calculadoras de hidráulica",
    template: "%s · HidroCalc",
  },
  description: descripcion,
  applicationName: "HidroCalc",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${sans.variable} ${mono.variable} ${logo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTemaInicial }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
