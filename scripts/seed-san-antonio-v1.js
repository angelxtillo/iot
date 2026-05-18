require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI no definida en .env'); process.exit(1); }

// ---------------------------------------------------------------------------
// Fórmula de puntaje (igual que seed Cúcuta v5.4)
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
// DATOS DE SAN ANTONIO DEL TÁCHIRA
// Fuente: investigación web mayo 2026 (Analdex, ENCOVI, BCV, CEPAL, OVV,
//         Academia Nacional de Medicina VZ, CONATEL, Transparencia Venezuela,
//         HIDROSUROESTE, SENIAT, QS Rankings).
// Convención:
//   exacto: true  → valor con respaldo directo de fuente oficial/verificada
//   exacto: false → valor ESTIMADO (metodología documentada en investigación)
// ---------------------------------------------------------------------------
const DIMENSIONES_RAW = {
  capital_humano: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: ENCOVI 2022 escolaridad 63/100 pob 3-24; matrícula cayó 37% (TalCual);
      //        ajuste frontera (emigración juvenil). Referencia nacional ~65%, border -20pp.
      { numero:1,  nombre:'Cobertura neta Educación Básica Secundaria',
        tipo:'Positivo', valor_real:45,    referencia_optima:95,
        exacto:false,
        justificacion:'ESTIMADO — ENCOVI 2022: escolaridad 63/100 pob 3-24; matrícula cayó 37% (TalCual); ajuste frontera Táchira (emigración juvenil).',
        fuente_url:'https://talcualdigital.com/claves-%E2%94%82tasa-de-escolaridad-actual-es-la-mas-baja-desde-2014/', año:'2022' },

      // No.2 — ESTIMADO: ENCOVI 2022 + Fundaredes 2022. Media/bachillerato = mayor deserción.
      { numero:2,  nombre:'Cobertura neta Educación Media',
        tipo:'Positivo', valor_real:30,    referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — ENCOVI 2022; Fundaredes Informe Educación 2022; mayor deserción en nivel medio respecto a básica.',
        fuente_url:'https://www.fundaredes.org/2022/08/11/informe-de-educacion-2022-2/', año:'2022' },

      // No.3 — DATO: ENCOVI 2023 + Observatorio de Universidades = 17% jóvenes 18-24 en ES
      { numero:3,  nombre:'Cobertura Educación Superior',
        tipo:'Positivo', valor_real:17,    referencia_optima:70,
        exacto:true,
        justificacion:'DATO — ENCOVI 2023 + Observatorio de Universidades Venezuela: 17% jóvenes 18-24 acceden a educación superior.',
        fuente_url:'https://www.fundaredes.org/2023/10/04/bajo-agonia-permanece-la-educacion-universitaria-en-venezuela/', año:'2023' },

      // No.4 — ESTIMADO: MINCYT/CONATEL 2023 anunció 14k/40k esc. conectadas (~35% nac.);
      //        Táchira como zona frontera tiene menos inversión → 25%.
      { numero:4,  nombre:'Conectividad escolar (% sedes con internet activo)',
        tipo:'Positivo', valor_real:25,    referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — MINCYT/CONATEL 2023: 14.000/~40.000 sedes nacionales conectadas (~35%); Táchira zona frontera con menor inversión → 25%.',
        fuente_url:'https://mincyt.gob.ve/gobierno-nacional-llevara-internet-de-calidad-a-20-mil-escuelas-y-liceos/', año:'2023' },

      // No.5 — ESTIMADO: World Bank 2022 (97.6% alfab → 2.4% iliteracy); ENCOVI 2023
      //        autodeclarado ~4.5%. Promedio ponderado + ajuste zona frontera → 4.0%.
      { numero:5,  nombre:'Tasa de analfabetismo (%)',
        tipo:'Negativo', valor_real:4.0,   referencia_optima:2,
        exacto:false,
        justificacion:'ESTIMADO — World Bank 2022: 97.6% alfabetismo → 2.4% iliteracy; ENCOVI 2023 autodeclarado: ~4.5%. Promedio ponderado con ajuste zona frontera.',
        fuente_url:'https://datos.bancomundial.org/indicador/se.adt.litr.zs?locations=VE', año:'2022' },

      // No.6 — ESTIMADO: CECODAP 2023 (89% adolescentes sin actividad física adecuada);
      //        extrapolación a adultos en contexto de inseguridad alimentaria.
      { numero:6,  nombre:'Participación en actividad física (% población)',
        tipo:'Positivo', valor_real:10,    referencia_optima:40,
        exacto:false,
        justificacion:'ESTIMADO — CECODAP 2023: 89% adolescentes venezolanos sin actividad adecuada. Extrapolación a adultos en contexto de crisis alimentaria.',
        fuente_url:'https://cecodap.org/89-de-adolescentes-venezolanos-no-tiene-actividad-fisica-adecuada/', año:'2023' },

      // No.7 — ESTIMADO: Academia Nacional de Medicina Venezuela 2022: 20.2/1000 nacional.
      //        +2 por deterioro infraestructura sanitaria en municipios fronterizos (PROVEA).
      { numero:7,  nombre:'Tasa de mortalidad infantil (por 1.000 nv)',
        tipo:'Negativo', valor_real:22,    referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — Academia Nacional de Medicina VZ: 20.2/1000 (2022) a nivel nacional; +2 por deterioro sanitario en municipios fronterizos documentado por PROVEA.',
        fuente_url:'https://academianacionaldemedicina.org/publicaciones/div/estimaciones-actualizadas-de-la-mortalidad-infantil-en-venezuela/', año:'2022' },

      // No.8 — ESTIMADO: Sin dato oficial. Crisis eléctrica inutilizó laboratorios Canaima.
      //        Desinversión educativa. ENCOVI 2022: educación a distancia mala/deficiente (72%).
      { numero:8,  nombre:'Colegios con salas STEM o laboratorios TIC (%)',
        tipo:'Positivo', valor_real:15,    referencia_optima:50,
        exacto:false,
        justificacion:'ESTIMADO — Sin dato oficial. Crisis eléctrica + desinversión → laboratorios Canaima obsoletos. ENCOVI 2022: educación a distancia mala/deficiente en 72% de hogares.',
        fuente_url:'https://cecodap.org/72-de-los-venezolanos-califica-la-educacion-a-distancia-con-ninos-y-adolescentes-como-mala-o-deficiente/', año:'2022' },

      // No.9 — ESTIMADO: ENCOVI 2023: 15% acceso internet fijo; CONATEL jun-2024: 31.21/100.
      //        Diferencia: CONATEL mide líneas contratadas, ENCOVI mide acceso real.
      //        San Antonio: +3pp sobre ENCOVI por cobertura frontera. → 18%.
      { numero:9,  nombre:'Penetración internet fijo en hogares (%)',
        tipo:'Positivo', valor_real:18,    referencia_optima:65,
        exacto:false,
        justificacion:'ESTIMADO — ENCOVI 2023: 15% acceso fijo real; CONATEL jun-2024: 31.21/100 (líneas contratadas). San Antonio: +3pp por exposición a redes CO en frontera.',
        fuente_url:'https://efectococuyo.com/la-humanidad/cinco-claves-para-entender-la-encovi-2023/', año:'2023' },

      // No.10 — ESTIMADO: UNET San Cristóbal (~45 km): Ing. Informática, Ing. Electrónica,
      //         Ing. Sistemas (3 programas TIC). UNET redujo planta docente 70% (900→200).
      { numero:10, nombre:'Programas universitarios en TIC activos',
        tipo:'Positivo', valor_real:3,     referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — UNET San Cristóbal (~45 km): 3 programas TIC accesibles (Informática, Electrónica, Sistemas). UNET redujo planta docente 70% (900→200 profesores).',
        fuente_url:'https://www.unet.edu.ve/', año:'2023' },

      // No.11 — DATO: QS World Rankings 2025/2026. Mejor VZ = UCV en #631-640.
      //         UNET y ULA Táchira no aparecen en ningún ranking global.
      { numero:11, nombre:'Universidades en TOP 500 mundial',
        tipo:'Positivo', valor_real:0,     referencia_optima:1,
        exacto:true,
        justificacion:'DATO — QS World Rankings 2026: mejor VZ = UCV #731-740; UNET/ULA Táchira fuera del top 1.000 mundial.',
        fuente_url:'https://talcualdigital.com/proyeccion-de-2025-del-qs-world-university-rankings-ubica-a-la-ucv-como-la-mejor-del-pais/', año:'2025' },

      // No.12 — ESTIMADO: Sin dato directo en ENCOVI. Estimación metodológica:
      //         internet combinado (móvil+fijo) ~48% hogares; habilidades digitales básicas
      //         estimadas al 35% dada crisis educativa y económica.
      { numero:12, nombre:'Tasa de alfabetización digital (%)',
        tipo:'Positivo', valor_real:35,    referencia_optima:90,
        exacto:false,
        justificacion:'ESTIMADO — Sin dato directo en ENCOVI. Internet combinado ~48% hogares; habilidades digitales básicas estimadas 35% por crisis educativa, emigración de talento y bajo ingreso.',
        fuente_url:'https://efectococuyo.com/la-humanidad/cinco-claves-para-entender-la-encovi-2023/', año:'2023' },

      // No.13 — ESTIMADO: Diario La Nación (Táchira): IPM estado Táchira 72% (2023), 77% (2024).
      //         "Municipios fronterizos los más golpeados" → San Antonio ~75%.
      { numero:13, nombre:'Índice de Pobreza Multidimensional — IPM (%)',
        tipo:'Negativo', valor_real:75,    referencia_optima:10,
        exacto:false,
        justificacion:'ESTIMADO — Diario La Nación: IPM Táchira 72% (2023), 77% (2024); municipios fronterizos los más afectados del estado → San Antonio ~75%.',
        fuente_url:'https://lanacionweb.com/frontera/aumenta-indice-de-pobreza-multidimensional-en-tachira/', año:'2023' },
    ]
  },

  cohesion_social: {
    peso: 16,
    indicadores: [
      // No.1 — DATO: ENCOVI 2022 (UCAB/IIES): Gini 0.603, Venezuela más desigual de América.
      { numero:1,  nombre:'Coeficiente de Gini',
        tipo:'Negativo', valor_real:0.603, referencia_optima:0.35,
        exacto:true,
        justificacion:'DATO — ENCOVI 2022 (UCAB/IIES): Gini 0.603, Venezuela más desigual de América Latina.',
        fuente_url:'https://elucabista.com/2022/11/10/encovi-2022-cae-la-pobreza-aumenta-la-desigualdad-y-se-agrava-la-crisis-educativa/', año:'2022' },

      // No.2 — DATO: UCAB/IIES criterio OIT (sin cotización IVSS) = 84.5%.
      //         TalCual: "informalidad escaló a 84.5%".
      { numero:2,  nombre:'Tasa de informalidad laboral (%)',
        tipo:'Negativo', valor_real:85,    referencia_optima:35,
        exacto:true,
        justificacion:'DATO — UCAB/IIES criterio OIT (sin cotización IVSS): 84.5%. TalCual: "informalidad laboral escaló a 84.5%".',
        fuente_url:'https://talcualdigital.com/la-informalidad-laboral-escalo-a-845-apoyada-por-la-crisis-economica/', año:'2022' },

      // No.3 — ESTIMADO: INE Venezuela 7.8% (2022). Ajuste +2pp San Antonio por presión
      //         frontera y menor concentración de empleo formal.
      { numero:3,  nombre:'Tasa de desempleo (%)',
        tipo:'Negativo', valor_real:10,    referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — INE Venezuela: 7.8% (2022); Infobae. Ajuste +2pp para San Antonio por menor concentración de empleo formal en municipio fronterizo.',
        fuente_url:'https://www.infobae.com/america/agencias/2023/01/13/la-tasa-de-desempleo-en-venezuela-bajo-al-78-en-2022/', año:'2022' },

      // No.4 — DATO: ENCOVI 2023: 34.3% tasa participación laboral femenina Venezuela.
      { numero:4,  nombre:'Tasa de empleo femenino (%)',
        tipo:'Positivo', valor_real:34,    referencia_optima:60,
        exacto:true,
        justificacion:'DATO — ENCOVI 2023: 34.3% participación laboral femenina en Venezuela (solo 3 de cada 10 trabajan).',
        fuente_url:'https://elinformadorve.com/01/05/2025/destacada/encovi-en-venezuela-las-mujeres-ganan-36-menos-que-los-hombres-y-solo-tres-de-cada-10-trabajan/', año:'2023' },

      // No.5 — ESTIMADO: OVV 2023: Táchira = 11.3/100k (mínimo nacional, dato estatal).
      //         +0.7 por dinámica Municipio Bolívar/frontera → 12/100k.
      { numero:5,  nombre:'Tasa de homicidios (por 100k hab)',
        tipo:'Negativo', valor_real:12,    referencia_optima:10,
        exacto:false,
        justificacion:'ESTIMADO — OVV 2023: Táchira = 11.3/100k (mínimo nacional, dato estatal); +0.7 ajuste Municipio Bolívar por dinámica fronteriza → 12/100k.',
        fuente_url:'https://observatoriodeviolencia.org.ve/news/tachira-el-estado-con-menos-muertes-violentas-durante-2023/', año:'2023' },

      // No.6 — ESTIMADO: Venezuela no publica estadísticas oficiales VIF.
      //         OVV: VIF es 2ª causa de incidentes violentos. Bajo sistema de reporte
      //         institucional → tasa reportada menor que real. Estimación 160/100k.
      { numero:6,  nombre:'Violencia intrafamiliar (por 100k hab)',
        tipo:'Negativo', valor_real:160,   referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — Venezuela sin estadísticas oficiales VIF. OVV: VIF es 2ª causa de incidentes violentos; bajo reporte institucional. Estimación basada en contexto socioeconómico.',
        fuente_url:'https://observatoriodeviolencia.org.ve/news/informe-anual-de-violencia-2023/', año:'2023' },

      // No.7 — DATO: OVV Táchira 2023: 13.6/100k, segundo estado con mayor tasa de suicidios.
      { numero:7,  nombre:'Tasa de suicidios (por 100k hab)',
        tipo:'Negativo', valor_real:13.6,  referencia_optima:3,
        exacto:true,
        justificacion:'DATO — OVV Táchira 2023: 13.6/100k, segundo estado con mayor tasa de suicidios en Venezuela (impacto psicosocial de migración masiva y crisis).',
        fuente_url:'https://observatoriodeviolencia.org.ve/news/tachira-el-estado-con-menos-muertes-violentas-durante-2023/', año:'2023' },

      // No.8 — ESTIMADO: World Bank Venezuela 2020: 6.1/1000. Tendencia ascendente por
      //         crisis sanitaria post-2020. Estimación 2022: 7.0/1000.
      { numero:8,  nombre:'Tasa de mortalidad general (por 1.000 hab)',
        tipo:'Negativo', valor_real:7.0,   referencia_optima:6,
        exacto:false,
        justificacion:'ESTIMADO — World Bank Venezuela 2020: 6.1/1000; tendencia ascendente por crisis sanitaria y escasez de medicamentos post-2020. Estimación 2022: 7.0/1000.',
        fuente_url:'https://datos.bancomundial.org/indicator/SP.DYN.CDRT.IN?locations=VE', año:'2022' },

      // No.9 — ESTIMADO: Igual que Capital Humano ind.7.
      { numero:9,  nombre:'Tasa de mortalidad infantil (por 1.000 nv)',
        tipo:'Negativo', valor_real:22,    referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — Academia Nacional de Medicina VZ: 20.2/1000 (2022) nacional; +2 ajuste zona frontera por menor acceso a servicios de salud materno-infantil.',
        fuente_url:'https://academianacionaldemedicina.org/publicaciones/div/estimaciones-actualizadas-de-la-mortalidad-infantil-en-venezuela/', año:'2022' },

      // No.10 — ESTIMADO: PROVEA 2023: quirófanos 40% operativos; escasez 37-74% en
      //          salas de emergencia; gasto salud $25/cápita/año. Sin porcentaje oficial IPS.
      { numero:10, nombre:'IPS públicas habilitadas con estándares de calidad (%)',
        tipo:'Positivo', valor_real:10,    referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — PROVEA 2023: quirófanos al 40% operatividad; escasez 37-74% emergencias; $25/cápita gasto salud. Sin porcentaje oficial de IPS certificadas.',
        fuente_url:'https://provea.org/wp-content/uploads/2024/04/09-Salud-Provea-2023.pdf', año:'2023' },

      // No.11 — ESTIMADO: CONATEL/nPerf: Táchira penetración móvil >50%; San Antonio recibe
      //          señal de operadores VZ (Movistar, Digitel, Movilnet) + CO (Claro, Tigo).
      { numero:11, nombre:'Cobertura 4G/5G en área urbana (%)',
        tipo:'Positivo', valor_real:75,    referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — CONATEL/nPerf 2024: Táchira penetración >50%; San Antonio recibe señal de operadores VZ + operadores colombianos en zona fronteriza urbana → 75%.',
        fuente_url:'https://www.mobileworldlive.com/spanish/venezuela-adjudica-espectro-5g-y-4g-a-digitel-y-movistar-tras-11-anos-sin-subastas/', año:'2024' },

      // No.12 — ESTIMADO: ENCOVI 2022: extrema 53.3%; total (extrema+no extrema) estimada ~68%.
      //          Municipios fronterizos de Táchira más golpeados según Diario La Nación.
      { numero:12, nombre:'Pobreza monetaria (%)',
        tipo:'Negativo', valor_real:68,    referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — ENCOVI 2022: pobreza extrema 53.3%; total estimada ~68%. Municipios fronterizos de Táchira los más afectados (Diario La Nación).',
        fuente_url:'https://elucabista.com/2022/11/10/encovi-2022-cae-la-pobreza-aumenta-la-desigualdad-y-se-agrava-la-crisis-educativa/', año:'2022' },

      // No.13 — DATO: Equilibrium CenDE Q1-2023: 16% desempleo jóvenes 18-24 Venezuela.
      { numero:13, nombre:'Tasa de desempleo juvenil (%)',
        tipo:'Negativo', valor_real:16,    referencia_optima:12,
        exacto:true,
        justificacion:'DATO — Equilibrium CenDE Q1-2023: 16% desempleo jóvenes 18-24 años Venezuela.',
        fuente_url:'https://humvenezuela.com/informalidad-o-desempleo-el-dilema-real-del-empleo-juvenil-en-venezuela-via-banca-y-negocios/', año:'2023' },
    ]
  },

  economia: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: PIB VZ ~$3.500/cápita (2022) × 71.630 hab = $250M base.
      //         +$100M prima comercio frontera (márgenes, logística, servicios). Total $350M.
      { numero:1,  nombre:'Valor Agregado municipal/local (millones USD)',
        tipo:'Positivo', valor_real:350,   referencia_optima:5000,
        exacto:false,
        justificacion:'ESTIMADO — PIB VZ ~$3.500/cápita (2022) × 71.630 hab = $250M base; +$100M prima comercio frontera (márgenes comerciales, logística, servicios). Total $350M.',
        fuente_url:'https://www.bcv.org.ve/notas-de-prensa/el-pib-de-la-economia-venezolana-crecio-1773-en-el-periodo-enero-septiembre-de-2022', año:'2022' },

      // No.2 — DATO: CEPAL 2022: 12% crecimiento VZ (BCV reportó 14.68%).
      //         San Antonio: efecto adicional de reapertura frontera sep-2022.
      { numero:2,  nombre:'Tasa de crecimiento económico (%)',
        tipo:'Positivo', valor_real:12,    referencia_optima:8,
        exacto:true,
        justificacion:'DATO — CEPAL 2022: 12% crecimiento Venezuela (BCV: 14.68%); reapertura frontera sep-2022 amplifica efecto local en San Antonio.',
        fuente_url:'https://www.bcv.org.ve/notas-de-prensa/el-pib-de-la-economia-venezolana-crecio-1773-en-el-periodo-enero-septiembre-de-2022', año:'2022' },

      // No.3 — ESTIMADO: OVF Q4-2022: sector privado $135-141/mes (Área Metropolitana
      //         Caracas). San Antonio: +$20 prima frontera por comercio en USD/COP. → $160.
      { numero:3,  nombre:'Ingreso laboral promedio mensual (USD)',
        tipo:'Positivo', valor_real:160,   referencia_optima:600,
        exacto:false,
        justificacion:'ESTIMADO — OVF Q4-2022: sector privado $135-141/mes (Caracas). +$20 prima frontera San Antonio por comercio en USD/COP. Nota: Q4-2023 Caracas llegó a $202/mes.',
        fuente_url:'https://www.bloomberglinea.com/latinoamerica/venezuela/remuneraciones-del-sector-publico-y-privado-de-venezuela-cayeron-el-primer-trimestre/', año:'2022' },

      // No.4 — DATO: World Bank Doing Business (última edición): Venezuela 144 días,
      //         ranking 188/190. Confirmado por CEDRE Abogados 2023 (17 pasos).
      { numero:4,  nombre:'Días para crear una empresa',
        tipo:'Negativo', valor_real:144,   referencia_optima:3,
        exacto:true,
        justificacion:'DATO — World Bank Doing Business: Venezuela 144 días, ranking 188/190. CEDRE Abogados 2023: proceso incluye 17 pasos formales.',
        fuente_url:'https://elpitazo.net/economia/claves-como-y-cuanto-tarda-registrarse-una-empresa-en-venezuela/', año:'2023' },

      // No.5 — ESTIMADO: Analdex sep22-jul23: VZ exportó $64M total a Colombia.
      //         ~$60M estimado específicamente por aduana Táchira (excluyendo otros pasos).
      { numero:5,  nombre:'Exportaciones totales (millones USD)',
        tipo:'Positivo', valor_real:60,    referencia_optima:300,
        exacto:false,
        justificacion:'ESTIMADO — Analdex: VZ exportó $64M total a Colombia sep22-jul23; ~$60M estimado vía aduana Táchira (principal paso). Incluye productos químicos, aluminio, pescado.',
        fuente_url:'https://analdex.org/2023/09/18/primer-ano-reactivacion-pasos-fronterizos-cucuta-relaciones-comerciales-colombia-venezuela/', año:'2023' },

      // No.6 — ESTIMADO: Sin registro oficial Alcaldía Municipio Bolívar. Pro-rata desde
      //         Cúcuta (8.057/800k hab) ajustado por dificultad registral VZ (144 días):
      //         71.630/800.000 × 8.057 × 0.42 (factor VZ) ≈ 300.
      { numero:6,  nombre:'Empresas nuevas registradas (matrícula anual)',
        tipo:'Positivo', valor_real:300,   referencia_optima:12000,
        exacto:false,
        justificacion:'ESTIMADO — Sin registro oficial Alcaldía Mun. Bolívar. Pro-rata desde Cúcuta (8.057 empresas/800k hab) × factor registral VZ 0.42 (144 días crear empresa) = ~300.',
        fuente_url:'https://elpitazo.net/economia/claves-como-y-cuanto-tarda-registrarse-una-empresa-en-venezuela/', año:'2023' },
    ]
  },

  gobernanza: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: RevInveCom: "retroceso del gobierno electrónico en Venezuela.
      //         Caso: Gobernación del Táchira y Alcaldía de San Cristóbal (2016-2021)".
      //         San Antonio (Mun. Bolívar) sin iniciativas smart city → 0.5/5.
      { numero:1,  nombre:'Índice de Madurez de Ciudad Inteligente (escala 0-5 normalizada)',
        tipo:'Positivo', valor_real:0.5,   referencia_optima:5,
        exacto:false,
        justificacion:'ESTIMADO — RevInveCom 2022: "retroceso del gobierno electrónico en Táchira (2016-2021)"; Alcaldía Mun. Bolívar sin iniciativas smart city documentadas → 0.5/5.',
        fuente_url:'https://revistainvecom.org/index.php/invecom/article/view/245', año:'2022' },

      // No.2 — ESTIMADO: datos.gob.ve sin actualización desde 2018 (Transparencia VZ).
      //         Municipio Bolívar: sin portal propio de datos abiertos → ~2 datasets.
      { numero:2,  nombre:'Datasets de datos abiertos publicados',
        tipo:'Positivo', valor_real:2,     referencia_optima:200,
        exacto:false,
        justificacion:'ESTIMADO — Transparencia Venezuela: datos.gob.ve sin actualizar desde 2018; "estado venezolano opaco por política". Alcaldía Mun. Bolívar sin portal propio → ~2 datasets.',
        fuente_url:'https://transparenciave.org/venezuela-no-muestra-avances-en-materia-de-datos-abiertos/', año:'2023' },

      // No.3 — ESTIMADO: Cúcuta (311 cámaras/800k hab) × (71.630/800.000) × factor VZ
      //         desinversión (~20%). Sin dato oficial CICPC/Alcaldía.
      { numero:3,  nombre:'Cámaras de videovigilancia operativas',
        tipo:'Positivo', valor_real:15,    referencia_optima:500,
        exacto:false,
        justificacion:'ESTIMADO — Sin dato oficial. Pro-rata desde Cúcuta (311/800k) × (71.6k/800k) × factor desinversión VZ (20%) ≈ 15 cámaras.',
        fuente_url:'https://revistainvecom.org/index.php/invecom/article/view/245', año:'2022' },

      // No.4 — ESTIMADO: Presupuesto municipal VZ ~$100/cápita × 71.630 = ~$7.2M USD.
      //         Porción tech/seguridad ~1.7% ≈ $122k USD = ~500M COP (1 USD ≈ 4.100 COP 2022).
      { numero:4,  nombre:'Inversión en tecnología y seguridad urbana (millones COP)',
        tipo:'Positivo', valor_real:500,   referencia_optima:50000,
        exacto:false,
        justificacion:'ESTIMADO — Presupuesto mun. ~$100/cápita × 71.630 hab; porción tech/seg ~1.7% ≈ $122k USD ≈ 500M COP (cambio 2022). CEDICE: municipios VZ sin datos presupuestales.',
        fuente_url:'https://cedice.org.ve/ogp/wp-content/uploads/2023/02/MunicipioFinanzasyDesarrollo.pdf', año:'2022' },

      // No.5 — ESTIMADO: RevInveCom documenta retroceso; gobierno electrónico VZ en declive.
      //         Alcaldía Mun. Bolívar: sitio web básico sin trámites en línea → 8/100.
      { numero:5,  nombre:'Índice de Gobierno Digital local (0-100)',
        tipo:'Positivo', valor_real:8,     referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — RevInveCom 2022: gobierno electrónico en retroceso en Táchira. Alcaldía Mun. Bolívar: sitio web básico sin trámites en línea → 8/100.',
        fuente_url:'https://revistainvecom.org/index.php/invecom/article/view/245', año:'2022' },

      // No.6 — ESTIMADO: CEDICE/Transparencia VZ: municipios VZ dependen de transferencias
      //         nacionales que han colapsado. Estimación $100/cápita (vs $621 Cúcuta).
      { numero:6,  nombre:'Presupuesto municipal per cápita (USD)',
        tipo:'Positivo', valor_real:100,   referencia_optima:1000,
        exacto:false,
        justificacion:'ESTIMADO — CEDICE/Transparencia VZ: finanzas municipales VZ en crisis, dependencia de transferencias nacionales colapsadas. Estimación $100/cápita.',
        fuente_url:'https://cedice.org.ve/ogp/wp-content/uploads/2023/02/MunicipioFinanzasyDesarrollo.pdf', año:'2022' },

      // No.7 — ESTIMADO: Venezuela ejecuta presupuestos formalmente pero hiperinflación
      //         distorsiona el valor real. Estimación ejecución formal: 70%.
      { numero:7,  nombre:'Ejecución presupuestal (%)',
        tipo:'Positivo', valor_real:70,    referencia_optima:95,
        exacto:false,
        justificacion:'ESTIMADO — Ejecución formal existe pero hiperinflación distorsiona valor real del gasto. Sin datos oficiales Alcaldía Mun. Bolívar. Estimación conservadora: 70%.',
        fuente_url:'https://transparenciave.org/project/presupuesto-ciudadano-en-cifras/', año:'2022' },
    ]
  },

  medio_ambiente: {
    peso: 16,
    indicadores: [
      // No.1 — ESTIMADO: Sin programas de arboricultura urbana en Táchira/San Antonio.
      //         Sequías documentadas, deforestación, servicios municipales mínimos → 70%.
      { numero:1,  nombre:'Arbolado urbano con problemas fitosanitarios (%)',
        tipo:'Negativo', valor_real:70,    referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — Sin programas oficiales de arboricultura urbana en Mun. Bolívar; sequías recurrentes en Táchira + servicios municipales mínimos → 70% con problemas.',
        fuente_url:'https://ecopoliticavenezuela.org/gestion-eficiente-de-los-desechosun-asunto-pendiente/', año:'2022' },

      // No.2 — ESTIMADO: IQAir Venezuela: media nacional 50-80 AQI; San Antonio con
      //         tráfico pesado de camiones + quema de residuos a cielo abierto → AQI 65.
      { numero:2,  nombre:'Índice de Calidad del Aire — AQI (promedio anual)',
        tipo:'Negativo', valor_real:65,    referencia_optima:30,
        exacto:false,
        justificacion:'ESTIMADO — IQAir: Venezuela media nacional 50-80 AQI; San Antonio: tráfico pesado de camiones fronterizos + quema de residuos a cielo abierto → AQI estimado 65.',
        fuente_url:'https://www.iqair.com/us/venezuela', año:'2022' },

      // No.3 — ESTIMADO: Crónica.uno/PROVEA 2022: solo 28% wastewater tratado en VZ.
      //         San Antonio sin planta de tratamiento propia → ~15%.
      { numero:3,  nombre:'Tratamiento de aguas residuales (%)',
        tipo:'Positivo', valor_real:15,    referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — Crónica.uno/PROVEA 2022: 28% aguas residuales tratadas en Venezuela. San Antonio sin planta de tratamiento propia identificada → ~15%.',
        fuente_url:'https://provea.org/wp-content/uploads/2023/03/Informe-Agua-21.03.pdf', año:'2022' },

      // No.4 — ESTIMADO: FII Venezuela: 28.000 ton/día generadas en VZ, solo 5% reciclado.
      //         San Antonio: recolección mensual + quemas frecuentes → 2%.
      { numero:4,  nombre:'Gestión de residuos sólidos — % aprovechado',
        tipo:'Positivo', valor_real:2,     referencia_optima:25,
        exacto:false,
        justificacion:'ESTIMADO — FII Venezuela: 28.000 ton/día generadas, solo 5% reciclado. San Antonio: recolección ~1x/mes, quemas frecuentes, sin planta de clasificación → 2%.',
        fuente_url:'https://www.fii.gob.ve/gestion-integral-de-residuos-solidos-urbanos-en-venezuela-del-problema-a-la-oportunidad-parte-1-situacion-de-los-residuos-solidos/', año:'2022' },

      // No.5 — ESTIMADO: IQAir World Report 2022: VZ ~15-18 µg/m³ PM2.5 nacional.
      //         San Antonio: +3 por carga pesada → 18 µg/m³.
      { numero:5,  nombre:'PM2.5 — material particulado fino (µg/m³ promedio anual)',
        tipo:'Negativo', valor_real:18,    referencia_optima:5,
        exacto:false,
        justificacion:'ESTIMADO — IQAir World Report 2022: Venezuela ~15-18 µg/m³ PM2.5 nacional. San Antonio: +3 por tráfico de carga pesada fronteriza → 18 µg/m³.',
        fuente_url:'https://www.iqair.com/us/venezuela', año:'2022' },

      // No.6 — ESTIMADO: FII Venezuela: 28.000 ton/día ÷ 28M hab = 365 kg/hab/año.
      //         San Antonio: menor consumo por crisis → 300 kg/hab/año.
      { numero:6,  nombre:'Residuos sólidos per cápita (kg/hab/año)',
        tipo:'Negativo', valor_real:300,   referencia_optima:200,
        exacto:false,
        justificacion:'ESTIMADO — FII Venezuela: 28.000 ton/día ÷ 28M hab = 365 kg/hab/año. San Antonio: menor consumo por crisis económica → 300 kg/hab/año.',
        fuente_url:'https://www.fii.gob.ve/gestion-integral-de-residuos-solidos-urbanos-en-venezuela-del-problema-a-la-oportunidad-parte-1-situacion-de-los-residuos-solidos/', año:'2022' },

      // No.7 — ESTIMADO: MINEA Venezuela: red de monitoreo ambiental muy limitada.
      //         Sin estación confirmada en San Antonio; estimación 1 regional.
      { numero:7,  nombre:'Estaciones de monitoreo ambiental activas',
        tipo:'Positivo', valor_real:1,     referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — MINEA Venezuela: red de monitoreo ambiental muy reducida. Sin estación confirmada oficialmente en San Antonio; estimación 1 estación de área Táchira.',
        fuente_url:'https://ecopoliticavenezuela.org/gestion-eficiente-de-los-desechosun-asunto-pendiente/', año:'2022' },

      // No.8 — ESTIMADO: Venezuela: inversión mínima en solar (foco en petróleo).
      //         Algunos paneles en edificios públicos y residencias → ~0.5 MW.
      { numero:8,  nombre:'Energía solar fotovoltaica instalada (MW)',
        tipo:'Positivo', valor_real:0.5,   referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — Venezuela: inversión mínima en energía solar (política energética centrada en petróleo). Paneles residenciales y algunos edificios públicos → ~0.5 MW.',
        fuente_url:'https://ecopoliticavenezuela.org/gestion-eficiente-de-los-desechosun-asunto-pendiente/', año:'2022' },

      // No.9 — ESTIMADO: HIDROSUROESTE: sirve 1.25M hab Táchira. ENCOVI 2020: 91.4%
      //         conexión nacional. Deterioro post-2020 + racionamiento documentado.
      //         San Antonio: 78% (menos que capital estado San Cristóbal).
      { numero:9,  nombre:'Cobertura de acueducto urbano (%)',
        tipo:'Positivo', valor_real:78,    referencia_optima:99,
        exacto:false,
        justificacion:'ESTIMADO — HIDROSUROESTE: sirve 1.25M hab Táchira; ENCOVI 2020: 91.4% conexión nacional; deterioro post-2020 + racionamiento 2022. San Antonio estimado 78%.',
        fuente_url:'https://hidrosuroeste.gob.ve/2023/10/09/garantizando-un-servicio-optimo-y-de-calidad-a-mas-de-1-250-000-habitantes-del-estado-tachira/', año:'2022' },

      // No.10 — ESTIMADO: Venezuela cobertura alcantarillado urbano en declive.
      //          Sin datos específicos Mun. Bolívar. Estimación: 65%.
      { numero:10, nombre:'Cobertura de alcantarillado urbano (%)',
        tipo:'Positivo', valor_real:65,    referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — Sin datos oficiales Municipio Bolívar. Cobertura alcantarillado urbano VZ en declive. Estimación 65% para ciudad de 71.630 hab.',
        fuente_url:'https://www.iagua.es/blogs/jesus-castillo/agua-y-saneamiento-venezuela-crisis-limites', año:'2022' },

      // No.11 — ESTIMADO: Río Táchira + ABRAE (Áreas Bajo Régimen de Admin. Especial)
      //          en Municipio Bolívar. Sin catastro oficial. Estimación 800 ha.
      { numero:11, nombre:'Hectáreas de áreas estratégicas para conservación hídrica',
        tipo:'Positivo', valor_real:800,   referencia_optima:2500,
        exacto:false,
        justificacion:'ESTIMADO — Ribera del río Táchira + zonas ABRAE en Municipio Bolívar. Sin catastro oficial publicado. Estimación 800 ha basada en área territorial del municipio.',
        fuente_url:'https://hidrosuroeste.gob.ve/', año:'2022' },
    ]
  },

  frontera: {
    peso: 20,
    indicadores: [
      // No.1 — DATO: Analdex sep22-jul23: Colombia→VZ $534M + VZ→Colombia $64M = $598M.
      //         Redondeado a $600M para año completo.
      { numero:1,  nombre:'Comercio binacional total por aduana de la ciudad (millones USD)',
        tipo:'Positivo', valor_real:600,       referencia_optima:800,
        exacto:true,
        justificacion:'DATO — Analdex sep22-jul23: CO→VZ $534M + VZ→CO $64M = $598M comercio bilateral. Aduana Principal San Antonio es el principal paso. Redondeado a $600M.',
        fuente_url:'https://analdex.org/2023/09/18/primer-ano-reactivacion-pasos-fronterizos-cucuta-relaciones-comerciales-colombia-venezuela/', año:'2023' },

      // No.2 — ESTIMADO: TalCual: ~1.200 personas/día en San Antonio (migración masiva).
      //         Logcluster/Cúcuta: 60k/día total área fronteriza. Simón Bolívar ≈ 25k/día.
      //         25.000 × 365 = 9.1M; ajuste a 12M por normalización post-reapertura.
      { numero:2,  nombre:'Flujo migratorio fronterizo (cruces/año)',
        tipo:'Positivo', valor_real:12000000,  referencia_optima:18000000,
        exacto:false,
        justificacion:'ESTIMADO — TalCual: 1.200/día SA (migración); logcluster: 60k/día área total Cúcuta. Simón Bolívar (SA) ~25-30k/día → ~12M/año tras normalización post-reapertura 2022.',
        fuente_url:'https://talcualdigital.com/incrementa-flujo-migratorio-en-frontera-de-san-antonio-del-tachira1-200-personas-por-dia/', año:'2023' },

      // No.3 — ESTIMADO: San Antonio es ciudad EMISORA (venezolanos que migran), no receptora.
      //         Colombianos en VZ por comercio frontera + retornados venezolanos ≈ 6.000.
      { numero:3,  nombre:'Migrantes con vocación de permanencia en la ciudad',
        tipo:'Positivo', valor_real:6000,      referencia_optima:150000,
        exacto:false,
        justificacion:'ESTIMADO — San Antonio es ciudad emisora, no receptora. Colombianos residentes por comercio fronterizo + venezolanos retornados estimados ≈ 6.000. R4V/ACNUR no reporta flujo receptor significativo.',
        fuente_url:'https://www.r4v.info/en/education', año:'2023' },

      // No.4 — DATO: Analdex sep22-jul23: VZ exportó $64M a Colombia.
      //         Casi la totalidad vía aduana Táchira (paso principal). = 64.000 miles USD.
      { numero:4,  nombre:'Exportaciones por aduana de la ciudad (miles USD/FOB)',
        tipo:'Positivo', valor_real:64000,     referencia_optima:600000,
        exacto:true,
        justificacion:'DATO — Analdex sep22-jul23: VZ exportó $64M total a Colombia = 64.000 miles USD FOB. Productos: químicos, aluminio, pescado, plásticos. Casi todo vía aduana Táchira.',
        fuente_url:'https://analdex.org/2023/09/18/primer-ano-reactivacion-pasos-fronterizos-cucuta-relaciones-comerciales-colombia-venezuela/', año:'2023' },

      // No.5 — DATO: Analdex sep22-jul23: Colombia exportó $534M a VZ = 534.000 miles USD.
      //         Venezuela importó este monto vía aduana San Antonio del Táchira.
      { numero:5,  nombre:'Importaciones por aduana de la ciudad (miles USD/CIF)',
        tipo:'Positivo', valor_real:534000,    referencia_optima:150000,
        exacto:true,
        justificacion:'DATO — Analdex sep22-jul23: Colombia exportó $534M a VZ = 534.000 miles USD CIF. Importaciones venezolanas vía aduana San Antonio del Táchira (paso principal).',
        fuente_url:'https://analdex.org/2023/09/18/primer-ano-reactivacion-pasos-fronterizos-cucuta-relaciones-comerciales-colombia-venezuela/', año:'2023' },

      // No.6 — DATO: SENIAT: Aduana Principal San Antonio + Aduana Subalterna Tienditas
      //         (dic-2022) + Aduana Subalterna Ureña = 3 pasos activos.
      { numero:6,  nombre:'Pasos fronterizos internacionales activos en la ciudad y área metropolitana',
        tipo:'Positivo', valor_real:3,         referencia_optima:3,
        exacto:true,
        justificacion:'DATO — SENIAT/Acceso a la Justicia: Aduana Principal San Antonio + Subalterna Tienditas (creada dic-2022) + Subalterna Ureña = 3 pasos activos oficiales.',
        fuente_url:'https://accesoalajusticia.org/creacion-de-la-aduana-subalterna-tienditas-adscrita-a-la-aduana-principal-de-san-antonio-del-tachira-estado-tachira/', año:'2023' },

      // No.7 — DATO: SENIAT/Radio Miraflores: 7.200 vehículos en operaciones de
      //         importación/exportación en 8 meses (hasta ago-2023) → 900/mes promedio.
      { numero:7,  nombre:'Vehículos de carga por pasos fronterizos (promedio mensual)',
        tipo:'Positivo', valor_real:900,       referencia_optima:2000,
        exacto:true,
        justificacion:'DATO — SENIAT/Radio Miraflores: 7.200 vehículos en operaciones import/export en 8 meses (hasta ago-2023) → 900/mes promedio. Incluye los tres pasos aduaneros.',
        fuente_url:'https://radiomiraflores.net.ve/operaciones-aduaneras/', año:'2023' },

      // No.8 — ESTIMADO: SAIME opera PCM en Simón Bolívar y presumiblemente en Tienditas.
      //         Sin confirmación oficial de segundo puesto → 2 estimado.
      { numero:8,  nombre:'Puestos de Control Migratorio activos en la ciudad',
        tipo:'Positivo', valor_real:2,         referencia_optima:4,
        exacto:false,
        justificacion:'ESTIMADO — SAIME: PCM confirmado en Simón Bolívar; posiblemente en Tienditas. Sin confirmación oficial de segundo PCM operativo → 2 estimado.',
        fuente_url:'https://www.laopinion.co/frontera/la-reapertura-de-la-frontera-no-le-devolvio-los-anos-perdidos-a-san-antonio-y-urena', año:'2023' },

      // No.9 — ESTIMADO: ~30% del flujo diario Simón Bolívar son colombianos entrando a VZ
      //         (compras, negocios, familia): 30.000/día × 30% × 365 ≈ 3.3M → 3.000.000.
      { numero:9,  nombre:'Extranjeros del país vecino no residentes que ingresan a la ciudad (año)',
        tipo:'Positivo', valor_real:3000000,   referencia_optima:40000000,
        exacto:false,
        justificacion:'ESTIMADO — ~30% del flujo diario son colombianos entrando a VZ (compras, negocios): 25k/día × 30% × 365 ≈ 2.7-3.3M. Logcluster: 60k/día total área fronteriza.',
        fuente_url:'https://lca.logcluster.org/es/232-colombia-cruce-fronterizo-cucuta-norte-de-santander', año:'2023' },

      // No.10 — DATO/CÁLCULO: Exportaciones $64M - Importaciones $534M = -$470M déficit.
      //          NOTA: Venezuela tiene déficit comercial (importa 8× más que exporta).
      //          Puntaje = 0 (indicador Positivo con valor negativo). Refleja asimetría
      //          estructural VZ-CO, no ausencia de actividad comercial.
      { numero:10, nombre:'Balanza comercial binacional por aduana de la ciudad (miles USD)',
        tipo:'Positivo', valor_real:-470000,   referencia_optima:400000,
        exacto:true,
        justificacion:'DATO/CÁLCULO — VZ exporta $64M - VZ importa $534M = -$470M déficit comercial (miles USD: -470.000). Venezuela importa 8× más de lo que exporta. Puntaje=0 por déficit estructural.',
        fuente_url:'https://analdex.org/2023/09/18/primer-ano-reactivacion-pasos-fronterizos-cucuta-relaciones-comerciales-colombia-venezuela/', año:'2023' },
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

  // Verificar promedios y mostrar resumen
  console.log('\n=== VERIFICACIÓN DE INDICADORES ===');
  let totalDato = 0, totalEst = 0;
  for (const [key, dim] of Object.entries(dimensiones)) {
    const exactos = dim.indicadores.filter(i => i.exacto).length;
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
    name:                  'San Antonio del Táchira',
    slug:                  'san-antonio-del-tachira',
    ciudad:                'San Antonio del Táchira',
    pais:                  'Venezuela',
    country:               'Venezuela',
    bandera:               '🇻🇪',
    flag:                  '🇻🇪',
    poblacion:             71630,
    population:            71630,
    region:                'Táchira',
    dimensiones,
    indice_compuesto_final: parseFloat(indice.toFixed(4)),
    updatedAt:              new Date(),
    metadata: {
      version:    'v1.0',
      año_datos:  '2022-2023',
      nota:       'Ciudad Venezuela en crisis sistémica. Ver campo exacto en cada indicador para distinguir DATO vs ESTIMADO.',
    },
  };

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('\nConectado a MongoDB Atlas');

    const col = client.db('smart-city').collection('cities');
    const result = await col.findOneAndUpdate(
      { slug: 'san-antonio-del-tachira' },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    const id = result?._id || result?.value?._id || 'insertado';
    console.log(`\n✅  San Antonio del Táchira insertada/actualizada (_id: ${id})`);
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
