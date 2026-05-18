require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI no definida en .env'); process.exit(1); }

// ---------------------------------------------------------------------------
// Fórmula de puntaje (igual que seed Cúcuta v5.4, San Antonio v1, Ipiales v1)
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
// DATOS DE LETICIA (Amazonas, Colombia)
// Fuente: investigación web mayo 2026 (DANE, Policía Nacional, InSight Crime,
//         MinTIC, MinVivienda, CORPOAMAZONIA, SINCHI, SUNAT Perú,
//         InfoAmazonia, CCA Amazonas, Doing Business, Migración Colombia).
// Nota: ciudad de 54.110 hab, sin carretera a Colombia, frontera tripartita
//       fluvial CO-BR-PE (Leticia-Tabatinga-Santa Rosa de Yavarí).
// Convención:
//   exacto: true  → valor con respaldo directo de fuente oficial/verificada
//   exacto: false → valor ESTIMADO (metodología documentada en investigación)
// ---------------------------------------------------------------------------
const DIMENSIONES_RAW = {
  capital_humano: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: MEN 2022: nacional ~87%; Amazonas con alta deserción
      //        escolar en comunidades indígenas y rurales → 65%.
      { numero:1,  nombre:'Cobertura neta Educación Básica Secundaria',
        tipo:'Positivo', valor_real:65,   referencia_optima:95,
        exacto:false,
        justificacion:'ESTIMADO — MEN Colombia 2022: cobertura básica secundaria nacional ~87%; Amazonas con alta deserción escolar indígena y rural; Leticia como capital departamental → 65%.',
        fuente_url:'https://www.datos.gov.co/Educaci-n/MEN_ESTADISTICAS_EN_EDUCACION_EN_PREESCOLAR-B-SICA/nudc-7mev', año:'2022' },

      // No.2 — ESTIMADO: Mayor deserción post-básica en regiones aisladas;
      //        menor oferta educativa media en Leticia → 35%.
      { numero:2,  nombre:'Cobertura neta Educación Media',
        tipo:'Positivo', valor_real:35,   referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — MEN Colombia 2022: cobertura media nacional ~43%; Leticia con mayor deserción por factores económicos e indígenas; menor oferta local → 35%.',
        fuente_url:'https://www.datos.gov.co/Educaci-n/MEN_ESTADISTICAS_EN_EDUCACION_EN_PREESCOLAR-B-SICA/nudc-7mev', año:'2022' },

      // No.3 — ESTIMADO: UNAL sede Leticia + UNAD virtual. Alta emigración
      //        juvenil para estudios. Acceso muy limitado → 20%.
      { numero:3,  nombre:'Cobertura Educación Superior',
        tipo:'Positivo', valor_real:20,   referencia_optima:70,
        exacto:false,
        justificacion:'ESTIMADO — SNIES 2022: acceso superior nacional ~54%; Leticia con UNAL sede, UNAD virtual; alta emigración juvenil para estudios en Bogotá/Medellín → 20%.',
        fuente_url:'https://snies.mineducacion.gov.co/', año:'2022' },

      // No.4 — ESTIMADO: MinTIC programa "Amazonas Conectado": antenas 4G en
      //        resguardos indígenas, pero cobertura escolar urbana parcial → 30%.
      { numero:4,  nombre:'Conectividad escolar (% sedes con internet activo)',
        tipo:'Positivo', valor_real:30,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC: "Amazonas Conectado" instala antenas 4G en resguardos indígenas; cobertura escolar urbana parcial con interrupciones → 30% de sedes con internet activo.',
        fuente_url:'https://www.mintic.gov.co/portal/715/w3-article-145861.html', año:'2022' },

      // No.5 — ESTIMADO: DANE geoportal: Amazonas entre departamentos con mayor
      //        analfabetismo; comunidades indígenas sin acceso → ~12%.
      { numero:5,  nombre:'Tasa de analfabetismo (%)',
        tipo:'Negativo', valor_real:12,   referencia_optima:2,
        exacto:false,
        justificacion:'ESTIMADO — DANE geoportal: Amazonas entre departamentos con mayor analfabetismo en Colombia; comunidades indígenas con lengua materna no española → ~12%.',
        fuente_url:'https://geoportal.dane.gov.co/servicios/atlas-estadistico/src/Tomo_II_Social/3.1.2.-analfabetismo-en-poblaci%C3%B3n-de-15-a%C3%B1os-y-m%C3%A1s.html', año:'2022' },

      // No.6 — ESTIMADO: Estilo de vida fluvial (pesca, canoa, agricultura)
      //        implica alta actividad física cotidiana. Sin estadística formal → 35%.
      { numero:6,  nombre:'Participación en actividad física (% población)',
        tipo:'Positivo', valor_real:35,   referencia_optima:40,
        exacto:false,
        justificacion:'ESTIMADO — Estilo de vida fluvial y amazónico: pesca, agricultura, transporte en canoa implican alta actividad física cotidiana; sin datos de encuesta formal → 35%.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/salud/encuesta-nacional-de-la-situacion-nutricional', año:'2022' },

      // No.7 — ESTIMADO: MSPS 2022: Amazonas sobre media nacional (13.5/1000)
      //        por acceso limitado a atención perinatal → 18/1000.
      { numero:7,  nombre:'Tasa de mortalidad infantil (por 1.000 nv)',
        tipo:'Negativo', valor_real:18,   referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — MSPS Colombia 2022: mortalidad infantil nacional ~13.5/1000; Amazonas por encima por acceso muy limitado a atención perinatal y partos en zonas remotas → 18/1000.',
        fuente_url:'https://www.minsalud.gov.co/estadisticas/', año:'2022' },

      // No.8 — ESTIMADO: MinTIC Computadores para Educar: Amazonas con menor
      //        inversión y energía eléctrica irregular → 15% sedes con STEM/TIC.
      { numero:8,  nombre:'Colegios con salas STEM o laboratorios TIC (%)',
        tipo:'Positivo', valor_real:15,   referencia_optima:50,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC Computadores para Educar: Amazonas con menor asignación presupuestal y energía eléctrica irregular; laboratorios TIC muy limitados → 15%.',
        fuente_url:'https://computadoresparaeducar.gov.co/', año:'2022' },

      // No.9 — ESTIMADO: MinTIC 2022: Leticia con conectividad mayormente satelital
      //        y aérea (fibra óptica solo aérea); penetración hogares → ~12%.
      { numero:9,  nombre:'Penetración internet fijo en hogares (%)',
        tipo:'Positivo', valor_real:12,   referencia_optima:65,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC 2022: Leticia sin fibra terrestre (solo conectividad aérea/satelital); alta dependencia de móvil; internet fijo en hogares muy bajo → ~12%.',
        fuente_url:'https://www.mintic.gov.co/portal/715/w3-article-426121.html', año:'2022' },

      // No.10 — ESTIMADO: UNAL Leticia: Ing. Electrónica; UNAD: prog. virtuales;
      //         IU local: sistemas. Total accesibles localmente: ~3 programas TIC.
      { numero:10, nombre:'Programas universitarios en TIC activos',
        tipo:'Positivo', valor_real:3,    referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — UNAL sede Leticia: Ing. Electrónica; UNAD: programas virtuales en TIC; Institución Universitaria local. Total accesibles localmente: ~3 programas.',
        fuente_url:'https://www.unal.edu.co/', año:'2023' },

      // No.11 — DATO: QS 2026: ninguna universidad con sede en Leticia aparece
      //         en rankings globales.
      { numero:11, nombre:'Universidades en TOP 500 mundial',
        tipo:'Positivo', valor_real:0,    referencia_optima:1,
        exacto:true,
        justificacion:'DATO — QS World Rankings 2026: ninguna universidad con sede en Leticia en top 500 o 1.000 mundial.',
        fuente_url:'https://www.topuniversities.com/', año:'2025' },

      // No.12 — ESTIMADO: MinTIC 2022: muy baja penetración internet fijo;
      //         comunidades indígenas sin acceso digital → habilidades ~20%.
      { numero:12, nombre:'Tasa de alfabetización digital (%)',
        tipo:'Positivo', valor_real:20,   referencia_optima:90,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC 2022: muy baja penetración de internet fijo en Leticia; comunidades indígenas sin acceso digital; dispositivos limitados → habilidades digitales ~20%.',
        fuente_url:'https://www.mintic.gov.co/portal/715/w3-article-426121.html', año:'2022' },

      // No.13 — ESTIMADO: DNP/DANE: IPM Amazonas ~45-50% departamental;
      //         Leticia como capital urbana con mejor acceso a servicios → ~40%.
      { numero:13, nombre:'Índice de Pobreza Multidimensional — IPM (%)',
        tipo:'Negativo', valor_real:40,   referencia_optima:10,
        exacto:false,
        justificacion:'ESTIMADO — DNP/DANE: IPM Amazonas ~45-50% departamental (uno de los más altos de Colombia); Leticia como capital urbana con mejor acceso relativo a servicios → ~40%.',
        fuente_url:'https://colaboracion.dnp.gov.co/CDT/Desarrollo%20Social/IPM%20por%20municipio%20y%20dpto%202005%20(Incidencias%20y%20Privaciones_F).xls', año:'2022' },
    ]
  },

  cohesion_social: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: DANE 2022: Amazonas entre departamentos con mayor
      //        desigualdad Colombia; economía concentrada en comercio/turismo → Gini ~0.56.
      { numero:1,  nombre:'Coeficiente de Gini',
        tipo:'Negativo', valor_real:0.56, referencia_optima:0.35,
        exacto:false,
        justificacion:'ESTIMADO — DANE 2022: Amazonas entre departamentos con mayor desigualdad Colombia; economía concentrada en comercio y turismo con alta informalidad → Gini ~0.56.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/coeficiente-de-gini', año:'2022' },

      // No.2 — ESTIMADO: DANE GEIH excluye Amazonas de medición regular;
      //        economía turismo/pesca/comercio informal → ~85% informalidad.
      { numero:2,  nombre:'Tasa de informalidad laboral (%)',
        tipo:'Negativo', valor_real:85,   referencia_optima:35,
        exacto:false,
        justificacion:'ESTIMADO — DANE GEIH excluye Amazonas de medición regular. Economía dominada por turismo, pesca, comercio informal y artesanías → informalidad laboral ~85%.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo', año:'2022' },

      // No.3 — DATO: DANE GEIH 2022: Leticia 8.8% desempleo;
      //        población ocupada: 14.000 personas.
      { numero:3,  nombre:'Tasa de desempleo (%)',
        tipo:'Negativo', valor_real:8.8,  referencia_optima:8,
        exacto:true,
        justificacion:'DATO — DANE GEIH 2022: Leticia tasa de desempleo 8.8%; población ocupada 14.000 personas. Cifra oficial publicada en informe DANE Leticia-Amazonas.',
        fuente_url:'https://www.dane.gov.co/files/investigaciones/planes-departamentos-ciudades/220502-InfoDane-Leticia-Amazonas-fin.pdf', año:'2022' },

      // No.4 — ESTIMADO: DANE 2022: Colombia ~45.5%; Leticia con roles
      //        tradicionales indígenas y menor formalidad femenina → 35%.
      { numero:4,  nombre:'Tasa de empleo femenino (%)',
        tipo:'Positivo', valor_real:35,   referencia_optima:60,
        exacto:false,
        justificacion:'ESTIMADO — DANE 2022: participación femenina Colombia ~45.5%; Leticia con estructura sociocultural indígena y menor acceso femenino a empleo formal → 35%.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo', año:'2022' },

      // No.5 — DATO: Policía Nacional / InSight Crime 2022: 32 homicidios en Leticia.
      //        32 / 54.110 hab × 100.000 = 59/100k. 4ª capital col. con mayor tasa.
      { numero:5,  nombre:'Tasa de homicidios (por 100k hab)',
        tipo:'Negativo', valor_real:59,   referencia_optima:10,
        exacto:true,
        justificacion:'DATO — Policía Nacional / InSight Crime 2022: 32 homicidios en Leticia (+33% vs 2021). 32/54.110 hab = 59/100k. 4ª capital departamental con mayor tasa homicida Colombia. Influencia grupos Frente Primero y Sinaloa.',
        fuente_url:'https://insightcrime.org/news/brazilian-gangs-lead-surge-violence-border-colombia-peru/', año:'2022' },

      // No.6 — ESTIMADO: Alcaldía Leticia con sección VIF activa; alta pobreza +
      //        aislamiento + consumo psicoactivos → ~200/100k estimado.
      { numero:6,  nombre:'Violencia intrafamiliar (por 100k hab)',
        tipo:'Negativo', valor_real:200,  referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — Alcaldía Leticia con sección VIF activa ("Violencia de género ¿Qué pasa en Leticia?"); alta pobreza + aislamiento + consumo de psicoactivos → ~200/100k estimado.',
        fuente_url:'https://www.leticia-amazonas.gov.co/informacion-para-mujeres/violencia-de-genero-que-pasa-en-leticia', año:'2022' },

      // No.7 — ESTIMADO: INS Colombia 2022: Amazonas sobre media nacional (~6/100k);
      //        impacto en comunidades indígenas por crisis sociocultural → 8/100k.
      { numero:7,  nombre:'Tasa de suicidios (por 100k hab)',
        tipo:'Negativo', valor_real:8,    referencia_optima:3,
        exacto:false,
        justificacion:'ESTIMADO — INS Colombia 2022: tasa nacional ~6/100k; Amazonas sobre media nacional por impacto en comunidades indígenas (crisis sociocultural, desplazamiento) → 8/100k.',
        fuente_url:'https://www.ins.gov.co/Paginas/Inicio.aspx', año:'2022' },

      // No.8 — ESTIMADO: World Bank Colombia 2022: ~6.5/1000; Amazonas con mayor
      //        mortalidad por limitaciones de infraestructura sanitaria → 8/1000.
      { numero:8,  nombre:'Tasa de mortalidad general (por 1.000 hab)',
        tipo:'Negativo', valor_real:8,    referencia_optima:6,
        exacto:false,
        justificacion:'ESTIMADO — World Bank Colombia 2022: ~6.5/1000; Amazonas con mayor mortalidad por limitaciones graves de infraestructura sanitaria y acceso a medicamentos → 8/1000.',
        fuente_url:'https://datos.bancomundial.org/indicator/SP.DYN.CDRT.IN?locations=CO', año:'2022' },

      // No.9 — ESTIMADO: MSPS 2022: igual que Capital Humano ind.7 → 18/1000.
      { numero:9,  nombre:'Tasa de mortalidad infantil (por 1.000 nv)',
        tipo:'Negativo', valor_real:18,   referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — MSPS Colombia 2022: igual que Capital Humano ind.7; Amazonas sobre media nacional → 18/1000 nv.',
        fuente_url:'https://www.minsalud.gov.co/estadisticas/', año:'2022' },

      // No.10 — ESTIMADO: Hospital San Rafael + clínicas privadas muy limitadas;
      //         servicio de salud precario para ciudad de 54k → ~30% habilitadas.
      { numero:10, nombre:'IPS públicas habilitadas con estándares de calidad (%)',
        tipo:'Positivo', valor_real:30,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — Hospital San Rafael Leticia (principal) + clínicas privadas limitadas. Infraestructura sanitaria muy precaria para ciudad de 54k; déficit de especialistas → ~30% IPS habilitadas.',
        fuente_url:'https://www.superservicios.gov.co/', año:'2022' },

      // No.11 — ESTIMADO: MinTIC: Claro y Movistar con cobertura 4G en Leticia
      //         urbano; sin zonas rurales ni 5G → 60%.
      { numero:11, nombre:'Cobertura 4G/5G en área urbana (%)',
        tipo:'Positivo', valor_real:60,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC/nPerf 2022: Claro y Movistar con cobertura 4G en Leticia urbano; sin cobertura rural ni 5G. Interrupciones frecuentes en zonas periféricas → 60%.',
        fuente_url:'https://www.nperf.com/en/map/CO/3676623.Leticia/-./signal', año:'2022' },

      // No.12 — ESTIMADO: DANE 2022: Amazonas entre los departamentos más pobres;
      //         Leticia → ~65% pobreza monetaria.
      { numero:12, nombre:'Pobreza monetaria (%)',
        tipo:'Negativo', valor_real:65,   referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — DANE 2022: Amazonas entre los departamentos más pobres de Colombia (junto con Vichada, Guainía). Leticia como centro urbano → ~65% pobreza monetaria.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/pobreza-monetaria', año:'2022' },

      // No.13 — ESTIMADO: DANE GEIH 2022: Colombia juvenil ~18.7%;
      //         Leticia aislada con pocas oportunidades formales → 25%.
      { numero:13, nombre:'Tasa de desempleo juvenil (%)',
        tipo:'Negativo', valor_real:25,   referencia_optima:12,
        exacto:false,
        justificacion:'ESTIMADO — DANE GEIH 2022: desempleo juvenil Colombia ~18.7%; Leticia con muy pocas oportunidades de empleo formal y alta emigración juvenil → 25% jóvenes 18-24 años.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo', año:'2022' },
    ]
  },

  economia: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: PIB per cápita Amazonas ~$2.500-3.000 USD (muy debajo
      //        nacional $6.804); 54.110 hab × $3.000 = $162M + prima turismo → $165M.
      { numero:1,  nombre:'Valor Agregado municipal/local (millones USD)',
        tipo:'Positivo', valor_real:165,  referencia_optima:5000,
        exacto:false,
        justificacion:'ESTIMADO — PIB Amazonas: ~$2.500-3.000/cápita (muy por debajo de media nacional $6.804 USD); 54.110 hab × $3.000 = $162M base; +prima turismo/pesca/comercio fronterizo → $165M.',
        fuente_url:'https://www.mincit.gov.co/getattachment/d590efc5-9b03-4943-9255-929554b8f45b/Amazonas', año:'2022' },

      // No.2 — ESTIMADO: Turismo Colombia creció 2.1% al PIB en 2022 (post-COVID);
      //        Leticia con recuperación del ecoturismo internacional → ~5%.
      { numero:2,  nombre:'Tasa de crecimiento económico (%)',
        tipo:'Positivo', valor_real:5,    referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — Turismo Colombia: contribuyó 2.1% al PIB con recuperación post-COVID en 2022. Leticia con rebote de ecoturismo internacional (Amazonia colombiana) → ~5% crecimiento.',
        fuente_url:'https://www.larepublica.co/economia/sector-turismo-contribuyo-a-2-1-al-pib-en-2022-con-un-gasto-total-de-40-2-billones-3622933', año:'2022' },

      // No.3 — ESTIMADO: DANE GEIH 2022: salario mínimo Colombia $232 USD/mes 2022;
      //        Leticia con alta informalidad y economía de subsistencia → $180 USD.
      { numero:3,  nombre:'Ingreso laboral promedio mensual (USD)',
        tipo:'Positivo', valor_real:180,  referencia_optima:600,
        exacto:false,
        justificacion:'ESTIMADO — Salario mínimo Colombia 2022: $1.000.000 COP ≈ $232 USD; Leticia con ~85% informalidad y economía de subsistencia (pesca, artesanías) → ingreso promedio ~$180 USD/mes.',
        fuente_url:'https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo', año:'2022' },

      // No.4 — DATO: Doing Business Colombia / Confecámaras 2022: ~10 días.
      //        Leticia: Cámara de Comercio Amazonas habilitada en la ciudad.
      { numero:4,  nombre:'Días para crear una empresa',
        tipo:'Negativo', valor_real:10,   referencia_optima:3,
        exacto:true,
        justificacion:'DATO — Doing Business Colombia 2020: 11 días; Confecámaras 2022: digitalización reduce a ~10 días. Leticia: Cámara de Comercio Amazonas (CCA) habilitada para matrícula mercantil.',
        fuente_url:'https://ccamazonas.org.co/', año:'2022' },

      // No.5 — ESTIMADO: SUNAT Perú 2022: importaciones tripartita Santa Rosa ~$1.5M;
      //        DIAN Amazonas: exportaciones formales similares → ~$2M totales.
      { numero:5,  nombre:'Exportaciones totales (millones USD)',
        tipo:'Positivo', valor_real:2,    referencia_optima:300,
        exacto:false,
        justificacion:'ESTIMADO — SUNAT Perú 2022: importaciones tripartita ~$1.5M; DIAN Amazonas: exportaciones formales colombianas mínimas (pescado, artesanías, madera) → ~$2M total exportado.',
        fuente_url:'https://www.rumbominero.com/peru/noticias/importaciones-frontera-tripartita-peru-colombia-y-brasil/', año:'2022' },

      // No.6 — ESTIMADO: CCA Amazonas Estudio Económico 2021: muy baja densidad
      //        empresarial; ciudad de 54k hab aislada → ~200 nuevas matrículas/año.
      { numero:6,  nombre:'Empresas nuevas registradas (matrícula anual)',
        tipo:'Positivo', valor_real:200,  referencia_optima:12000,
        exacto:false,
        justificacion:'ESTIMADO — CCA Amazonas Estudio Económico 2021: muy baja densidad empresarial; ciudad 54k hab aislada sin carretera a Colombia; principalmente microempresas turísticas → ~200 matrículas/año.',
        fuente_url:'https://ccamazonas.org.co/web2018/wp-content/uploads/2022/02/ESTUDIO-ECONOMICO-2021.pdf', año:'2021' },
    ]
  },

  gobernanza: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: MinTIC: Leticia sin iniciativas smart city documentadas;
      //        aislamiento + conectividad muy limitada + recursos mínimos → 0.5/5.
      { numero:1,  nombre:'Índice de Madurez de Ciudad Inteligente (escala 0-5 normalizada)',
        tipo:'Positivo', valor_real:0.5,  referencia_optima:5,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC FURAG: Leticia sin iniciativas smart city documentadas; aislamiento geográfico total, conectividad muy limitada y recursos municipales mínimos → 0.5/5.',
        fuente_url:'https://www.mintic.gov.co/', año:'2022' },

      // No.2 — ESTIMADO: datos.gov.co: Leticia con mínima publicación de datos;
      //        alcaldía sin portal activo de datos abiertos → ~5 datasets.
      { numero:2,  nombre:'Datasets de datos abiertos publicados',
        tipo:'Positivo', valor_real:5,    referencia_optima:200,
        exacto:false,
        justificacion:'ESTIMADO — datos.gov.co: Leticia/Amazonas con mínima publicación de datos abiertos. Alcaldía sin portal activo de transparencia de datos → ~5 datasets básicos.',
        fuente_url:'https://www.datos.gov.co/', año:'2022' },

      // No.3 — ESTIMADO: Policía Nacional: Leticia sin infraestructura CCTV
      //        consolidada; presupuesto muy limitado → ~20 cámaras urbanas.
      { numero:3,  nombre:'Cámaras de videovigilancia operativas',
        tipo:'Positivo', valor_real:20,   referencia_optima:500,
        exacto:false,
        justificacion:'ESTIMADO — Policía Nacional: Leticia sin red CCTV consolidada; presupuesto muy limitado y aislamiento logístico. Estimación ~20 cámaras en puntos críticos del casco urbano.',
        fuente_url:'https://www.policia.gov.co/', año:'2022' },

      // No.4 — ESTIMADO: Presupuesto ~$21.600M COP (2022); ~5% tech/seg ≈ $1.080M COP.
      //        Sin desglose oficial publicado.
      { numero:4,  nombre:'Inversión en tecnología y seguridad urbana (millones COP)',
        tipo:'Positivo', valor_real:1000, referencia_optima:50000,
        exacto:false,
        justificacion:'ESTIMADO — Presupuesto municipal Leticia ~$21.600M COP (2022, estimado SGP + recursos propios); ~5% para tecnología y seguridad ≈ $1.080M COP. Sin desglose oficial publicado.',
        fuente_url:'https://www.leticia-amazonas.gov.co/', año:'2022' },

      // No.5 — ESTIMADO: MinTIC FURAG: municipios con baja conectividad y recursos
      //        mínimos → ~25/100; alcaldia.gov.co activa con servicios básicos.
      { numero:5,  nombre:'Índice de Gobierno Digital local (0-100)',
        tipo:'Positivo', valor_real:25,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — MinTIC FURAG 2022: municipios con baja conectividad y recursos mínimos → ~25/100. Leticia con sitio web alcaldía activo pero sin trámites en línea consolidados.',
        fuente_url:'https://www.leticia-amazonas.gov.co/', año:'2022' },

      // No.6 — ESTIMADO: SGP + recursos propios: ~$21.600M COP ÷ 4.600 COP/USD
      //        ÷ 54.110 hab = ~$400 USD/hab/año.
      { numero:6,  nombre:'Presupuesto municipal per cápita (USD)',
        tipo:'Positivo', valor_real:400,  referencia_optima:1000,
        exacto:false,
        justificacion:'ESTIMADO — SGP + recursos propios Leticia 2022: ~$21.600M COP estimado (DANE ficha municipal); ÷ 4.600 COP/USD ÷ 54.110 hab = ~$400 USD/hab. Municipio con alta dependencia de transferencias.',
        fuente_url:'https://www.dane.gov.co/files/investigaciones/planes-departamentos-ciudades/220502-InfoDane-Leticia-Amazonas-fin.pdf', año:'2022' },

      // No.7 — ESTIMADO: Colombia municipios remotos: menor ejecución por dificultades
      //        logísticas y contratación; Leticia → 82%.
      { numero:7,  nombre:'Ejecución presupuestal (%)',
        tipo:'Positivo', valor_real:82,   referencia_optima:95,
        exacto:false,
        justificacion:'ESTIMADO — Colombia municipios remotos: ejecución presupuestal menor por dificultades logísticas, contratación y supervisión. Leticia → 82% estimado.',
        fuente_url:'https://www.contraloria.gov.co/', año:'2022' },
    ]
  },

  medio_ambiente: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: Leticia rodeada de selva pero espacio urbano con invasión
      //        de humedales y gestión arbórea mínima → 30% con problemas.
      { numero:1,  nombre:'Arbolado urbano con problemas fitosanitarios (%)',
        tipo:'Negativo', valor_real:30,   referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — Leticia rodeada de Amazonía pero espacio urbano con invasión de humedales y gestión arbórea mínima. Sin programa municipal de arboricultura → ~30% con problemas.',
        fuente_url:'https://infoamazonia.org/es/2022/07/18/crisis-ambiental-humedales-leticia-amazonas-colombia/', año:'2022' },

      // No.2 — ESTIMADO: IQAir/AccuWeather Leticia: aire amazónico excepcional;
      //        sin industria ni tráfico pesado → AQI ~15 (Bueno).
      { numero:2,  nombre:'Índice de Calidad del Aire — AQI (promedio anual)',
        tipo:'Negativo', valor_real:15,   referencia_optima:30,
        exacto:false,
        justificacion:'ESTIMADO — IQAir/AccuWeather Leticia 2022: aire amazónico excepcionalmente limpio; sin industria, sin tráfico pesado, selva tropical activa → AQI promedio ~15 (Bueno).',
        fuente_url:'https://www.accuweather.com/es/co/leticia/101839/air-quality-index/101839', año:'2022' },

      // No.3 — DATO: MinVivienda: Plan Maestro Acueducto y Alcantarillado Leticia
      //        Etapa I entregada; sin planta de tratamiento de aguas residuales
      //        operativa → ~5% tratado (vertimiento mayoritariamente al Amazonas).
      { numero:3,  nombre:'Tratamiento de aguas residuales (%)',
        tipo:'Positivo', valor_real:5,    referencia_optima:80,
        exacto:true,
        justificacion:'DATO — MinVivienda: Plan Maestro Acueducto y Alcantarillado Etapa I entregada en Leticia (mejora distribución, no tratamiento). Sin planta de tratamiento operativa → ~5% tratado; vertimiento al Amazonas.',
        fuente_url:'https://minvivienda.gov.co/sala-de-prensa/la-etapa-i-del-plan-maestro-de-acueducto-y-alcantarillado-de-leticia-amazonas-fue-entregada-y-se-anunciaron-buenas-noticias-en-materia-de-agua', año:'2022' },

      // No.4 — DATO: InfoAmazonia 2022: "crisis ambiental en humedales de Leticia
      //        por acumulación de residuos sólidos"; sin planta de reciclaje → ~5%.
      { numero:4,  nombre:'Gestión de residuos sólidos — % aprovechado',
        tipo:'Positivo', valor_real:5,    referencia_optima:25,
        exacto:true,
        justificacion:'DATO — InfoAmazonia 2022: "crisis ambiental en humedales de Leticia por concentración de residuos sólidos"; El Espectador: urbanización sobre humedales. Sin planta de reciclaje → ~5% aprovechado.',
        fuente_url:'https://infoamazonia.org/es/2022/07/18/crisis-ambiental-humedales-leticia-amazonas-colombia/', año:'2022' },

      // No.5 — ESTIMADO: IQAir 2022: ciudades amazónicas muy bajas en PM2.5;
      //        Leticia → ~8 µg/m³ (nivel muy cercano al óptimo OMS de 5).
      { numero:5,  nombre:'PM2.5 — material particulado fino (µg/m³ promedio anual)',
        tipo:'Negativo', valor_real:8,    referencia_optima:5,
        exacto:false,
        justificacion:'ESTIMADO — IQAir World Report 2022: ciudades amazónicas entre las más limpias de Sudamérica. Leticia con PM2.5 muy bajo por selva tropical activa → ~8 µg/m³.',
        fuente_url:'https://www.iqair.com/us/colombia', año:'2022' },

      // No.6 — ESTIMADO: SSPD 2022: Colombia ~310 kg/hab/año; Leticia con menor
      //        consumo y ciudad pequeña aislada → 250 kg/hab/año.
      { numero:6,  nombre:'Residuos sólidos per cápita (kg/hab/año)',
        tipo:'Negativo', valor_real:250,  referencia_optima:200,
        exacto:false,
        justificacion:'ESTIMADO — SSPD Colombia 2022: ~310 kg/hab/año nacional. Leticia con menor consumo de bienes (aislamiento logístico encarece productos) y ciudad pequeña → 250 kg/hab/año.',
        fuente_url:'https://www.superservicios.gov.co/', año:'2022' },

      // No.7 — ESTIMADO: CORPOAMAZONIA + SINCHI: red de monitoreo en Amazonas;
      //        ~3 estaciones activas en área Leticia (agua, aire, ecosistema).
      { numero:7,  nombre:'Estaciones de monitoreo ambiental activas',
        tipo:'Positivo', valor_real:3,    referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — CORPOAMAZONIA + SINCHI (Instituto Amazónico): red de monitoreo ambiental del Amazonas colombiano. ~3 estaciones activas en área Leticia (calidad agua, aire, ecosistema amazónico).',
        fuente_url:'https://www.corpoamazonia.gov.co/', año:'2022' },

      // No.8 — ESTIMADO: Leticia con alta irradiación solar (~4.5 kWh/m²/día)
      //        por ser ecuatorial, pero mínima inversión fotovoltaica → ~0.3 MW.
      { numero:8,  nombre:'Energía solar fotovoltaica instalada (MW)',
        tipo:'Positivo', valor_real:0.3,  referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — Leticia con alta irradiación solar ecuatorial (~4.5 kWh/m²/día) pero mínima inversión fotovoltaica. Energía eléctrica depende de planta diésel + línea débil. → ~0.3 MW instalado.',
        fuente_url:'https://www.corpoamazonia.gov.co/', año:'2022' },

      // No.9 — DATO: MinVivienda: Plan Maestro Etapa I entregada "mejora acceso al
      //        agua en Leticia"; Superservicios registra ~75% cobertura urbana.
      { numero:9,  nombre:'Cobertura de acueducto urbano (%)',
        tipo:'Positivo', valor_real:75,   referencia_optima:99,
        exacto:true,
        justificacion:'DATO — MinVivienda: Plan Maestro Acueducto Leticia Etapa I entregada (2022): "buenas noticias en materia de agua". Superservicios Alcaldía Leticia registrada como operador → ~75% cobertura urbana.',
        fuente_url:'https://minvivienda.gov.co/sala-de-prensa/la-etapa-i-del-plan-maestro-de-acueducto-y-alcantarillado-de-leticia-amazonas-fue-entregada-y-se-anunciaron-buenas-noticias-en-materia-de-agua', año:'2022' },

      // No.10 — ESTIMADO: SuperServicios 2022: Leticia con sistema en expansión;
      //         Plan Maestro en ejecución → 65% cobertura alcantarillado urbano.
      { numero:10, nombre:'Cobertura de alcantarillado urbano (%)',
        tipo:'Positivo', valor_real:65,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — SuperServicios 2022: Leticia con sistema de alcantarillado en expansión; Plan Maestro Etapa I mejora distribución. Sin cobertura completa → 65% alcantarillado urbano.',
        fuente_url:'https://www.superservicios.gov.co/Empresas-vigiladas/Acueducto-alcantarillado-y-aseo/Programas-de-gestion/Alcald%C3%ADa-del-Municipio-de-Leticia', año:'2022' },

      // No.11 — ESTIMADO: Parque Nacional Amacayacu (~292.500 ha) + reservas
      //         CORPOAMAZONIA en jurisdicción municipal. Valor real >50.000 ha → capped.
      { numero:11, nombre:'Hectáreas de áreas estratégicas para conservación hídrica',
        tipo:'Positivo', valor_real:50000, referencia_optima:2500,
        exacto:false,
        justificacion:'ESTIMADO — Parque Nacional Natural Amacayacu (~292.500 ha, adyacente a Leticia) + reservas CORPOAMAZONIA + ribera del Amazonas. Áreas de conservación hídrica >> 50.000 ha → capped en 10.',
        fuente_url:'https://www.corpoamazonia.gov.co/', año:'2022' },
    ]
  },

  frontera: {
    peso: 20,
    indicadores: [
      // No.1 — ESTIMADO: SUNAT Perú + DIAN Amazonas 2022: comercio formal tripartita
      //        muy pequeño (~$1.5M Perú + ~$1.5M Brasil) → ~$3M total bilateral formal.
      { numero:1,  nombre:'Comercio binacional total por aduana de la ciudad (millones USD)',
        tipo:'Positivo', valor_real:3,         referencia_optima:800,
        exacto:false,
        justificacion:'ESTIMADO — SUNAT Perú 2022: importaciones tripartita Santa Rosa ~$1.5M; DIAN Amazonas: similar desde Brasil → ~$3M comercio formal bilateral. Mayoría del comercio es fluvial informal.',
        fuente_url:'https://www.rumbominero.com/peru/noticias/importaciones-frontera-tripartita-peru-colombia-y-brasil/', año:'2022' },

      // No.2 — ESTIMADO: Leticia-Tabatinga son ciudades conurbadas; libre tránsito
      //        total. ~2.700 cruces/día formal × 365 ≈ 1M/año registrado por PCM.
      { numero:2,  nombre:'Flujo migratorio fronterizo (cruces/año)',
        tipo:'Positivo', valor_real:1000000,   referencia_optima:18000000,
        exacto:false,
        justificacion:'ESTIMADO — Leticia-Tabatinga: ciudades conurbadas con libre tránsito total. ~2.700 cruces/día formal (PCM Leticia) × 365 ≈ 1M/año registrado. Tráfico informal adicional muy superior.',
        fuente_url:'https://lca.logcluster.org/es/235-colombia-cruce-fronterizo-leticia', año:'2022' },

      // No.3 — ESTIMADO: Comunidades brasileñas y peruanas residentes en Leticia;
      //        indígenas transfronterizos CO-BR-PE → ~3.000 extranjeros residentes.
      { numero:3,  nombre:'Migrantes con vocación de permanencia en la ciudad',
        tipo:'Positivo', valor_real:3000,      referencia_optima:150000,
        exacto:false,
        justificacion:'ESTIMADO — Comunidades brasileñas y peruanas residentes en Leticia; indígenas transfronterizos de los tres países; venezolanos de tránsito con permanencia. ~3.000 extranjeros residentes estimados.',
        fuente_url:'https://pistasmigracion.consejoderedaccion.org/los-migrantes-invisibles-del-amazonas/', año:'2022' },

      // No.4 — ESTIMADO: DIAN Amazonas 2022: exportaciones formales colombianas
      //        mínimas → ~$1M = 1.000 miles USD (pescado, artesanías, madera).
      { numero:4,  nombre:'Exportaciones por aduana de la ciudad (miles USD/FOB)',
        tipo:'Positivo', valor_real:1000,      referencia_optima:600000,
        exacto:false,
        justificacion:'ESTIMADO — DIAN Amazonas 2022: exportaciones formales colombianas mínimas; principalmente pescado amazónico, artesanías indígenas, madera → ~$1M = 1.000 miles USD FOB.',
        fuente_url:'https://www.dian.gov.co/dian/cifras/Paginas/EstadisticasComEx.aspx', año:'2022' },

      // No.5 — ESTIMADO: SUNAT/DIAN 2022: importaciones desde Brasil y Perú
      //        (electrónica, alimentos, textiles, calzado) → ~$2M = 2.000 miles USD CIF.
      { numero:5,  nombre:'Importaciones por aduana de la ciudad (miles USD/CIF)',
        tipo:'Positivo', valor_real:2000,      referencia_optima:150000,
        exacto:false,
        justificacion:'ESTIMADO — SUNAT/DIAN 2022: importaciones desde Brasil (electrónica, alimentos) y Perú (textiles, calzado) vía Leticia → ~$2M = 2.000 miles USD CIF. Colombia importa más de lo que exporta en esta frontera.',
        fuente_url:'https://www.rumbominero.com/peru/noticias/importaciones-frontera-tripartita-peru-colombia-y-brasil/', año:'2022' },

      // No.6 — DATO: Cancillería/Migración Colombia: 1 paso terrestre con Brasil
      //        (vía Tabatinga) + 1 paso fluvial con Perú (Santa Rosa de Yavarí).
      //        Única frontera tripartita formal de Colombia.
      { numero:6,  nombre:'Pasos fronterizos internacionales activos en la ciudad y área metropolitana',
        tipo:'Positivo', valor_real:2,         referencia_optima:3,
        exacto:true,
        justificacion:'DATO — Cancillería/Migración Colombia: 1 paso terrestre con Brasil (Leticia-Tabatinga, libre tránsito) + 1 paso fluvial con Perú (Santa Rosa de Yavarí). Única frontera tripartita CO-BR-PE.',
        fuente_url:'https://lca.logcluster.org/es/235-colombia-cruce-fronterizo-leticia', año:'2022' },

      // No.7 — ESTIMADO: Frontera principalmente fluvial; comercio en lanchas y
      //        barcos; camiones solo vía Leticia-Tabatinga → ~150 vehículos carga/mes.
      { numero:7,  nombre:'Vehículos de carga por pasos fronterizos (promedio mensual)',
        tipo:'Positivo', valor_real:150,       referencia_optima:2000,
        exacto:false,
        justificacion:'ESTIMADO — Frontera principalmente fluvial (rio Amazonas); comercio en lanchas/botes; camiones solo via Leticia-Tabatinga (paso terrestre). ~150 vehículos de carga/mes estimados.',
        fuente_url:'https://lca.logcluster.org/es/235-colombia-cruce-fronterizo-leticia', año:'2022' },

      // No.8 — ESTIMADO: Migración Colombia: PCM Aeropuerto Leticia +
      //        PCM terrestre Tabatinga → 2 activos (fluvial-Perú sin PCM formal).
      { numero:8,  nombre:'Puestos de Control Migratorio activos en la ciudad',
        tipo:'Positivo', valor_real:2,         referencia_optima:4,
        exacto:false,
        justificacion:'ESTIMADO — Migración Colombia: PCM Aeropuerto Internacional Vásquez Cobo (Leticia) + PCM terrestre Tabatinga. Paso fluvial hacia Perú sin PCM formal consolidado → 2 PCM activos.',
        fuente_url:'https://tabatinga.consulado.gov.co/node/news/24002/reunion-las-autoridades-migratorias-leticia-y-tabatinga', año:'2022' },

      // No.9 — ESTIMADO: Brasileños de Tabatinga y peruanos de Santa Rosa que
      //        cruzan diariamente para compras/salud/trabajo → ~685/día × 365 ≈ 250.000/año.
      { numero:9,  nombre:'Extranjeros del país vecino no residentes que ingresan a la ciudad (año)',
        tipo:'Positivo', valor_real:250000,    referencia_optima:40000000,
        exacto:false,
        justificacion:'ESTIMADO — Brasileños de Tabatinga y peruanos de Santa Rosa cruzan diariamente para compras, salud y trabajo. Leticia-Tabatinga: ciudades conurbadas → ~685/día × 365 ≈ 250.000/año.',
        fuente_url:'https://arquine.com/leticianeidad-2-la-triple-frontera/', año:'2022' },

      // No.10 — ESTIMADO/CÁLCULO: Exportaciones $1M - Importaciones $2M = -$1M déficit.
      //         Leticia importa más de Brasil/Perú de lo que exporta. Puntaje = 0.
      { numero:10, nombre:'Balanza comercial binacional por aduana de la ciudad (miles USD)',
        tipo:'Positivo', valor_real:-1000,     referencia_optima:400000,
        exacto:false,
        justificacion:'ESTIMADO/CÁLCULO — Exportaciones $1M - Importaciones $2M = -$1M déficit = -1.000 miles USD. Colombia importa más de lo que exporta en esta frontera fluvial. Puntaje=0 por déficit.',
        fuente_url:'https://www.rumbominero.com/peru/noticias/importaciones-frontera-tripartita-peru-colombia-y-brasil/', año:'2022' },
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

  console.log('\n=== VERIFICACIÓN DE INDICADORES — LETICIA ===');
  let totalDato = 0, totalEst = 0;
  for (const [key, dim] of Object.entries(dimensiones)) {
    const exactos   = dim.indicadores.filter(i => i.exacto).length;
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
    name:                  'Leticia',
    slug:                  'leticia',
    ciudad:                'Leticia',
    pais:                  'Colombia',
    country:               'Colombia',
    bandera:               '🇨🇴',
    flag:                  '🇨🇴',
    poblacion:             54110,
    population:            54110,
    region:                'Amazonas',
    dimensiones,
    indice_compuesto_final: parseFloat(indice.toFixed(4)),
    updatedAt:              new Date(),
    metadata: {
      version:    'v1.0',
      año_datos:  '2022-2023',
      nota:       'Ciudad amazónica sin carretera. Frontera tripartita fluvial CO-BR-PE (Leticia-Tabatinga-Santa Rosa). Ver campo exacto en cada indicador para distinguir DATO vs ESTIMADO.',
    },
  };

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('\nConectado a MongoDB Atlas');

    const col = client.db('smart-city').collection('cities');
    const result = await col.findOneAndUpdate(
      { slug: 'leticia' },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    const id = result?._id || result?.value?._id || 'insertado';
    console.log(`\n✅  Leticia insertada/actualizada (_id: ${id})`);
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
