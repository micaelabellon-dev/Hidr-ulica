/**
 * Links de la sección Recursos. Para agregar uno, sumá un objeto al grupo que
 * corresponda (o un grupo nuevo): la página se arma sola.
 */

export interface Recurso {
  nombre: string;
  url: string;
  descripcion: string;
  /** Etiqueta corta opcional, p. ej. "Vigente" o "Sustituido". */
  etiqueta?: string;
}

export interface GrupoRecursos {
  titulo: string;
  descripcion: string;
  recursos: Recurso[];
}

export const GRUPOS_RECURSOS: GrupoRecursos[] = [
  {
    titulo: "Mapas e información geográfica",
    descripcion: "Visualizadores y capas para ubicar el predio, la cuenca, la hidrografía y las curvas de nivel.",
    recursos: [
      {
        nombre: "Visualizador IDEuy",
        url: "https://visualizador.ide.uy/",
        descripcion: "Infraestructura de Datos Espaciales del Uruguay: ortofotos, modelo digital de elevación, hidrografía y catastro.",
      },
      {
        nombre: "Geoservicios IDEuy",
        url: "https://www.gub.uy/infraestructura-datos-espaciales/geoservicios-ide",
        descripcion: "Direcciones WMS, WMTS y WFS para cargar las capas de IDE en QGIS o AutoCAD Map.",
      },
      {
        nombre: "Descargas IDEuy",
        url: "https://www.gub.uy/infraestructura-datos-espaciales/tramites-y-servicios/servicios/descargas",
        descripcion: "Descarga de ortoimágenes y modelos digitales de elevación y de superficie.",
      },
      {
        nombre: "Visualizador del OAN (Ministerio de Ambiente)",
        url: "https://www.ambiente.gub.uy/visualizador/",
        descripcion: "Visualizador de mapas del Observatorio Ambiental Nacional: capas ambientales, estaciones de monitoreo y carga de KML.",
      },
      {
        nombre: "Visualizadores de DINAGUA",
        url: "https://www.ambiente.gub.uy/informacion_hidrica/",
        descripcion: "Visualizadores geográficos de recursos hídricos: cuencas, estaciones hidrométricas, aprovechamientos y riesgo de inundación.",
      },
      {
        nombre: "MonteviMap",
        url: "https://sig.montevideo.gub.uy/",
        descripcion: "Sistema de información geográfica de la Intendencia de Montevideo: padrones, saneamiento, ordenamiento territorial.",
      },
    ],
  },
  {
    titulo: "Normativa",
    descripcion: "Textos actualizados en IMPO. Revisá siempre la vigencia y las modificaciones antes de citar un artículo.",
    recursos: [
      {
        nombre: "Decreto 226/025: calidad de aguas y vertidos",
        url: "https://www.impo.com.uy/bases/decretos/226-2025",
        descripcion: "Objetivos de calidad de los cuerpos de agua y condiciones para los vertidos; sustituye al Decreto 253/979.",
        etiqueta: "Vigente",
      },
      {
        nombre: "Decreto 253/979: control de las aguas",
        url: "https://www.impo.com.uy/bases/decretos/253-1979",
        descripcion: "Clasificación de cursos de agua y estándares de vertido históricos. Ver la nota de vigencia en IMPO.",
        etiqueta: "Sustituido",
      },
      {
        nombre: "Decreto 135/021: calidad del aire",
        url: "https://www.impo.com.uy/bases/decretos/135-2021",
        descripcion: "Objetivos de calidad de aire y límites de emisión, con sus modificaciones posteriores.",
        etiqueta: "Vigente",
      },
      {
        nombre: "Decreto 349/005: evaluación de impacto ambiental",
        url: "https://www.impo.com.uy/bases/decretos/349-2005",
        descripcion: "Reglamento de EIA y autorizaciones ambientales (AAP, AAO), con sus modificaciones.",
        etiqueta: "Vigente",
      },
      {
        nombre: "Ley 16.466: evaluación de impacto ambiental",
        url: "https://www.impo.com.uy/bases/leyes/16466-1994",
        descripcion: "Ley que crea el sistema de evaluación de impacto ambiental.",
      },
      {
        nombre: "Ley 17.283: protección del ambiente",
        url: "https://www.impo.com.uy/bases/leyes/17283-2000",
        descripcion: "Ley General de Protección del Ambiente.",
      },
      {
        nombre: "Código de Aguas (Ley 14.859)",
        url: "https://www.impo.com.uy/bases/codigo-aguas/14859-1978",
        descripcion: "Régimen de las aguas, derechos de uso, obras hidráulicas y embalses.",
      },
      {
        nombre: "Ley 18.610: Política Nacional de Aguas",
        url: "https://www.impo.com.uy/bases/leyes/18610-2009",
        descripcion: "Principios de la gestión de los recursos hídricos y gestión por cuencas.",
      },
    ],
  },
  {
    titulo: "DINAGUA y Observatorio Ambiental",
    descripcion: "Información hídrica oficial, guías y trámites del Ministerio de Ambiente.",
    recursos: [
      {
        nombre: "Observatorio Ambiental Nacional (OAN)",
        url: "https://www.ambiente.gub.uy/oan/",
        descripcion: "Indicadores, datos abiertos, geoportal de imágenes satelitales y visualizadores ambientales.",
      },
      {
        nombre: "Geoportal del OAN",
        url: "https://www.ambiente.gub.uy/oan/geoportal/",
        descripcion: "Catálogo de imágenes satelitales y productos derivados (floraciones algales, índices).",
      },
      {
        nombre: "Información hidrológica (DINAGUA)",
        url: "https://www.gub.uy/ministerio-ambiente/politicas-y-gestion/encontrar-informacion-hidrologica-uruguay",
        descripcion: "Dónde encontrar datos de caudales, niveles y estaciones hidrológicas de Uruguay.",
      },
      {
        nombre: "Atlas Nacional de Inundaciones y Drenaje Pluvial Urbano",
        url: "https://www.gub.uy/ministerio-ambiente/politicas-y-gestion/atlas-nacional-inundaciones-drenaje-pluvial-urbano-version-diciembre-2025",
        descripcion: "Riesgo de inundación por localidad y situación del drenaje pluvial urbano.",
      },
      {
        nombre: "Guía metodológica de caudales ambientales",
        url: "https://www.gub.uy/ministerio-ambiente/sites/ministerio-ambiente/files/2026-09/Gu%C3%ADa%20metodol%C3%B3gica%20de%20caudales%20ambientales_%2020260911_Publicaci%C3%B3n%20web.pdf",
        descripcion: "Guía de DINAGUA para fijar el caudal ambiental (PDF), útil para el balance de embalses.",
        etiqueta: "PDF",
      },
      {
        nombre: "Derecho de uso de aguas públicas",
        url: "https://www.gub.uy/ministerio-ambiente/politicas-y-gestion/proceso-solicitud-derecho-uso-aguas-publicas",
        descripcion: "Proceso de solicitud ante DINAGUA para tomas, pozos y embalses.",
      },
    ],
  },
  {
    titulo: "Organismos y datos",
    descripcion: "Donde buscar series, trámites y criterios oficiales.",
    recursos: [
      {
        nombre: "Ministerio de Ambiente",
        url: "https://www.gub.uy/ministerio-ambiente/",
        descripcion: "Portal del Ministerio: DINACEA, DINAGUA, autorizaciones ambientales y de vertido.",
      },
      {
        nombre: "Evaluación de impacto ambiental (Ambiente)",
        url: "https://www.gub.uy/ministerio-ambiente/politicas-y-gestion/evaluacion-impacto-ambiental",
        descripcion: "Guías y procedimiento de EIA del Ministerio.",
      },
      {
        nombre: "INUMET",
        url: "https://www.inumet.gub.uy/",
        descripcion: "Instituto Uruguayo de Meteorología: datos de precipitación, temperatura y evaporación.",
      },
      {
        nombre: "OSE",
        url: "https://www.ose.com.uy/",
        descripcion: "Obras Sanitarias del Estado: normas y especificaciones de agua potable y saneamiento.",
      },
    ],
  },
  {
    titulo: "Software",
    descripcion: "Programas que se usan junto con estas calculadoras.",
    recursos: [
      {
        nombre: "EPA SWMM",
        url: "https://www.epa.gov/water-research/storm-water-management-model-swmm",
        descripcion: "Modelo de drenaje pluvial: tránsito de los MCE y redes de pluviales.",
      },
      {
        nombre: "EPANET",
        url: "https://www.epa.gov/water-research/epanet",
        descripcion: "Redes de distribución de agua a presión.",
      },
      {
        nombre: "HEC-RAS",
        url: "https://www.hec.usace.army.mil/software/hec-ras/",
        descripcion: "Hidráulica de ríos y canales, remansos y planicies de inundación.",
      },
      {
        nombre: "HEC-HMS",
        url: "https://www.hec.usace.army.mil/software/hec-hms/",
        descripcion: "Modelación hidrológica de cuencas: lluvia-escorrentía.",
      },
      {
        nombre: "QGIS",
        url: "https://qgis.org/",
        descripcion: "SIG libre para delimitar cuencas y trabajar con las capas de IDE.",
      },
    ],
  },
];
