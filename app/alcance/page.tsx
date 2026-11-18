import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Alcance y responsabilidad",
  description: "Qué respalda cada resultado de HidroCalc y quién responde por el cálculo.",
};

export default function AlcancePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <div className="flex items-center justify-between gap-4 print:hidden md:hidden">
        <Link href="/" aria-label="HidroCalc — inicio">
          <Logo className="h-7 w-auto" titulo="" />
        </Link>
      </div>

      <div>
        <p className="spec-label">Antes de usar un resultado</p>
        <h1 className="text-3xl font-semibold tracking-tight">Alcance y responsabilidad</h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Qué es esto, y qué no es</h2>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            HidroCalc es una <strong className="text-foreground">herramienta de verificación</strong>:
            resuelve la pérdida de carga de un tramo de tubería (Darcy-Weisbach o Hazen-Williams) y el
            tirante normal de un canal (Manning) a partir de los datos que se cargan, y deja a la
            vista la fórmula y la sustitución numérica para que el resultado se pueda rehacer a mano.
          </p>
          <p>
            <strong className="text-foreground">No es un programa de diseño</strong> y no decide por
            vos: no elige el trazado de la red ni del canal, no evalúa el riesgo de erosión o
            sedimentación, no agrega el resguardo (borde libre) necesario sobre el tirante calculado,
            y no avisa cuando el problema real no es el que se está calculando. Esas decisiones siguen
            siendo del proyectista.
          </p>
          <p>
            <strong className="text-foreground">No reemplaza la firma de un técnico habilitado</strong>{" "}
            ni vale como memoria de cálculo por sí solo. La hoja que se imprime desde cada calculadora
            sirve para adjuntar al expediente, pero quien la firma es quien responde por ella.
          </p>
          <p className="rounded-md border p-3">
            Este texto describe el alcance de la herramienta con la mayor honestidad posible, pero{" "}
            <strong className="text-foreground">no fue revisado por un abogado</strong> y no pretende
            ser una cláusula de exención de responsabilidad.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Qué hipótesis usa cada calculadora</h2>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Pérdida de carga.</strong> Tubería llena, flujo
            permanente e incompresible. El factor de fricción de Darcy-Weisbach sale de
            Colebrook-White, resuelto por iteración numérica; en régimen laminar (Re &lt; 2300) se usa
            f = 64/Re. Hazen-Williams es una fórmula empírica, válida sólo para agua a temperatura
            ambiente. Las pérdidas localizadas se suman como un único Σ K, a cargo de quien calcula
            elegir los coeficientes de catálogo que correspondan a los accesorios reales del tramo.
          </p>
          <p>
            <strong className="text-foreground">Canales con Manning.</strong> Flujo uniforme y
            permanente, sección prismática (no varía a lo largo del canal) y pendiente de fondo
            pequeña. El tirante es el normal, el que se alcanza lejos de cualquier control de aguas
            abajo: no corresponde a un resalto, una curva ni una transición de sección.
          </p>
          <p>
            <strong className="text-foreground">Bombeo: altura, bomba y potencia.</strong> Mismas
            hipótesis que la pérdida de carga, tramo por tramo; las pérdidas fijas (caudalímetro,
            filtro) se cargan con el caudal de diseño y se escalan con el cuadrado del caudal. Con
            varias bombas en paralelo se suponen iguales. La curva de la bomba es un ajuste
            polinómico de los puntos de catálogo y no se extrapola. Los niveles del pozo son valores
            fijos: en un pozo de agua subterránea el mínimo tiene que incluir el descenso por el
            propio bombeo. El NPSH disponible usa la atmósfera estándar según la altitud y la presión
            de vapor según la temperatura.
          </p>
          <p>
            <strong className="text-foreground">Pozo de bombeo (cámara húmeda).</strong> Volumen útil
            por el criterio del ciclo más corto (caudal de entrada igual a la mitad del de bombeo),
            sin contar el volumen de la tubería de llegada. El tiempo de detención se calcula con el
            caudal mínimo y el volumen útil.
          </p>
          <p>
            <strong className="text-foreground">Golpe de ariete.</strong> Celeridad por la fórmula de
            Allievi, tiempo de parada de la bomba por Mendiluce y sobrepresión de Michaud (cierre
            lento) o de Joukowsky (cierre rápido). Es una verificación de primer orden: no
            reemplaza un cálculo por el método de las características cuando hay puntos altos,
            separación de columna o protecciones (calderines, volantes, válvulas).
          </p>
          <p>
            <strong className="text-foreground">Balance hídrico de embalse.</strong> Continuidad
            pura en cada paso, sin tránsito de crecidas, con reglas de operación: primero se libera el
            caudal ambiental, después se suministra la demanda sin bajar del volumen muerto y lo que
            supera el volumen de vertido vierte en el mismo paso, sin laminación. La lluvia y la
            evaporación (de tanque, por un coeficiente) se aplican sobre el área del espejo en el
            volumen del inicio o en el volumen medio del paso, interpolada linealmente en la curva
            cota-área-volumen. El caudal ambiental por percentil usa los factores de la
            regionalización que se carguen; los que trae por defecto son de la subregión Sur /
            Sureste y hay que reemplazarlos para otra subregión. El aporte puede salir del modelo
            de Témez (mensual, con los parámetros que se carguen; Genta et al. 2001 como partida para
            Uruguay), que conviene validar contra caudales medidos o contra la regionalización. La
            sensibilidad a la demanda y la demanda firme suponen una demanda constante en todos los
            pasos.
          </p>
          <p>
            <strong className="text-foreground">Período de retorno de una tormenta.</strong> Las láminas
            máximas por duración salen de ventanas móviles sobre el hietograma a intervalo fijo, sin
            corregir el efecto del intervalo de registro. El TR se obtiene invirtiendo la IDF elegida:
            con Rodríguez Fontal (1980), la del P(3,10) del punto y, si se carga un área, la corrección
            areal CA; con una tabla, interpolando en la variable de Gumbel y en log-log entre
            duraciones; con máximos anuales, un ajuste de Gumbel por momentos, poco confiable para TR
            mayores que el doble del registro.
          </p>
          <p>
            <strong className="text-foreground">Amoníaco libre.</strong> Equilibrio NH₄⁺ ⇌ NH₃ con el pKa
            según temperatura de Emerson et al. (1975), válido entre 0 y 50 °C en agua dulce: no
            corrige por fuerza iónica, así que en agua salobre o de mar sobrestima la fracción libre.
            La fracción se aplica en moles; el resultado se da como NH₄⁺, NH₃ y N para compararlo con
            el límite en la misma forma en que lo expresa la norma.
          </p>
          <p>
            <strong className="text-foreground">Laguna facultativa, humedal vertical y desinfección.</strong>{" "}
            Dimensionamiento de prediseño. La laguna usa la carga superficial de von Sperling
            según la temperatura del mes más frío, flujo disperso (Wehner-Wilhelm) para DBO soluble y
            coliformes y expresiones empíricas para nitrógeno; el resultado depende de constantes
            cinéticas y coeficientes que conviene ajustar a la bibliografía o a datos locales. El
            humedal se dimensiona por carga hidráulica con remociones adoptadas, y el modelo P-k-C*
            sirve para verificar si esas remociones son alcanzables con el área. La cloración usa
            Chick-Watson con constantes que dependen mucho del efluente: la dosis final hay que
            ajustarla en planta midiendo el residual.
          </p>
        </div>
      </section>

      <p className="print:hidden">
        <Link href="/" className="text-sm underline underline-offset-2 hover:text-foreground">
          ← Volver al inicio
        </Link>
      </p>
    </main>
  );
}
