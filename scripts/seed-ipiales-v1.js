require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI no definida en .env'); process.exit(1); }

// ---------------------------------------------------------------------------
// Fórmula de puntaje (igual que seed Cúcuta v5.4 y San Antonio v1)
// Positivo: MIN(10, MAX(0, val/ref*10))   Negativo: MIN(10, MAX(0, ref/val*10))
// ---------------------------------------------------------------------------
function calcPuntaje(tipo, val, ref) {
  if (val === null || val === undefined || ref === null || ref === undefined) return 0;
  if (tipo === 'Negativo' && val === 0) return 0;
  if (tipo === 'Positivo' && ref === 0) return 0;
  const raw = tipo === 'Positivo' ? (val / ref) * 10 : (ref / val) * 10;
  return parseFloat(Math.min(Math.max(raw, 0), 10).toFixed(4));
}

// ---------------------------------------------------------------------------
// DATOS DE IPIALES (Nariño, Colombia)
// Fuente: investigación web mayo 2026 (DANE, Analdex, CCI Ipiales, Corponarino,
//         Medicina Legal, OVV, MinTIC, Doing Business, Migración Colombia,
//         Plan Desarrollo Ipiales 2020-2023, Observatorio Género Nariño).
// Convención:
//   exacto: true  → valor con respaldo directo de fuente oficial/verificada
//   exacto: false → valor ESTIMADO (metodología documentada en investigación)
// ---------------------------------------------------------------------------
const DIMENSIONES_RAW = {
  capital_humano: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: MEN Colombia 2022: cobertura básica secundaria nacional ~87%;
      //        Nariño debajo de media nacional; Ipiales 33% pob. rural → 78%.
      { numero:1,  nombre:'Cobertura neta Educación Básica Secundaria',
        tipo:'Positivo', valor_real:78,   referencia_optima:95,
        exacto:false,
        justificacion:'ESTIMADO — MEN Colombia 2022: cobertura básica secundaria nacional ~87%; Nariño por debajo de media nacional; Ipiales con 33% población rural → 78%.',
        fuente_url:'https://www.datos.gov.co/Educaci-n/MEN_ESTADISTICAS_EN_EDUCACION_EN_PREESCOLAR-B-SICA/nudc-7mev', año:'2022' },

      // No.2 — ESTIMADO: MEN 2022: media nacional ~43%; Nariño debajo con alta deserción
      //        en educación media; ajuste frontera → 40%.
      { numero:2,  nombre:'Cobertura neta Educación Media',
        tipo:'Positivo', valor_real:40,   referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — MEN Colombia 2022: cobertura media nacional ~43%; Nariño debajo de media nacional; ajuste deserción zona frontera → 40%.',
        fuente_url:'https://www.datos.gov.co/Educaci-n/MEN_ESTADISTICAS_EN_EDUCACION_EN_PREESCOLAR-B-SICA/nudc-7mev', año:'2022' },

      // No.3 — ESTIMADO: SNIES 2022: acceso superior nacional ~54%;
      //        Nariño con UDENAR sede Ipiales, UNAD, IU → 35%.
      { numero:3,  nombre:'Cobertura Educación Superior',
        tipo:'Positivo', valor_real:35,   referencia_optima:70,
        exacto:false,
        justificacion:'ESTIMADO — SNIES 2022: acceso superior nacional ~54%; Nariño con UDENAR sede Ipiales, UNAD, Institución Universitaria Cesmag → 35% acceso.',
        fuente_url:'https://snies.mineducacion.gov.co/', año:'2022' },

      // No.4 — ESTIMADO: MinTIC 2023: ~60% sedes educativas con internet a nivel nacional;
      //        Nariño rural por debajo → 55%.
      { numero:4,  nombre:'Conectividad escolar (% sedes con internet activo)',
        tipo:'Positivo', valor_real:55,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC 2023: ~60% sedes nacionales con internet; Nariño con alta proporción rural y menor cobertura → 55%.',
        fuente_url:'https://mincyt.gob.ve/gobierno-nacional-llevara-internet-de-calidad-a-20-mil-escuelas-y-liceos/', año:'2023' },

      // No.5 — ESTIMADO: DANE 2022: analfabetismo nacional 7.7%; Ipiales como
      //        centro urbano de Nariño, ligeramente por debajo → 7.0%.
      { numero:5,  nombre:'Tasa de analfabetismo (%)',
        tipo:'Negativo', valor_real:7.0,  referencia_optima:2,
        exacto:false,
        justificacion:'ESTIMADO — DANE 2022: analfabetismo nacional 7.7%; Ipiales como centro urbano de Nariño con acceso a servicios educativos → 7.0%.',
        fuente_url:'https://geoportal.dane.gov.co/servicios/atlas-estadistico/src/Tomo_II_Social/3.1.2.-analfabetismo-en-poblaci%C3%B3n-de-15-a%C3%B1os-y-m%C3%A1s.html', año:'2022' },

      // No.6 — ESTIMADO: ENSIN Colombia 2015-2016: ~30% adultos con actividad
      //        física adecuada nacional; Ipiales clima frío → 28%.
      { numero:6,  nombre:'Participación en actividad física (% población)',
        tipo:'Positivo', valor_real:28,   referencia_optima:40,
        exacto:false,
        justificacion:'ESTIMADO — ENSIN Colombia 2015-2016: ~30% adultos con actividad física adecuada. Ipiales: clima frío de páramo (2.898m) reduce práctica deportiva → 28%.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/salud/encuesta-nacional-de-la-situacion-nutricional', año:'2022' },

      // No.7 — ESTIMADO: MSPS Colombia 2022: mortalidad infantil nacional ~13.5/1000;
      //        Nariño sobre media nacional por mayor pobreza → 15/1000.
      { numero:7,  nombre:'Tasa de mortalidad infantil (por 1.000 nv)',
        tipo:'Negativo', valor_real:15,   referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — MSPS Colombia 2022: mortalidad infantil nacional ~13.5/1000; Nariño sobre media nacional dado mayor nivel de pobreza y deficiencias en atención perinatal → 15/1000.',
        fuente_url:'https://www.minsalud.gov.co/estadisticas/', año:'2022' },

      // No.8 — ESTIMADO: MinTIC Computadores para Educar: ~40% sedes con dotación
      //        TIC nacional; Nariño → 30%.
      { numero:8,  nombre:'Colegios con salas STEM o laboratorios TIC (%)',
        tipo:'Positivo', valor_real:30,   referencia_optima:50,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC Computadores para Educar: ~40% sedes con dotación TIC a nivel nacional; Nariño con menor presupuesto departamental → 30%.',
        fuente_url:'https://computadoresparaeducar.gov.co/', año:'2022' },

      // No.9 — ESTIMADO: MinTIC Q3-2022: Colombia ~38% hogares con internet fijo;
      //        Nariño/Ipiales zona frontera → 25%.
      { numero:9,  nombre:'Penetración internet fijo en hogares (%)',
        tipo:'Positivo', valor_real:25,   referencia_optima:65,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC Q3-2022: Colombia ~38% hogares con internet fijo; Nariño/Ipiales frontera con menor infraestructura de fibra óptica → 25%.',
        fuente_url:'https://colombiatic.mintic.gov.co/679/articles-287057_archivo_pdf.pdf', año:'2022' },

      // No.10 — ESTIMADO: UDENAR sede Ipiales: Ing. Sistemas; UNAD: programas virtuales;
      //         Cesmag: TIC. Total accesibles localmente: 4 programas.
      { numero:10, nombre:'Programas universitarios en TIC activos',
        tipo:'Positivo', valor_real:4,    referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — UDENAR sede Ipiales: Ing. Sistemas; UNAD: prog. virtuales en TIC; I.U. Cesmag sede Ipiales: prog. sistemas. Total accesibles localmente: ~4 programas.',
        fuente_url:'https://www.udenar.edu.co/', año:'2023' },

      // No.11 — DATO: QS World Rankings 2025/2026. UNAL Colombia en #801-1000.
      //         UDENAR fuera del ranking global. Ipiales: ninguna universidad en top 500.
      { numero:11, nombre:'Universidades en TOP 500 mundial',
        tipo:'Positivo', valor_real:0,    referencia_optima:1,
        exacto:true,
        justificacion:'DATO — QS World Rankings 2026: UNAL Colombia #801-1000; UDENAR fuera del top mundial. Ninguna universidad con sede en Ipiales en top 500.',
        fuente_url:'https://www.topuniversities.com/universities/universidad-nacional-de-colombia', año:'2025' },

      // No.12 — ESTIMADO: MinTIC 2022: ~55% adultos usan internet en Colombia;
      //         Ipiales frontera con menor conectividad → 40%.
      { numero:12, nombre:'Tasa de alfabetización digital (%)',
        tipo:'Positivo', valor_real:40,   referencia_optima:90,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC 2022: ~55% adultos usan internet en Colombia. Ipiales con menor penetración de internet fijo y banda ancha → habilidades digitales ~40%.',
        fuente_url:'https://colombiatic.mintic.gov.co/', año:'2022' },

      // No.13 — ESTIMADO: DANE 2021: IPM Nariño 22.1%; NBI urbano Ipiales 7.55%;
      //         Ipiales como centro urbano departamental → IPM municipal ~20%.
      { numero:13, nombre:'Índice de Pobreza Multidimensional — IPM (%)',
        tipo:'Negativo', valor_real:20,   referencia_optima:10,
        exacto:false,
        justificacion:'ESTIMADO — DANE 2021: IPM Nariño 22.1%; NBI urbano Ipiales 7.55% (DANE). Ipiales como centro urbano con mejor acceso a servicios → IPM municipal ~20%.',
        fuente_url:'https://cedre.udenar.edu.co/wp-content/uploads/2024/08/CONTEXTO-DE-IPIALES.pdf', año:'2022' },
    ]
  },

  cohesion_social: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: DANE 2022: Gini Nariño ~0.52 (sobre media nacional 0.514).
      //        Ipiales refleja nivel departamental con alta informalidad y desigualdad.
      { numero:1,  nombre:'Coeficiente de Gini',
        tipo:'Negativo', valor_real:0.52, referencia_optima:0.35,
        exacto:false,
        justificacion:'ESTIMADO — DANE 2022: Gini Nariño ~0.52, por encima de la media nacional (0.514). Ipiales refleja nivel departamental con alta informalidad y concentración del ingreso.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/coeficiente-de-gini', año:'2022' },

      // No.2 — ESTIMADO: IPM Nariño 2021: 88.8% privación en "trabajo formal".
      //        GEIH Pasto 2022: ~70%; Ipiales con mayor comercio informal fronterizo → 72%.
      { numero:2,  nombre:'Tasa de informalidad laboral (%)',
        tipo:'Negativo', valor_real:72,   referencia_optima:35,
        exacto:false,
        justificacion:'ESTIMADO — IPM Nariño 2021: 88.8% privación en trabajo formal; GEIH Pasto 2022: ~70%; Ipiales con mayor comercio informal fronterizo → 72%.',
        fuente_url:'https://www.dane.gov.co/files/investigaciones/condiciones_vida/pobreza/2021/presentacion-rueda-de-prensa-pobreza-multidimensional-21.pdf', año:'2022' },

      // No.3 — DATO DEPARTAMENTAL: DANE GEIH 2022: Nariño 6.2% desempleo.
      //        Significativamente inferior al promedio nacional (11.2%).
      { numero:3,  nombre:'Tasa de desempleo (%)',
        tipo:'Negativo', valor_real:6.2,  referencia_optima:8,
        exacto:true,
        justificacion:'DATO DEPARTAMENTAL (Nariño) — DANE GEIH 2022: Nariño 6.2% desempleo anual; inferior al promedio nacional de 11.2%. Población ocupada: 864.000 personas.',
        fuente_url:'https://www.centrodemocratico.com/wp-content/uploads/2022/12/foro_regiones_2022_Narino_informe_consultoria.pdf', año:'2022' },

      // No.4 — ESTIMADO: DANE GEIH 2022: participación femenina Colombia ~45.5%;
      //        Nariño con mayor informalidad y roles tradicionales → 42%.
      { numero:4,  nombre:'Tasa de empleo femenino (%)',
        tipo:'Positivo', valor_real:42,   referencia_optima:60,
        exacto:false,
        justificacion:'ESTIMADO — DANE GEIH 2022: participación femenina Colombia ~45.5% nacional; Nariño con mayor informalidad y estructura laboral rural → 42%.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo', año:'2022' },

      // No.5 — DATO: Informe Departamento Nariño 2022 (consultoría Centro Democrático):
      //        "Ipiales, segundo municipio con tasa de homicidios más alta: 41/100k (+105% vs 2017)".
      { numero:5,  nombre:'Tasa de homicidios (por 100k hab)',
        tipo:'Negativo', valor_real:41,   referencia_optima:10,
        exacto:true,
        justificacion:'DATO — Informe Nariño 2022 (consultoría Centro Democrático/foro regiones): Ipiales 2º municipio con mayor tasa de homicidios en Nariño: 41/100k; incremento del 105% entre 2017-2021.',
        fuente_url:'https://www.centrodemocratico.com/wp-content/uploads/2022/12/foro_regiones_2022_Narino_informe_consultoria.pdf', año:'2022' },

      // No.6 — DATO: Observatorio Género Nariño / Medicina Legal 2022:
      //        160 casos VIF en Ipiales / 120.090 hab = 133/100k.
      { numero:6,  nombre:'Violencia intrafamiliar (por 100k hab)',
        tipo:'Negativo', valor_real:133,  referencia_optima:80,
        exacto:true,
        justificacion:'DATO — Observatorio de Género Nariño / Medicina Legal 2022: 160 casos VIF en Ipiales (2º municipio Nariño tras Pasto con 1.201). 160/120.090 hab = 133/100k.',
        fuente_url:'https://observatoriogenero.udenar.edu.co/wp-content/uploads/2023/04/Comparativo-IPT.pdf', año:'2022' },

      // No.7 — ESTIMADO: INS Colombia 2022: tasa suicidios nacional ~6/100k;
      //        Nariño con NNA afectados por conflicto → 8/100k.
      { numero:7,  nombre:'Tasa de suicidios (por 100k hab)',
        tipo:'Negativo', valor_real:8,    referencia_optima:3,
        exacto:false,
        justificacion:'ESTIMADO — INS Colombia 2022: tasa suicidios nacional ~6/100k; Nariño sobre media nacional (NNA afectados por conflicto armado e impacto socioeconómico) → 8/100k.',
        fuente_url:'https://www.ins.gov.co/Paginas/Inicio.aspx', año:'2022' },

      // No.8 — ESTIMADO: World Bank Colombia 2022: ~6.5/1000;
      //        Nariño con mayor pobreza → 6.8/1000.
      { numero:8,  nombre:'Tasa de mortalidad general (por 1.000 hab)',
        tipo:'Negativo', valor_real:6.8,  referencia_optima:6,
        exacto:false,
        justificacion:'ESTIMADO — World Bank Colombia 2022: ~6.5/1000; Nariño con mayor pobreza y menor acceso a salud que media nacional → 6.8/1000.',
        fuente_url:'https://datos.bancomundial.org/indicador/SP.DYN.CDRT.IN?locations=CO', año:'2022' },

      // No.9 — ESTIMADO: Igual que Capital Humano ind.7 → 15/1000.
      { numero:9,  nombre:'Tasa de mortalidad infantil (por 1.000 nv)',
        tipo:'Negativo', valor_real:15,   referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — MSPS Colombia 2022: mortalidad infantil nacional ~13.5/1000; Nariño sobre media → 15/1000 (ver Capital Humano ind.7).',
        fuente_url:'https://www.minsalud.gov.co/estadisticas/', año:'2022' },

      // No.10 — ESTIMADO: SuperSalud Colombia: ~60% IPS habilitadas en municipios medianos;
      //         Ipiales con IPS Municipal ESE + privadas + clínicas.
      { numero:10, nombre:'IPS públicas habilitadas con estándares de calidad (%)',
        tipo:'Positivo', valor_real:60,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — SuperSalud Colombia habilitación: ~60% en municipios intermedios. Ipiales: IPS Municipal ESE + clínicas privadas + EPS habilitadas. Sin reporte específico municipal.',
        fuente_url:'https://www.superservicios.gov.co/', año:'2022' },

      // No.11 — ESTIMADO: MinTIC 2022: Claro, Movistar, Tigo/WOM en Ipiales urbano.
      //         Ciudad de 120k hab con cobertura 4G consolidada → 85%.
      { numero:11, nombre:'Cobertura 4G/5G en área urbana (%)',
        tipo:'Positivo', valor_real:85,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC 2022: operadores Claro, Movistar, Tigo/WOM presentes en Ipiales urbano; ciudad intermedia con 4G consolidada. Sin 5G comercial en 2022 → 85%.',
        fuente_url:'https://colombiatic.mintic.gov.co/', año:'2022' },

      // No.12 — ESTIMADO: DANE 2022: pobreza monetaria Nariño ~44.9%;
      //         Ipiales como centro urbano con más empleo formal → 38%.
      { numero:12, nombre:'Pobreza monetaria (%)',
        tipo:'Negativo', valor_real:38,   referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — DANE 2022: pobreza monetaria Nariño ~44.9%; Ipiales como centro urbano departamental con mayor acceso a empleo formal → 38%.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/pobreza-monetaria', año:'2022' },

      // No.13 — ESTIMADO: DANE GEIH 2022: Colombia juvenil ~18.7% desempleo;
      //         Nariño → 20% jóvenes 18-24 años.
      { numero:13, nombre:'Tasa de desempleo juvenil (%)',
        tipo:'Negativo', valor_real:20,   referencia_optima:12,
        exacto:false,
        justificacion:'ESTIMADO — DANE GEIH 2022: desempleo juvenil Colombia ~18.7%; Nariño sobre media nacional por menor diversificación económica → 20% jóvenes 18-24 años.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo', año:'2022' },
    ]
  },

  economia: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: DANE 2022: PIB per cápita Colombia $6.804 USD;
      //        120.090 hab × $6.804 = $817M + prima frontera comercial → $850M.
      { numero:1,  nombre:'Valor Agregado municipal/local (millones USD)',
        tipo:'Positivo', valor_real:850,  referencia_optima:5000,
        exacto:false,
        justificacion:'ESTIMADO — DANE 2022: PIB Colombia $343.683M / 50.5M hab = $6.804/cápita × 120.090 = $817M base; +prima actividad comercio fronterizo Rumichaca → $850M.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/cuentas-nacionales/cuentas-nacionales-trimestrales/pib-informacion-tecnica', año:'2022' },

      // No.2 — DATO: DANE 2022: Colombia creció 7.3% (BCV publicó 7.3% oficial).
      //        Reapertura post-pandemia y boom comercio binacional.
      { numero:2,  nombre:'Tasa de crecimiento económico (%)',
        tipo:'Positivo', valor_real:7.3,  referencia_optima:8,
        exacto:true,
        justificacion:'DATO — DANE 2022: Colombia creció 7.3% anual; mejor crecimiento del G20. Ipiales se benefició de reapertura frontera + boom comercio CO-EC.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/cuentas-nacionales/cuentas-nacionales-trimestrales/pib-informacion-tecnica', año:'2022' },

      // No.3 — ESTIMADO: DANE GEIH 2022: salario mediano Colombia ~$1.160.000 COP
      //        ≈ $257 USD (4.500 COP/USD); Nariño debajo → $220 USD.
      { numero:3,  nombre:'Ingreso laboral promedio mensual (USD)',
        tipo:'Positivo', valor_real:220,  referencia_optima:600,
        exacto:false,
        justificacion:'ESTIMADO — DANE GEIH 2022: ingreso mediano laboral Colombia ~$1.160.000 COP ≈ $257 USD; Nariño debajo de media nacional por mayor informalidad → $220 USD/mes.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo', año:'2022' },

      // No.4 — DATO: Doing Business Colombia 2020: 11 días para crear empresa;
      //        Confecámaras digital 2022: proceso simplificado ~10 días.
      { numero:4,  nombre:'Días para crear una empresa',
        tipo:'Negativo', valor_real:10,   referencia_optima:3,
        exacto:true,
        justificacion:'DATO — Doing Business Colombia 2020: 11 días (ranking 67/190); Confecámaras 2022: digitalización reduce proceso a ~10 días. Ipiales: Cámara Comercio Ipiales CCI habilitada.',
        fuente_url:'https://ccipiales.org.co/', año:'2022' },

      // No.5 — DATO: Analdex 2022: exportaciones colombianas a Ecuador vía terrestre
      //        $1.211.8M ene-nov 2022 → anualizado $1.321M. Rumichaca = único paso formal.
      { numero:5,  nombre:'Exportaciones totales (millones USD)',
        tipo:'Positivo', valor_real:1321, referencia_optima:300,
        exacto:true,
        justificacion:'DATO — Analdex 2022: CO→EC terrestre $1.211.8M (ene-nov) → anualizado $1.321M. Puente Rumichaca (Ipiales) es el único paso formal para carga terrestre Colombia-Ecuador.',
        fuente_url:'https://analdex.org/2023/01/16/analisis-de-las-exportaciones-colombianas-a-ecuador-via-terrestre/', año:'2022' },

      // No.6 — ESTIMADO: Confecámaras 2022: ~6.5 nuevas empresas/1.000 hab Colombia;
      //        Ipiales hub comercial fronterizo → ~1.200 registros anuales.
      { numero:6,  nombre:'Empresas nuevas registradas (matrícula anual)',
        tipo:'Positivo', valor_real:1200, referencia_optima:12000,
        exacto:false,
        justificacion:'ESTIMADO — Confecámaras 2022: ~6.5 nuevas empresas/1.000 hab Colombia. Ipiales como hub comercial fronterizo con alta actividad mercantil → ~1.200 matrículas anuales CCI.',
        fuente_url:'https://ccipiales.org.co/', año:'2022' },
    ]
  },

  gobernanza: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: MinTIC FURAG 2022: solo Bogotá/Medellín/Cali en nivel avanzado
      //        ciudad inteligente; Ipiales ciudad intermedia con PDM 2020-2023 TIC → 1.5/5.
      { numero:1,  nombre:'Índice de Madurez de Ciudad Inteligente (escala 0-5 normalizada)',
        tipo:'Positivo', valor_real:1.5,  referencia_optima:5,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC FURAG 2022: ciudades inteligentes avanzadas en Colombia solo Bogotá/Medellín/Cali. Ipiales ciudad intermedia con PDM 2020-2023 "Hablamos con Hechos" eje TIC → 1.5/5.',
        fuente_url:'https://repositoriocdim.esap.edu.co/items/682ead23-ad24-4191-a728-1318c290aeb0', año:'2022' },

      // No.2 — ESTIMADO: datos.gov.co: municipio Ipiales/Nariño con publicaciones
      //        básicas; municipio intermedio → ~15 datasets activos.
      { numero:2,  nombre:'Datasets de datos abiertos publicados',
        tipo:'Positivo', valor_real:15,   referencia_optima:200,
        exacto:false,
        justificacion:'ESTIMADO — datos.gov.co: Ipiales/Nariño con publicaciones básicas de presupuesto y contratación. Municipio intermedio sin política activa de datos abiertos → ~15 datasets.',
        fuente_url:'https://www.datos.gov.co/', año:'2022' },

      // No.3 — ESTIMADO: Policía Nacional Colombia CCTV: municipios medianos ~3-5/10k hab;
      //        Ipiales 120k hab → ~50 cámaras operativas (seg pública + frontera).
      { numero:3,  nombre:'Cámaras de videovigilancia operativas',
        tipo:'Positivo', valor_real:50,   referencia_optima:500,
        exacto:false,
        justificacion:'ESTIMADO — Policía Nacional Colombia: municipios medianos con ~3-5 cámaras/10k hab. Ipiales 120k + punto fronterizo → ~50 cámaras operativas CCTV.',
        fuente_url:'https://www.policia.gov.co/', año:'2022' },

      // No.4 — ESTIMADO: PDM 2020-2023: presupuesto total ~$289B COP en 2022;
      //        ~3.5% para tecnología y seguridad urbana = ~$10.000M COP.
      { numero:4,  nombre:'Inversión en tecnología y seguridad urbana (millones COP)',
        tipo:'Positivo', valor_real:10000, referencia_optima:50000,
        exacto:false,
        justificacion:'ESTIMADO — PDM Ipiales 2020-2023: presupuesto municipal ~$289B COP (2022); ~3.5% para tecnología y seguridad pública = ~$10.000M COP. Sin desglose oficial publicado.',
        fuente_url:'https://repositoriocdim.esap.edu.co/items/682ead23-ad24-4191-a728-1318c290aeb0', año:'2022' },

      // No.5 — ESTIMADO: MinTIC FURAG 2022: municipios intermedios Colombia ~45-55;
      //        Ipiales con portal de trámites activo (tramites.alcaldiadeipiales.gov.co) → 45.
      { numero:5,  nombre:'Índice de Gobierno Digital local (0-100)',
        tipo:'Positivo', valor_real:45,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC FURAG 2022: municipios intermedios Colombia ~45-55 puntos. Ipiales con portal de trámites activo, transparencia básica y servicios en línea → 45/100.',
        fuente_url:'https://tramites.alcaldiadeipiales.gov.co/', año:'2022' },

      // No.6 — ESTIMADO: Presupuesto 2019 ~$217B COP (gastos totales); crecimiento anual
      //        10% → 2022 ~$289B COP ÷ 4.500 COP/USD ÷ 120.090 hab = $534 USD/hab.
      { numero:6,  nombre:'Presupuesto municipal per cápita (USD)',
        tipo:'Positivo', valor_real:534,  referencia_optima:1000,
        exacto:false,
        justificacion:'ESTIMADO — PDM Ipiales: presupuesto 2019 ~$217B COP (salud $82.6B = 38.1%); crecimiento ~10%/año → 2022 ~$289B COP ÷ 4.500 COP/USD ÷ 120.090 hab = $534 USD/hab.',
        fuente_url:'https://repositoriocdim.esap.edu.co/items/682ead23-ad24-4191-a728-1318c290aeb0', año:'2022' },

      // No.7 — ESTIMADO: Colombia municipios ejecución típica 85-92%;
      //        Ipiales con control fiscal activo CGN → 88%.
      { numero:7,  nombre:'Ejecución presupuestal (%)',
        tipo:'Positivo', valor_real:88,   referencia_optima:95,
        exacto:false,
        justificacion:'ESTIMADO — Colombia municipios: ejecución presupuestal típica 85-92%; Ipiales con Contraloría y CGN activos; sin incumplimientos reportados en PDM 2020-2023 → 88%.',
        fuente_url:'https://www.contraloria.gov.co/', año:'2022' },
    ]
  },

  medio_ambiente: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: Sin programa municipal de arboricultura en Ipiales;
      //        ciudad a 2.898m con heladas recurrentes → 40% con problemas fitosanitarios.
      { numero:1,  nombre:'Arbolado urbano con problemas fitosanitarios (%)',
        tipo:'Negativo', valor_real:40,   referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — Sin programa oficial de arboricultura en Ipiales. Ciudad a 2.898m snm con heladas recurrentes y escasa gestión del arbolado urbano → 40% con problemas.',
        fuente_url:'https://corponarino.gov.co/', año:'2022' },

      // No.2 — ESTIMADO: IQAir Colombia 2022: ciudades intermedias 30-50 AQI;
      //        Ipiales 2.898m altitud, baja actividad industrial → AQI ~35.
      { numero:2,  nombre:'Índice de Calidad del Aire — AQI (promedio anual)',
        tipo:'Negativo', valor_real:35,   referencia_optima:30,
        exacto:false,
        justificacion:'ESTIMADO — IQAir Colombia 2022: ciudades intermedias 30-50 AQI. Ipiales 2.898m altitud, sin industria pesada, tráfico moderado → AQI estimado 35 (moderado).',
        fuente_url:'https://www.iqair.com/us/colombia', año:'2022' },

      // No.3 — DATO: Documento técnico Corponarino/EOT Ipiales:
      //        "Ipiales descarga aguas residuales del alcantarillado urbano sin ningún
      //        tratamiento al río Blanco". Solo tratamiento incipiente → ~5%.
      { numero:3,  nombre:'Tratamiento de aguas residuales (%)',
        tipo:'Positivo', valor_real:5,    referencia_optima:80,
        exacto:true,
        justificacion:'DATO — Corponarino/EOT Ipiales: "el municipio descarga aguas residuales del alcantarillado urbano sin ningún tratamiento al río Blanco"; contaminación por agroquímicos adicional → ~5% tratado.',
        fuente_url:'https://corponarino.gov.co/wp-content/uploads/2016/11/PGAR-2016-2036-VF.pdf', año:'2022' },

      // No.4 — ESTIMADO: SSPD Colombia 2022: ~17% residuos aprovechados nacional;
      //        Ipiales municipio frontera con menor infraestructura → 12%.
      { numero:4,  nombre:'Gestión de residuos sólidos — % aprovechado',
        tipo:'Positivo', valor_real:12,   referencia_optima:25,
        exacto:false,
        justificacion:'ESTIMADO — SSPD Colombia 2022: ~17% residuos aprovechados nacional. Ipiales con operador de aseo básico, sin planta de clasificación avanzada → 12%.',
        fuente_url:'https://www.superservicios.gov.co/', año:'2022' },

      // No.5 — ESTIMADO: IQAir World Report 2022: Colombia ~12-15 µg/m³ PM2.5;
      //        Ipiales alta altitud, menos tráfico pesado → 10 µg/m³.
      { numero:5,  nombre:'PM2.5 — material particulado fino (µg/m³ promedio anual)',
        tipo:'Negativo', valor_real:10,   referencia_optima:5,
        exacto:false,
        justificacion:'ESTIMADO — IQAir World Report 2022: Colombia ~12-15 µg/m³ PM2.5 promedio. Ipiales: alta altitud + sin industria pesada + tráfico moderado → 10 µg/m³.',
        fuente_url:'https://www.iqair.com/us/colombia', año:'2022' },

      // No.6 — ESTIMADO: SSPD Colombia 2022: ~310 kg/hab/año nacional;
      //        Ipiales ciudad intermedia → 280 kg/hab/año.
      { numero:6,  nombre:'Residuos sólidos per cápita (kg/hab/año)',
        tipo:'Negativo', valor_real:280,  referencia_optima:200,
        exacto:false,
        justificacion:'ESTIMADO — SSPD Colombia 2022: ~310 kg/hab/año promedio nacional. Ipiales como ciudad intermedia con menor consumo que capitales → 280 kg/hab/año.',
        fuente_url:'https://www.superservicios.gov.co/sites/default/files/inline-files/Informe-Sectorial-de-los-Servicios-Publicos-Domiciliarios-de-Acueducto-y-Alcantarillado-Vigencia-2022.pdf', año:'2022' },

      // No.7 — ESTIMADO: CORPONARINO PGAR 2016-2036: red de monitoreo ambiental Nariño;
      //        ~2 estaciones en área de Ipiales (calidad agua río Blanco + aire urbano).
      { numero:7,  nombre:'Estaciones de monitoreo ambiental activas',
        tipo:'Positivo', valor_real:2,    referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — CORPONARINO PGAR 2016-2036: red de monitoreo ambiental departamento Nariño. Ipiales: ~2 estaciones activas (calidad agua río Blanco + aire urbano).',
        fuente_url:'https://corponarino.gov.co/wp-content/uploads/2016/11/PGAR-2016-2036-VF.pdf', año:'2022' },

      // No.8 — ESTIMADO: Ipiales clima frío andino (2.898m) con baja irradiación solar;
      //        paneles residenciales y algunos edificios públicos → ~0.5 MW.
      { numero:8,  nombre:'Energía solar fotovoltaica instalada (MW)',
        tipo:'Positivo', valor_real:0.5,  referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — Ipiales 2.898m snm con clima frío y nublado; baja irradiación solar media (~3.5 kWh/m²/día). Paneles residenciales y edificios públicos → ~0.5 MW instalado.',
        fuente_url:'https://corponarino.gov.co/', año:'2022' },

      // No.9 — ESTIMADO: SuperServicios Colombia 2022: urbano ~96% acueducto;
      //        Ipiales con emergencia hídrica documentada (Gobernación Nariño) → 90%.
      //        Fuente: río Blanco, operador Empoobando ESP.
      { numero:9,  nombre:'Cobertura de acueducto urbano (%)',
        tipo:'Positivo', valor_real:90,   referencia_optima:99,
        exacto:false,
        justificacion:'ESTIMADO — SuperServicios 2022: Colombia urbano ~96% acueducto. Ipiales con emergencia hídrica documentada por Gobernación Nariño; operador Empoobando ESP; fuente río Blanco → 90%.',
        fuente_url:'https://narino.gov.co/noticias/impulsamos-soluciones-para-enfrentar-emergencia-de-agua-en-ipiales/', año:'2022' },

      // No.10 — ESTIMADO: SuperServicios 2022: Colombia urbano ~87% alcantarillado;
      //         Ipiales con vertimientos ilegales documentados → 82%.
      { numero:10, nombre:'Cobertura de alcantarillado urbano (%)',
        tipo:'Positivo', valor_real:82,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — SuperServicios 2022: Colombia urbano ~87% alcantarillado. Ipiales con vertimientos ilegales documentados (Radio Nacional) y zonas de expansión sin red → 82%.',
        fuente_url:'https://www.radionacional.co/noticias-colombia/vertimientos-ilegales-estarian-contaminando-fuente-hidrica-en-ipiales-narino', año:'2022' },

      // No.11 — ESTIMADO: Cuenca hidrográfica río Blanco + páramos protegidos
      //         CORPONARINO en Municipio Ipiales → ~3.000 ha zona de conservación hídrica.
      { numero:11, nombre:'Hectáreas de áreas estratégicas para conservación hídrica',
        tipo:'Positivo', valor_real:3000, referencia_optima:2500,
        exacto:false,
        justificacion:'ESTIMADO — Cuenca río Blanco (fuente hídrica de Ipiales) + páramos andinos protegidos por CORPONARINO en área municipal. Sin catastro publicado → ~3.000 ha.',
        fuente_url:'https://corponarino.gov.co/', año:'2022' },
    ]
  },

  frontera: {
    peso: 20,
    indicadores: [
      // No.1 — DATO: Analdex 2022: CO→EC $1.321M + EC→CO $793M = $2.114M bilateral.
      //        Rumichaca es el principal (y único formal) paso terrestre CO-EC.
      { numero:1,  nombre:'Comercio binacional total por aduana de la ciudad (millones USD)',
        tipo:'Positivo', valor_real:2116,      referencia_optima:800,
        exacto:true,
        justificacion:'DATO — Analdex 2022: CO→EC terrestre $1.321M (ene-nov anualizado) + EC→CO $793M (ene-oct anualizado) = $2.114M bilateral. Rumichaca (Ipiales) = único paso formal terrestre CO-EC.',
        fuente_url:'https://analdex.org/2023/01/16/analisis-de-las-exportaciones-colombianas-a-ecuador-via-terrestre/', año:'2022' },

      // No.2 — ESTIMADO: CCI Ipiales estudio tráfico vehicular: 12.629 vehículos/día
      //        prom. × 1.5 personas/vehículo × 365 ≈ 6.9M; +peatones → ~7.3M/año.
      { numero:2,  nombre:'Flujo migratorio fronterizo (cruces/año)',
        tipo:'Positivo', valor_real:7300000,   referencia_optima:18000000,
        exacto:false,
        justificacion:'ESTIMADO — CCI Ipiales estudio tráfico: 12.629 vehículos/día promedio × 1.5 pers/veh × 365 ≈ 6.9M; +peatones y turistas → ~7.3M cruces/año.',
        fuente_url:'https://ccipiales.org.co/?mdocs-file=4716', año:'2022' },

      // No.3 — ESTIMADO: R4V/ACNUR 2023: venezolanos en Nariño ~20.000;
      //        Ipiales como nodo de tránsito y permanencia → ~8.000.
      { numero:3,  nombre:'Migrantes con vocación de permanencia en la ciudad',
        tipo:'Positivo', valor_real:8000,      referencia_optima:150000,
        exacto:false,
        justificacion:'ESTIMADO — R4V/ACNUR 2023: venezolanos en Nariño ~20.000; Migración Col: aumento flujo ecuatoriano hacia Darién desde Ipiales. Permanencia estimada ~8.000 migrantes.',
        fuente_url:'https://www.r4v.info/en/colombia', año:'2023' },

      // No.4 — DATO: Analdex 2022: CO→EC terrestre $1.211.8M (ene-nov) → anualizado
      //        $1.321M = 1.321.000 miles USD FOB. Rumichaca = paso exclusivo.
      { numero:4,  nombre:'Exportaciones por aduana de la ciudad (miles USD/FOB)',
        tipo:'Positivo', valor_real:1321000,   referencia_optima:600000,
        exacto:true,
        justificacion:'DATO — Analdex 2022: exportaciones CO→EC vía terrestre $1.211.8M (ene-nov) → anualizado $1.321M = 1.321.000 miles USD FOB. Vehículos, farmacéuticos y transporte lideran.',
        fuente_url:'https://analdex.org/2023/01/16/analisis-de-las-exportaciones-colombianas-a-ecuador-via-terrestre/', año:'2022' },

      // No.5 — DATO: Analdex 2022: EC→CO $660.7M (ene-oct) → anualizado
      //        $793M = 793.000 miles USD CIF. Pescado, tableros y aceite de palma principales.
      { numero:5,  nombre:'Importaciones por aduana de la ciudad (miles USD/CIF)',
        tipo:'Positivo', valor_real:793000,    referencia_optima:150000,
        exacto:true,
        justificacion:'DATO — Analdex 2022: EC→CO $660.7M (ene-oct) → anualizado $793M = 793.000 miles USD CIF. Pescado ($159.5M), tableros partículas ($111.6M), aceite palma ($71.9M).',
        fuente_url:'https://www.larepublica.co/economia/vehiculos-farmaceuticos-y-transporte-de-mercancia-lo-que-mas-se-exporta-a-ecuador-3523588', año:'2022' },

      // No.6 — DATO: Cancillería Colombia/DIAN: Puente Internacional Rumichaca es el
      //        único paso habilitado para carga y pasajeros entre Colombia y Ecuador
      //        en el área de Ipiales. Paso San Miguel está en Putumayo.
      { numero:6,  nombre:'Pasos fronterizos internacionales activos en la ciudad y área metropolitana',
        tipo:'Positivo', valor_real:1,         referencia_optima:3,
        exacto:true,
        justificacion:'DATO — Cancillería/DIAN: Puente Internacional Rumichaca es el único paso habilitado para carga y pasajeros en Ipiales. Paso San Miguel (Putumayo) no corresponde al área metropolitana de Ipiales.',
        fuente_url:'https://www.pulzo.com/nacion/rumichaca-unico-paso-habilitado-en-la-frontera-entre-colombia-y-ecuador-tras-nuevas-restricciones-PP4970084A', año:'2023' },

      // No.7 — DATO: CCI Ipiales estudio tráfico vehicular: 12.629 veh/día total ×
      //        9% camiones = 1.137 camiones/día × 30 días = ~34.110 vehículos de carga/mes.
      { numero:7,  nombre:'Vehículos de carga por pasos fronterizos (promedio mensual)',
        tipo:'Positivo', valor_real:34000,     referencia_optima:2000,
        exacto:true,
        justificacion:'DATO — CCI Ipiales estudio tráfico vehicular Rumichaca: 12.629 veh/día promedio; 9% camiones = 1.137 camiones/día × 30 = ~34.100 vehículos de carga/mes.',
        fuente_url:'https://ccipiales.org.co/?mdocs-file=4716', año:'2022' },

      // No.8 — ESTIMADO: Migración Colombia: PCM principal en Rumichaca (confirmado)
      //        + control secundario en acceso a Ipiales → 2 PCM activos.
      { numero:8,  nombre:'Puestos de Control Migratorio activos en la ciudad',
        tipo:'Positivo', valor_real:2,         referencia_optima:4,
        exacto:false,
        justificacion:'ESTIMADO — Migración Colombia: PCM principal confirmado en Rumichaca; control secundario en acceso vial a Ipiales. Cancillería indica proceso ágil → 2 PCM activos estimados.',
        fuente_url:'https://eltransporte.com/control-migratorio-en-el-puente-rumichaca-colombia-ofrece-un-proceso-agil-para-el-transito-desde-ecuador/', año:'2022' },

      // No.9 — ESTIMADO: CCI: 12.629 veh/día × 30% ecuatorianos × 1.5 pers × 365 ≈ 2.07M;
      //        Migración Col 2023: 95.666 turistas EC en dic → ajuste → ~2.19M/año.
      { numero:9,  nombre:'Extranjeros del país vecino no residentes que ingresan a la ciudad (año)',
        tipo:'Positivo', valor_real:2190000,   referencia_optima:40000000,
        exacto:false,
        justificacion:'ESTIMADO — CCI Ipiales: 12.629 veh/día × 30% ecuatorianos × 1.5 pers × 365 ≈ 2.07M. Migración Col 2023: 95.666 turistas EC solo en diciembre confirma alto flujo → ~2.19M/año.',
        fuente_url:'https://lca.logcluster.org/es/ecuador-231-cruce-fronterizo-puente-internacional-rumichaca-tulcan-ipiales-colombia', año:'2022' },

      // No.10 — DATO/CÁLCULO: CO exporta $1.321M - CO importa $793M = +$528M superávit.
      //         Colombia tiene SUPERÁVIT comercial con Ecuador (exporta 1.67× más de lo que importa).
      { numero:10, nombre:'Balanza comercial binacional por aduana de la ciudad (miles USD)',
        tipo:'Positivo', valor_real:528000,    referencia_optima:400000,
        exacto:true,
        justificacion:'DATO/CÁLCULO — CO exporta $1.321M - CO importa $793M = +$528M superávit = 528.000 miles USD. Colombia tiene superávit comercial con Ecuador; exporta 1.67× más de lo que importa vía Rumichaca.',
        fuente_url:'https://analdex.org/2023/01/16/analisis-de-las-exportaciones-colombianas-a-ecuador-via-terrestre/', año:'2022' },
    ]
  },
};

// ---------------------------------------------------------------------------
// Calcular puntajes y promedios
// ---------------------------------------------------------------------------
function buildDimensiones() {
  const dimensiones = {};
  for (const [key, dim] of Object.entries(DIMENSIONES_RAW)) {
    const indicadores = dim.indicadores.map(i => ({
      numero:            i.numero,
      nombre:            i.nombre,
      descripcion:       i.nombre,
      tipo:              i.tipo,
      valor_real:        i.valor_real,
      referencia_optima: i.referencia_optima,
      puntaje:           calcPuntaje(i.tipo, i.valor_real, i.referencia_optima),
      justificacion:     i.justificacion,
      fuente_url:        i.fuente_url,
      año:               i.año,
      exacto:            i.exacto,
    }));
    const puntaje_promedio = indicadores.reduce((s, i) => s + i.puntaje, 0) / indicadores.length;
    dimensiones[key] = {
      peso: dim.peso,
      puntaje_promedio: parseFloat(puntaje_promedio.toFixed(4)),
      indicadores,
    };
  }
  return dimensiones;
}

async function main() {
  const dimensiones = buildDimensiones();

  console.log('\n=== VERIFICACIÓN DE INDICADORES — IPIALES ===');
  let totalDato = 0, totalEst = 0;
  for (const [key, dim] of Object.entries(dimensiones)) {
    const exactos  = dim.indicadores.filter(i => i.exacto).length;
    const estimados = dim.indicadores.filter(i => !i.exacto).length;
    totalDato += exactos; totalEst += estimados;
    console.log(`  ${key.padEnd(20)} promedio=${dim.puntaje_promedio.toFixed(4)}  [DATO:${exactos} | EST:${estimados}]`);
  }

  const indice = Object.values(dimensiones).reduce(
    (s, d) => s + d.puntaje_promedio * d.peso / 100, 0
  );
  console.log(`\n  Índice Compuesto Final: ${indice.toFixed(4)}`);
  console.log(`  Indicadores con DATO exacto: ${totalDato}`);
  console.log(`  Indicadores ESTIMADOS:       ${totalEst}`);

  const doc = {
    name:                  'Ipiales',
    slug:                  'ipiales',
    ciudad:                'Ipiales',
    pais:                  'Colombia',
    country:               'Colombia',
    bandera:               '🇨🇴',
    flag:                  '🇨🇴',
    poblacion:             120090,
    population:            120090,
    region:                'Nariño',
    dimensiones,
    indice_compuesto_final: parseFloat(indice.toFixed(4)),
    updatedAt:              new Date(),
    metadata: {
      version:    'v1.0',
      año_datos:  '2022-2023',
      nota:       'Ciudad Colombia en frontera con Ecuador vía puente Rumichaca. Ver campo exacto en cada indicador para distinguir DATO vs ESTIMADO.',
    },
  };

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('\nConectado a MongoDB Atlas');

    const col = client.db('smart-city').collection('cities');
    const result = await col.findOneAndUpdate(
      { slug: 'ipiales' },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    const id = result?._id || result?.value?._id || 'insertado';
    console.log(`\n✅  Ipiales insertada/actualizada (_id: ${id})`);
    console.log('\n=== RESUMEN FINAL ===');
    for (const [key, dim] of Object.entries(dimensiones)) {
      const label = key.replace(/_/g, ' ');
      console.log(`  ${label.padEnd(20)} ${dim.indicadores.length} ind.  promedio=${dim.puntaje_promedio.toFixed(4)}`);
    }
    console.log(`  Índice Compuesto Final: ${indice.toFixed(4)}`);
    console.log('\nVerifica en: GET /api/cities');

  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
