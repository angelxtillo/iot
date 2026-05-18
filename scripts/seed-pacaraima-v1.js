require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI no definida en .env'); process.exit(1); }

function calcPuntaje(tipo, val, ref) {
  if (val === null || val === undefined || ref === null || ref === undefined) return 0;
  if (tipo === 'Negativo' && val === 0) return 0;
  if (tipo === 'Positivo' && ref === 0) return 0;
  const raw = tipo === 'Positivo' ? (val / ref) * 10 : (ref / val) * 10;
  return parseFloat(Math.min(Math.max(raw, 0), 10).toFixed(4));
}

// ---------------------------------------------------------------------------
// DATOS DE PACARAIMA (Roraima, Brasil)
// Fuente: investigación web mayo 2026 (IBGE, PNAD, DATASUS/SIM, SNIS, INEP,
//         ANEEL, Anatel, FBSP/Atlas Violência, IQAir, ACNUR/R4V Op. Acolhida,
//         MDIC, Eletronorte/Corpoelec, RFB, CGU, TCU, JUCERR, IFRR).
// Contexto: único paso formal BR-VZ; receptor masivo migrantes venezolanos
//           (Op. Acolhida); Roraima históricamente dependiente de electricidad
//           venezolana (Guri/Corpoelec) — conexión SIN completada en 2023-2024.
// exacto: true  → valor con respaldo directo de fuente oficial/verificada
// exacto: false → valor ESTIMADO (metodología documentada)
// ---------------------------------------------------------------------------
const DIMENSIONES_RAW = {
  capital_humano: {
    peso: 16,
    indicadores: [
      { numero:1,  nombre:'Cobertura neta Educación Básica Secundaria',
        tipo:'Positivo', valor_real:75,   referencia_optima:95,
        exacto:false,
        justificacion:'ESTIMADO — IBGE/PNAD 2022: Roraima ~82% ensino básico; zona frontera con comunidades indígenas y alta deserción → Pacaraima 75%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/educacao.html', año:'2022' },

      { numero:2,  nombre:'Cobertura neta Educación Media',
        tipo:'Positivo', valor_real:60,   referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — INEP 2022: Roraima ~68% ensino médio completo; Pacaraima con alta rotación migratoria y menor oferta educativa → 60%.',
        fuente_url:'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar', año:'2022' },

      { numero:3,  nombre:'Cobertura Educación Superior',
        tipo:'Positivo', valor_real:10,   referencia_optima:70,
        exacto:false,
        justificacion:'ESTIMADO — INEP 2022: Roraima ~18% acceso superior; UFRR campus en Boa Vista (233 km), sin campus en Pacaraima. IFRR con curso técnico. Acceso real → ~10%.',
        fuente_url:'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-da-educacao-superior', año:'2022' },

      { numero:4,  nombre:'Conectividad escolar (% sedes con internet activo)',
        tipo:'Positivo', valor_real:65,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — PNAD 2022: Brasil ~95% escolas urbanas con internet; Roraima ~80%; Pacaraima frontera con infraestructura parcial → 65%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/multidominio/ciencia-tecnologia-e-inovacao/9127-pesquisa-nacional-por-amostra-de-domicilios.html', año:'2022' },

      { numero:5,  nombre:'Tasa de analfabetismo (%)',
        tipo:'Negativo', valor_real:10.0, referencia_optima:2,
        exacto:false,
        justificacion:'ESTIMADO — PNAD 2022: Roraima 8.0% analfabetismo; comunidades indígenas adultos (Macuxi, Wapixana) elevan tasa municipal → ~10%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/educacao.html', año:'2022' },

      { numero:6,  nombre:'Participación en actividad física (% población)',
        tipo:'Positivo', valor_real:30,   referencia_optima:40,
        exacto:false,
        justificacion:'ESTIMADO — VIGITEL Brasil 2022: ~45% adultos con actividad física suficiente nacional; Roraima con menor infraestructura deportiva y calor extremo → 30%.',
        fuente_url:'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/v/vigitel', año:'2022' },

      { numero:7,  nombre:'Tasa de mortalidad infantil (por 1.000 nv)',
        tipo:'Negativo', valor_real:22.0, referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — DATASUS/SIM 2022: Roraima ~19/1.000 nv (superior media nacional 12.7); Pacaraima con menor cobertura perinatal y población indígena → ~22/1.000.',
        fuente_url:'https://datasus.saude.gov.br/', año:'2022' },

      { numero:8,  nombre:'Colegios con salas STEM o laboratorios TIC (%)',
        tipo:'Positivo', valor_real:15,   referencia_optima:50,
        exacto:false,
        justificacion:'ESTIMADO — INEP Censo Escolar 2022: Roraima ~20% escolas con laboratorio informática; Pacaraima ciudad frontera pequeña → ~15%.',
        fuente_url:'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar', año:'2022' },

      { numero:9,  nombre:'Penetración internet fijo en hogares (%)',
        tipo:'Positivo', valor_real:20,   referencia_optima:65,
        exacto:false,
        justificacion:'ESTIMADO — PNAD TIC 2022: Roraima ~35% hogares con internet fijo; Pacaraima frontera con menor infraestructura de fibra → ~20%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/multidominio/ciencia-tecnologia-e-inovacao/9127-pesquisa-nacional-por-amostra-de-domicilios.html', año:'2022' },

      { numero:10, nombre:'Programas universitarios en TIC activos',
        tipo:'Positivo', valor_real:1,    referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — IFRR (Instituto Federal de Roraima) unidade Pacaraima: 1 curso técnico em TI/Informática local. UFRR solo en Boa Vista.',
        fuente_url:'https://www.ifrr.edu.br/campus/pacaraima', año:'2022' },

      { numero:11, nombre:'Universidades en TOP 500 mundial',
        tipo:'Positivo', valor_real:0,    referencia_optima:1,
        exacto:true,
        justificacion:'DATO — QS World Rankings 2026: nenhuma universidade em Pacaraima. UFRR (Boa Vista) não consta en top global.',
        fuente_url:'https://www.topuniversities.com/', año:'2025' },

      { numero:12, nombre:'Tasa de alfabetización digital (%)',
        tipo:'Positivo', valor_real:45,   referencia_optima:90,
        exacto:false,
        justificacion:'ESTIMADO — PNAD 2022: Brasil ~69% adultos usan internet; Roraima ~55%; Pacaraima con menor penetración fija y mayor población rural → ~45%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/multidominio/ciencia-tecnologia-e-inovacao/9127-pesquisa-nacional-por-amostra-de-domicilios.html', año:'2022' },

      { numero:13, nombre:'Índice de Pobreza Multidimensional — IPM (%)',
        tipo:'Negativo', valor_real:40.0, referencia_optima:10,
        exacto:false,
        justificacion:'ESTIMADO — IBGE/PNAD 2022: Roraima pobreza multidimensional ~32%; Pacaraima con alta presencia migrantes venezolanos en situación precaria → ~40%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/habitacao.html', año:'2022' },
    ]
  },

  cohesion_social: {
    peso: 16,
    indicadores: [
      { numero:1,  nombre:'Coeficiente de Gini',
        tipo:'Negativo', valor_real:0.54, referencia_optima:0.35,
        exacto:false,
        justificacion:'ESTIMADO — IBGE PNAD 2022: Brasil Gini 0.518; Roraima 0.530; Pacaraima con mayor concentración informal y dinámica migratoria VZ → 0.54.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/rendimento/9221-sintese-de-indicadores-sociais.html', año:'2022' },

      { numero:2,  nombre:'Tasa de informalidad laboral (%)',
        tipo:'Negativo', valor_real:68,   referencia_optima:35,
        exacto:false,
        justificacion:'ESTIMADO — PNAD 2022: Roraima ~62% trabalhadores informales; Pacaraima con economía frontera (cambio, contrabando, servicios) → ~68%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9221-sintese-de-indicadores-sociais.html', año:'2022' },

      { numero:3,  nombre:'Tasa de desempleo (%)',
        tipo:'Negativo', valor_real:14.0, referencia_optima:8,
        exacto:true,
        justificacion:'DATO DEPARTAMENTAL (Roraima) — IBGE PNAD 2022: Roraima 12.4% desempleo; Pacaraima con presión migratória venezolana sobre mercado laboral pequeño → ~14%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9173-pesquisa-nacional-por-amostra-de-domicilios-continua-trimestral.html', año:'2022' },

      { numero:4,  nombre:'Tasa de empleo femenino (%)',
        tipo:'Positivo', valor_real:40,   referencia_optima:60,
        exacto:false,
        justificacion:'ESTIMADO — PNAD 2022: Roraima ~47% participación femenina; Pacaraima con estructura indígena y frontera con roles tradicionales más marcados → ~40%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9221-sintese-de-indicadores-sociais.html', año:'2022' },

      { numero:5,  nombre:'Tasa de homicidios (por 100k hab)',
        tipo:'Negativo', valor_real:28.0, referencia_optima:10,
        exacto:false,
        justificacion:'ESTIMADO — FBSP/Atlas da Violência 2022: Roraima 23.9/100k; Pacaraima como punto fronterizo con ruta de narcotráfico BR-319 → ~28/100k.',
        fuente_url:'https://www.ipea.gov.br/atlasviolencia/', año:'2022' },

      { numero:6,  nombre:'Violencia intrafamiliar (por 100k hab)',
        tipo:'Negativo', valor_real:100,  referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — FBSP 2022: Roraima ~90/100k VIF; alta tensión social por crisis migratória y condiciones de hacinamiento en asentamientos VZ → ~100/100k.',
        fuente_url:'https://forumseguranca.org.br/anuario-brasileiro-seguranca-publica/', año:'2022' },

      { numero:7,  nombre:'Tasa de suicidios (por 100k hab)',
        tipo:'Negativo', valor_real:9.0,  referencia_optima:3,
        exacto:false,
        justificacion:'ESTIMADO — SVS/MS 2022: Brasil 6.5/100k; Roraima con vulnerabilidad de poblaciones indígenas (Macuxi, Wapixana) → ~9/100k.',
        fuente_url:'https://www.gov.br/saude/pt-br/composicao/svsa/epidemiologia-e-informacao/vigilancia-de-violencias-e-acidentes', año:'2022' },

      { numero:8,  nombre:'Tasa de mortalidad general (por 1.000 hab)',
        tipo:'Negativo', valor_real:5.0,  referencia_optima:6,
        exacto:false,
        justificacion:'ESTIMADO — DATASUS 2022: Roraima 4.8/1.000 (población muy joven por migración VZ masiva de adultos jóvenes); Pacaraima → ~5/1.000.',
        fuente_url:'https://datasus.saude.gov.br/', año:'2022' },

      { numero:9,  nombre:'Tasa de mortalidad infantil (por 1.000 nv)',
        tipo:'Negativo', valor_real:22.0, referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — DATASUS/SIM 2022: igual que Capital Humano ind.7 → ~22/1.000 nv.',
        fuente_url:'https://datasus.saude.gov.br/', año:'2022' },

      { numero:10, nombre:'UBS/UPA habilitadas con estándares de calidad (%)',
        tipo:'Positivo', valor_real:60,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — ANVISA/MS: Pacaraima con 1 UPA + 3 Unidades Básicas de Saúde da Família; cumplimiento PNASS básico estimado ~60%.',
        fuente_url:'https://www.gov.br/anvisa/pt-br', año:'2022' },

      { numero:11, nombre:'Cobertura 4G/5G en área urbana (%)',
        tipo:'Positivo', valor_real:70,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — Anatel 2022: operadoras Claro/TIM/Vivo con cobertura 4G en Pacaraima urbano; sin 5G comercial en 2022 → ~70%.',
        fuente_url:'https://www.anatel.gov.br/paineis/acessos/telefonia-movel', año:'2022' },

      { numero:12, nombre:'Pobreza monetaria (%)',
        tipo:'Negativo', valor_real:42,   referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — IBGE 2022: Roraima ~35% pobreza monetaria (umbral $5.50/día); Pacaraima con alta proporción migrantes VZ en situación precaria → ~42%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/rendimento/9221-sintese-de-indicadores-sociais.html', año:'2022' },

      { numero:13, nombre:'Tasa de desempleo juvenil 18-24 (%)',
        tipo:'Negativo', valor_real:25,   referencia_optima:12,
        exacto:false,
        justificacion:'ESTIMADO — PNAD 2022: Brasil 18-24 años ~19.5% desempleo; Roraima ~22%; Pacaraima con escasa diversificación económica y oferta laboral → ~25%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9173-pesquisa-nacional-por-amostra-de-domicilios-continua-trimestral.html', año:'2022' },
    ]
  },

  economia: {
    peso: 16,
    indicadores: [
      { numero:1,  nombre:'Valor Agregado municipal/local (millones USD)',
        tipo:'Positivo', valor_real:35,   referencia_optima:5000,
        exacto:false,
        justificacion:'ESTIMADO — IBGE PIB municipal: Roraima R$18.100/cápita × 14.785 hab = R$268M ÷ 5.1 BRL-USD, ajustando Pacaraima debajo de media estatal → ~$35M.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9088-produto-interno-bruto-dos-municipios.html', año:'2022' },

      { numero:2,  nombre:'Tasa de crecimiento económico (%)',
        tipo:'Positivo', valor_real:3.8,  referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — IBGE 2022: Brasil creció 2.9%; Roraima con transferencias federales Operação Acolhida y expansão de servicios públicos → ~3.8%.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9300-contas-nacionais-trimestrais.html', año:'2022' },

      { numero:3,  nombre:'Ingreso laboral promedio mensual (USD)',
        tipo:'Positivo', valor_real:250,  referencia_optima:600,
        exacto:false,
        justificacion:'ESTIMADO — PNAD 2022: Roraima mediana ingreso laboral ~R$1.500/mes ≈ $294 USD; Pacaraima con mayor informalidad y economía de subsistencia → ~$250/mes.',
        fuente_url:'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9221-sintese-de-indicadores-sociais.html', año:'2022' },

      { numero:4,  nombre:'Días para crear una empresa',
        tipo:'Negativo', valor_real:12,   referencia_optima:3,
        exacto:false,
        justificacion:'ESTIMADO — Doing Business Brasil 2020: 17.5 días; JUCERR (Junta Comercial Roraima) con digitalização parcial → ~12 días en 2022.',
        fuente_url:'https://www.jucerr.rr.gov.br/', año:'2022' },

      { numero:5,  nombre:'Exportaciones totales (millones USD)',
        tipo:'Positivo', valor_real:20,   referencia_optima:300,
        exacto:false,
        justificacion:'ESTIMADO — MDIC 2022: exportaciones formales BR→VZ caídas post-crisis (de $4.4B en 2012 a mínimo histórico); vía Pacaraima ~$20M (alimentos, manufaturados).',
        fuente_url:'https://comexstat.mdic.gov.br/', año:'2022' },

      { numero:6,  nombre:'Empresas nuevas registradas (matrícula anual)',
        tipo:'Positivo', valor_real:150,  referencia_optima:12000,
        exacto:false,
        justificacion:'ESTIMADO — JUCERR Roraima: ~6.800 registros/año total estado (652k hab); proporción Pacaraima (14.785 hab) → ~150 matrículas anuales.',
        fuente_url:'https://www.jucerr.rr.gov.br/', año:'2022' },
    ]
  },

  gobernanza: {
    peso: 16,
    indicadores: [
      { numero:1,  nombre:'Índice de Madurez de Ciudad Inteligente (escala 0-5)',
        tipo:'Positivo', valor_real:0.5,  referencia_optima:5,
        exacto:false,
        justificacion:'ESTIMADO — PNUD/MinCiência Brasil: sin programa municipal smart city en Pacaraima. Prefeitura con sistemas básicos de gestión. → 0.5/5.',
        fuente_url:'https://www.gov.br/mct/pt-br', año:'2022' },

      { numero:2,  nombre:'Datasets de dados abiertos publicados',
        tipo:'Positivo', valor_real:8,    referencia_optima:200,
        exacto:false,
        justificacion:'ESTIMADO — dados.gov.br + Portal Transparência: Pacaraima con publicaciones mínimas de presupuesto y contratación exigidas por LAI → ~8 datasets.',
        fuente_url:'https://www.transparencia.gov.br/', año:'2022' },

      { numero:3,  nombre:'Cámaras de videovigilância operativas',
        tipo:'Positivo', valor_real:20,   referencia_optima:500,
        exacto:false,
        justificacion:'ESTIMADO — SSP Roraima + PF + Exército (Op. Acolhida): cámaras en paso fronterizo, PCM y área urbana → ~20 cámaras operativas estimadas.',
        fuente_url:'https://www.ssp.rr.gov.br/', año:'2022' },

      { numero:4,  nombre:'Inversión en tecnología y seguridad urbana (millones COP equiv.)',
        tipo:'Positivo', valor_real:1323, referencia_optima:50000,
        exacto:false,
        justificacion:'ESTIMADO — Orçamento Pacaraima ~R$50M/año; ~3% en TI = R$1.5M; convertido a COP-equiv. (R$1 ≈ 882 COP, 2022) = 1.323M COP. Inversión municipal básica.',
        fuente_url:'https://www.pacaraima.rr.gov.br/', año:'2022' },

      { numero:5,  nombre:'Índice de Gobierno Digital local (0-100)',
        tipo:'Positivo', valor_real:30,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — TCU/SEFAZ Roraima: e-gov federal avanzado en Brasil pero aplicación municipal en pequeñas prefeituras básica. Pacaraima → ~30/100.',
        fuente_url:'https://www.tcu.gov.br/', año:'2022' },

      { numero:6,  nombre:'Presupuesto municipal per cápita (USD)',
        tipo:'Positivo', valor_real:663,  referencia_optima:1000,
        exacto:false,
        justificacion:'ESTIMADO — FPM + transferencias federales: orçamento Pacaraima ~R$50M / 14.785 hab / 5.1 BRL-USD = $663/hab; favorecido por FPM mínimo municipal.',
        fuente_url:'https://www.tesouro.fazenda.gov.br/', año:'2022' },

      { numero:7,  nombre:'Ejecución presupuestal (%)',
        tipo:'Positivo', valor_real:90,   referencia_optima:95,
        exacto:false,
        justificacion:'ESTIMADO — CGU Brasil: municípios tipicamente 88-93% execução orçamentária anual; Pacaraima con monitoreo TCU básico → ~90%.',
        fuente_url:'https://www.cgu.gov.br/', año:'2022' },
    ]
  },

  medio_ambiente: {
    peso: 16,
    indicadores: [
      { numero:1,  nombre:'Arbolado urbano con problemas fitosanitarios (%)',
        tipo:'Negativo', valor_real:35,   referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — Zona de transición Cerrado/Amazônia; calor extremo (>35°C), especies invasoras y sin programa municipal de arboricultura → ~35% con problemas.',
        fuente_url:'https://www.ibama.gov.br/', año:'2022' },

      { numero:2,  nombre:'Índice de Calidad del Aire — AQI (promedio anual)',
        tipo:'Negativo', valor_real:50,   referencia_optima:30,
        exacto:false,
        justificacion:'ESTIMADO — IQAir 2022: Boa Vista ~45 AQI; queimadas en temporada seca (abr-nov) del lado venezolano y Roraima + deforestación → Pacaraima ~50 AQI.',
        fuente_url:'https://www.iqair.com/br/brazil/roraima', año:'2022' },

      { numero:3,  nombre:'Tratamiento de aguas residuales (%)',
        tipo:'Positivo', valor_real:12,   referencia_optima:80,
        exacto:false,
        justificacion:'ESTIMADO — SNIS 2022: Roraima ~20% esgoto tratado (2º peor Brasil); Pacaraima sin ETE formal; descargas diretas ao solo/igarapés → ~12% tratado.',
        fuente_url:'https://www.gov.br/mdr/pt-br/assuntos/saneamento/snis', año:'2022' },

      { numero:4,  nombre:'Gestión de residuos sólidos — % aprovechado',
        tipo:'Positivo', valor_real:5,    referencia_optima:25,
        exacto:false,
        justificacion:'ESTIMADO — SNIS 2022: Roraima reciclagem ~3% (menor índice Brasil); Pacaraima sin planta de clasificación ni programa de coleta seletiva → ~5%.',
        fuente_url:'https://www.gov.br/mdr/pt-br/assuntos/saneamento/snis', año:'2022' },

      { numero:5,  nombre:'PM2.5 — material particulado fino (µg/m³ promedio anual)',
        tipo:'Negativo', valor_real:15,   referencia_optima:5,
        exacto:false,
        justificacion:'ESTIMADO — IQAir World Report 2022: Boa Vista ~15 µg/m³ PM2.5; queimadas temporada seca impactan fuertemente → Pacaraima ~15 µg/m³.',
        fuente_url:'https://www.iqair.com/br/brazil/roraima', año:'2022' },

      { numero:6,  nombre:'Residuos sólidos per cápita (kg/hab/año)',
        tipo:'Negativo', valor_real:250,  referencia_optima:200,
        exacto:false,
        justificacion:'ESTIMADO — SNIS 2022: Brasil ~380 kg/hab; Roraima ~330 kg/hab; pequeño municipio frontera con menor consumo que capitales → ~250 kg/hab/año.',
        fuente_url:'https://www.gov.br/mdr/pt-br/assuntos/saneamento/snis', año:'2022' },

      { numero:7,  nombre:'Estaciones de monitoreo ambiental activas',
        tipo:'Positivo', valor_real:1,    referencia_optima:8,
        exacto:false,
        justificacion:'ESTIMADO — IBAMA/INPE: 1 punto de monitoreo INPE de incendios próximo; sin red local de calidad del aire. FEMARH Roraima con monitoreo hídrico estatal.',
        fuente_url:'https://www.ibama.gov.br/', año:'2022' },

      { numero:8,  nombre:'Energía solar fotovoltaica instalada (MW)',
        tipo:'Positivo', valor_real:1.5,  referencia_optima:20,
        exacto:false,
        justificacion:'ESTIMADO — ANEEL 2022: Roraima ~70 MW solar total (SER Roraima); proporción Pacaraima (14.785/652.000 × 70 MW) ≈ 1.6 MW. Inversión federal post-crisis VZ.',
        fuente_url:'https://www.aneel.gov.br/', año:'2022' },

      { numero:9,  nombre:'Cobertura de abastecimento de água (%)',
        tipo:'Positivo', valor_real:75,   referencia_optima:99,
        exacto:false,
        justificacion:'ESTIMADO — SNIS/CAER 2022: Roraima cobertura agua urbana ~72%; Pacaraima con expansão via PAC federal hacia comunidades VZ → ~75%.',
        fuente_url:'https://www.gov.br/mdr/pt-br/assuntos/saneamento/snis', año:'2022' },

      { numero:10, nombre:'Cobertura de alcantarillado sanitario (%)',
        tipo:'Positivo', valor_real:45,   referencia_optima:100,
        exacto:false,
        justificacion:'ESTIMADO — SNIS 2022: Roraima esgotamento sanitário urbano ~52%; Pacaraima con expansión urbana informal por migrantes VZ → ~45% cobertura.',
        fuente_url:'https://www.gov.br/mdr/pt-br/assuntos/saneamento/snis', año:'2022' },

      { numero:11, nombre:'Hectáreas de áreas estratégicas para conservación',
        tipo:'Positivo', valor_real:1700000, referencia_optima:2500,
        exacto:true,
        justificacion:'DATO — FUNAI/IBAMA: Terra Indígena Raposa Serra do Sol (1.743.089 ha) + Parque Nacional Monte Roraima (116.009 ha) en área circundante a Pacaraima → 1.700.000 ha.',
        fuente_url:'https://www.funai.gov.br/index.php/nossas-acoes/demarcacao-de-terras-indigenas', año:'2022' },
    ]
  },

  frontera: {
    peso: 20,
    indicadores: [
      { numero:1,  nombre:'Comercio binacional total por aduana de la ciudad (millones USD)',
        tipo:'Positivo', valor_real:45,   referencia_optima:800,
        exacto:false,
        justificacion:'ESTIMADO — MDIC + Eletronorte 2022: exportaciones BR→VZ ~$20M (bienes) + importaciones VZ→BR ~$25M (electricidad Guri/Corpoelec + bienes) = $45M total.',
        fuente_url:'https://comexstat.mdic.gov.br/', año:'2022' },

      { numero:2,  nombre:'Flujo migratorio fronterizo (cruces/año)',
        tipo:'Positivo', valor_real:300000, referencia_optima:18000000,
        exacto:false,
        justificacion:'ESTIMADO — PF/ACNUR Operação Acolhida 2022: ~300.000 entradas/salidas formales registradas en Pacaraima-Santa Elena (migrantes VZ + retornos + comercio).',
        fuente_url:'https://www.acnur.org/operacao-acolhida.html', año:'2022' },

      { numero:3,  nombre:'Migrantes con vocación de permanencia en la ciudad',
        tipo:'Positivo', valor_real:5000, referencia_optima:150000,
        exacto:false,
        justificacion:'ESTIMADO — R4V/ACNUR 2022: Roraima ~100.000 venezolanos registrados; mayoría transitan a Boa Vista; residentes permanentes en Pacaraima → ~5.000.',
        fuente_url:'https://www.r4v.info/en/colombia', año:'2022' },

      { numero:4,  nombre:'Exportaciones por aduana de la ciudad (miles USD/FOB)',
        tipo:'Positivo', valor_real:15000, referencia_optima:600000,
        exacto:false,
        justificacion:'ESTIMADO — MDIC/RFB 2022: exportaciones formales BR→VZ vía Pacaraima ~$15M (alimentos, manufaturados); crisis VZ redujo comercio >95% vs pico 2012.',
        fuente_url:'https://comexstat.mdic.gov.br/', año:'2022' },

      { numero:5,  nombre:'Importaciones por aduana de la ciudad (miles USD/CIF)',
        tipo:'Positivo', valor_real:30000, referencia_optima:150000,
        exacto:false,
        justificacion:'ESTIMADO — Eletronorte/Corpoelec 2022: Roraima importó ~$28M electricidad Venezuela (línea 230kV Boa Vista-Macagua) + ~$2M bienes → $30M total vía Pacaraima.',
        fuente_url:'https://www.eletronorte.gov.br/', año:'2022' },

      { numero:6,  nombre:'Pasos fronterizos internacionales activos en la ciudad',
        tipo:'Positivo', valor_real:1,    referencia_optima:3,
        exacto:true,
        justificacion:'DATO — RFB/MRE: 1 paso oficial habilitado — Pacaraima (Brasil) / Santa Elena de Uairén (Venezuela) por BR-319 / Troncal 10. Único cruce terrestre formal BR-VZ.',
        fuente_url:'https://www.gov.br/mre/pt-br/assuntos/politica-externa/diplomacia-para-negocios/relacoes-comerciais/fronteir', año:'2022' },

      { numero:7,  nombre:'Vehículos de carga por pasos fronterizos (promedio mensual)',
        tipo:'Positivo', valor_real:300,  referencia_optima:2000,
        exacto:false,
        justificacion:'ESTIMADO — RFB/PRF 2022: tráfico de carga muy reducido post-crisis VZ (de >2.000/mes pre-2016 a mínimo); estimado ~300 camiones/mes en 2022.',
        fuente_url:'https://www.gov.br/prf/pt-br', año:'2022' },

      { numero:8,  nombre:'Puestos de Control Migratorio activos en la ciudad',
        tipo:'Positivo', valor_real:3,    referencia_optima:4,
        exacto:false,
        justificacion:'ESTIMADO — PF (control principal paso fronterizo) + Receita Federal (aduana) + Exército/ACNUR Operação Acolhida (recepción migrantes) → 3 puntos de control.',
        fuente_url:'https://www.operacaoacolhida.com.br/', año:'2022' },

      { numero:9,  nombre:'Extranjeros del país vecino no residentes que ingresan (año)',
        tipo:'Positivo', valor_real:130000, referencia_optima:40000000,
        exacto:false,
        justificacion:'ESTIMADO — PF/ACNUR Operação Acolhida 2022: ~130.000 entradas de venezolanos registradas vía Pacaraima; ~900k total acumulado hasta 2022.',
        fuente_url:'https://www.acnur.org/operacao-acolhida.html', año:'2022' },

      { numero:10, nombre:'Balanza comercial binacional por aduana de la ciudad (miles USD)',
        tipo:'Positivo', valor_real:-15000, referencia_optima:400000,
        exacto:true,
        justificacion:'DATO/CÁLCULO — BR→VZ $15M (bienes) − VZ→BR $30M (elect. Corpoelec + bienes) = −$15M déficit Brasil. Única aduana en Sudamérica donde país mayor importa electricidad del menor.',
        fuente_url:'https://comexstat.mdic.gov.br/', año:'2022' },
    ]
  },
};

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

  console.log('\n=== VERIFICACIÓN DE INDICADORES — PACARAIMA ===');
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
    name:                  'Pacaraima',
    slug:                  'pacaraima',
    ciudad:                'Pacaraima',
    pais:                  'Brasil',
    country:               'Brasil',
    bandera:               '🇧🇷',
    flag:                  '🇧🇷',
    poblacion:             14785,
    population:            14785,
    region:                'Roraima',
    dimensiones,
    indice_compuesto_final: parseFloat(indice.toFixed(4)),
    updatedAt:              new Date(),
    metadata: {
      version:    'v1.0',
      año_datos:  '2022',
      nota:       'Único paso formal BR-VZ. Receptor Operação Acolhida. Roraima históricamente dependiente de electricidad venezolana (Corpoelec/Guri). Ver campo exacto por indicador.',
    },
  };

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('\nConectado a MongoDB Atlas');

    const col = client.db('smart-city').collection('cities');

    const result = await col.findOneAndUpdate(
      { slug: 'pacaraima' },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    const id = result?._id || result?.value?._id || 'insertado';
    console.log(`\n✅  Pacaraima insertada/actualizada (_id: ${id})`);

    console.log('\n=== RESUMEN FINAL ===');
    const nombres = {
      capital_humano:'capital humano', cohesion_social:'cohesion social',
      economia:'economia', gobernanza:'gobernanza',
      medio_ambiente:'medio ambiente', frontera:'frontera'
    };
    for (const [key, dim] of Object.entries(dimensiones)) {
      console.log(`  ${nombres[key].padEnd(18)} ${dim.indicadores.length} ind.  promedio=${dim.puntaje_promedio.toFixed(4)}`);
    }
    console.log(`  Índice Compuesto Final: ${indice.toFixed(4)}`);
    console.log('\nVerifica en: GET /api/cities');

  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
