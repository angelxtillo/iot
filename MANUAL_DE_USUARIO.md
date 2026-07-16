# Manual de Usuario — ICCI

**Índice de Ciudad Inteligente para Ciudades de Frontera**

🌐 Plataforma en línea: **https://cucuta-smart-city.vercel.app**

---

## 1. ¿Qué es esta plataforma y para quién es?

El **ICCI** es una plataforma web que mide qué tan "inteligentes" son las ciudades de frontera de Latinoamérica, combinando indicadores de desarrollo urbano tradicional (educación, salud, seguridad, ambiente) con indicadores de tecnología y conectividad (sensores, redes, servicios digitales). Nació como proyecto de tesis de un equipo de 5 estudiantes de Ingeniería TIC: primero evaluó a **Cúcuta** (Colombia) y luego se expandió a un modelo comparativo regional.

Hoy la plataforma compara **6 ciudades fronterizas**:

| Ciudad | País | Frontera con |
|---|---|---|
| 🇨🇴 Cúcuta | Colombia | Venezuela |
| 🇻🇪 San Antonio del Táchira | Venezuela | Colombia |
| 🇨🇴 Ipiales | Colombia | Ecuador |
| 🇨🇴 Leticia | Colombia | Brasil y Perú (triple frontera) |
| 🇧🇷 Pacaraima | Brasil | Venezuela |
| 🇲🇽 Ciudad Juárez | México | Estados Unidos |

Lo que hace único al ICCI frente a otros índices de ciudad inteligente es su **dimensión Frontera** (con el mayor peso del modelo: 20 %), que mide realidades que solo viven estas ciudades: comercio binacional, flujos migratorios, pasos fronterizos e integración con la ciudad vecina.

**¿Para quién es?**

- **Autoridades locales y planificadores urbanos**: identificar fortalezas y brechas de su ciudad frente a otras ciudades de frontera comparables.
- **Investigadores y estudiantes**: cada indicador incluye su valor, fuente, año y justificación, listos para citar.
- **Periodistas y ciudadanía**: entender con datos cómo está su ciudad y en qué necesita mejorar.
- **Organismos de cooperación**: priorizar inversión en las dimensiones más débiles de la región fronteriza.

No se necesita instalación ni cuenta: basta abrir el enlace en cualquier navegador (funciona en computador, tablet y celular).

---

## 2. Cómo navegar la plataforma

La pantalla se divide en una **barra lateral** (izquierda) con el menú y un **área principal** (derecha) con el contenido. En celulares, la barra queda arriba.

### 2.1 Ranking Regional (vista inicial)

Es la tabla de clasificación de las 6 ciudades, ordenadas de mayor a menor **Índice Compuesto**. Las tres primeras llevan medalla (🥇🥈🥉). Cada fila muestra: bandera y nombre, barra de progreso con el puntaje, total sobre 10 y el **nivel** (Bajo … Muy Alto).

Qué puedes hacer aquí:

- **Buscar** una ciudad por nombre y **filtrar por país** con los controles de arriba.
- **Pasar el cursor** sobre una fila: aparece una tarjeta flotante con las 6 dimensiones de esa ciudad en mini-barras.
- **Seleccionar 1 ciudad** (clic en la fila o en su casilla): aparece un botón flotante "**Ver Resumen de …**" que abre su ficha completa.
- **Seleccionar 2 ciudades**: el botón flotante cambia a "**Comparar seleccionadas**" y te lleva a la comparación cara a cara. (El máximo es 2; las demás casillas se desactivan.)

### 2.2 Mapa

Mapa interactivo de Sudamérica y Norteamérica con un **punto de color** por ciudad: 🟢 verde si su índice es ≥ 7, 🟠 ámbar si está entre 4 y 6.9, 🔴 rojo si es menor a 4. Al hacer clic en un punto se abre una tarjeta con el puntaje total, el desglose de las 6 dimensiones y un botón **"Ver detalle →"** que abre el Resumen de esa ciudad. Puedes acercar/alejar con la rueda del ratón o los botones +/−.

### 2.3 Comparar Ciudades

Elige **Ciudad A** (azul) y **Ciudad B** (roja) en los dos buscadores. La vista muestra:

1. **Radar de dimensiones**: las dos ciudades superpuestas en un gráfico de araña de 6 ejes — de un vistazo se ve quién domina cada dimensión.
2. **Tabla de dimensiones**: puntaje de cada ciudad por dimensión, con una flecha (◀/▶) señalando a la ganadora, y el Índice Compuesto de ambas al final.
3. **Comparación indicador por indicador**: seis gráficos de barras horizontales (uno por dimensión) con cada indicador de ambas ciudades lado a lado. La línea punteada vertical marca el 5/10. Al pasar el cursor por una barra se ve el valor real, el puntaje y si el dato es confirmado o estimado.

### 2.4 Resumen de ciudad

Es la ficha completa de una ciudad (se llega desde el ranking, el mapa o el botón flotante). Contiene:

- **Encabezado**: bandera, nombre, región, Índice Compuesto grande con su color y nivel.
- **Gráfico de barras** con el puntaje de las 6 dimensiones.
- **Tabla consolidada**: por cada dimensión, cuántos indicadores tiene, su promedio (0–10), su peso y su aporte ponderado; al final, el Índice Compuesto Final.
- **Tabla de interpretación**: los 5 niveles de la escala, con la fila de la ciudad actual resaltada.
- **Detalle por dimensión**: una tarjeta por dimensión listando cada indicador con su semáforo, descripción, año, valor real vs. referencia óptima, puntaje con mini-barra y un enlace 🔗 a la fuente original.

Cuando la ciudad tiene cargado el modelo oficial de 60 indicadores, verás el distintivo verde "**Modelo oficial · 60 indicadores**". Mientras se selecciona una ciudad, la barra lateral muestra la tarjeta "**Ciudad activa**" con su puntaje y un botón para deseleccionarla.

### 2.5 Fórmulas de puntuación (barra lateral)

Al final de la barra lateral, el acordeón "**Fórmulas de puntuación**" muestra las dos fórmulas con que se puntúa cada indicador (ver sección 3).

---

## 3. Cómo interpretar los puntajes

### 3.1 El puntaje de cada indicador (0 a 10)

Cada indicador se compara contra una **referencia óptima** (el valor con el que se alcanza la nota perfecta) y se clasifica como:

- **Positivo ↑** — *más es mejor* (p. ej. cobertura de internet):
  `puntaje = (Valor Real ÷ Referencia Óptima) × 10`
- **Negativo ↓** — *menos es mejor* (p. ej. tasa de homicidios):
  `puntaje = (Referencia Óptima ÷ Valor Real) × 10`

En ambos casos el resultado se recorta al rango 0–10 (superar la referencia no da más de 10).

**Ejemplo:** si la tasa de homicidios de una ciudad es 36 por 100 mil habitantes y la referencia óptima es 12, su puntaje es (12 ÷ 36) × 10 = **3.33** — un indicador en rojo.

### 3.2 El semáforo de colores

Cada indicador y cada puntaje llevan un punto de color:

| Color | Rango | Significado |
|---|---|---|
| 🟢 Verde | 7.0 – 10.0 | Buen desempeño |
| 🟠 Ámbar | 4.0 – 6.9 | Desempeño medio |
| 🔴 Rojo | 0.0 – 3.9 | Requiere atención |
| ⚪ Gris | — | Sin dato disponible (N/D) |

### 3.3 Del indicador al Índice Compuesto

1. Los puntajes de los indicadores de una dimensión se **promedian** → puntaje de la dimensión (0–10).
2. Cada dimensión se multiplica por su **peso** y se suman los aportes → **Índice Compuesto** de la ciudad:

| Dimensión | Peso |
|---|---|
| Frontera | **20 %** |
| Capital Humano | 16 % |
| Cohesión Social | 16 % |
| Economía | 16 % |
| Gobernanza | 16 % |
| Medio Ambiente | 16 % |

### 3.4 Los niveles del índice

| Rango | Nivel | Qué significa |
|---|---|---|
| 0.0 – 3.9 | **Bajo** | Ciudad con desafíos críticos en múltiples dimensiones. |
| 4.0 – 5.9 | **Medio-Bajo** | Avances parciales; requiere mejoras sustanciales. |
| 6.0 – 7.4 | **Medio** | Ciudad en desarrollo con fortalezas sectoriales. |
| 7.5 – 8.9 | **Alto** | Ciudad inteligente consolidada con buenas prácticas. |
| 9.0 – 10.0 | **Muy Alto** | Ciudad de referencia global en inteligencia urbana. |

---

## 4. Las 6 dimensiones y sus indicadores

El modelo combina dos familias de indicadores: los **"Sostenibles"** (desarrollo urbano tradicional: educación, salud, seguridad, economía, ambiente) y los **"IoT"** (tecnología, sensores y conectividad: cobertura de red, trámites digitales, sensores ambientales, telemedicina). Cada dimensión mezcla ambas familias — la idea central del ICCI es que una ciudad inteligente de frontera necesita las dos.

A continuación, el catálogo de indicadores comparables entre las 6 ciudades (10 por dimensión). *Nota: las ciudades con el modelo oficial cargado (distintivo verde) pueden mostrar un conjunto ampliado de indicadores, con la misma lógica de cálculo.*

### 🚧 Frontera (peso 20 %) — el aporte original del proyecto

Mide el comercio binacional, el flujo migratorio y la integración con la ciudad vecina.

| Indicador | Tipo | Qué mide |
|---|---|---|
| Volumen comercio transfronterizo | ↑ | Valor total (millones USD/año) del comercio formal en el paso fronterizo. |
| Flujo migratorio formal | ↑ | Cruces de frontera registrados oficialmente por año. |
| Informalidad laboral migrante | ↓ | % de migrantes trabajando sin contrato formal. |
| Infraestructura fronteriza | ↑ | Calidad y capacidad de la infraestructura del paso fronterizo (1–10). |
| Acceso a servicios para migrantes | ↑ | % de migrantes con acceso efectivo a servicios básicos. |
| Tensión social fronteriza | ↓ | Nivel de conflictividad social en la frontera (1–10). |
| Diferencial cambiario | ↓ | Diferencia % entre el tipo de cambio oficial y el paralelo. |
| Sistemas biométricos de migración | ↑ | Puestos de control con biometría activa. |
| Migrantes con PPT digital activo | ↑ | % de migrantes con Permiso de Protección Temporal vigente. |
| Integración económica binacional | ↑ | Grado de integración económica formal entre las dos ciudades (1–10). |

### 🎓 Capital Humano (16 %)

Educación, talento y cierre de la brecha digital.

| Indicador | Tipo | Qué mide |
|---|---|---|
| Educación secundaria y superior | ↑ | % de la población con educación secundaria y superior. |
| Participación en actividad física | ↑ | % de población que practica actividad física regularmente. |
| Colegios con salas STEM | ↑ | Colegios con laboratorios de ciencia y tecnología. |
| Penetración internet fijo en hogares | ↑ | Hogares con banda ancha fija. |
| Conectividad escolar | ↑ | Instituciones educativas con internet activo. |
| Brecha digital estudiantil | ↓ | Estudiantes sin computador ni tablet en casa. |
| Gasto privado en educación | ↑ | Gasto anual de las familias en educación, per cápita (USD). |
| Instalaciones deportivas oficiales | ↑ | Instalaciones deportivas registradas. |
| Parques con equipamiento deportivo | ↑ | Parques urbanos con equipamiento deportivo activo. |
| Programas universitarios en TIC | ↑ | Programas de pregrado/posgrado en tecnología. |

### 🤝 Cohesión Social (16 %)

Seguridad, salud, equidad y acceso a redes.

| Indicador | Tipo | Qué mide |
|---|---|---|
| Tasa de desempleo | ↓ | % de la población económicamente activa sin empleo. |
| Tasa de homicidios | ↓ | Homicidios por 100 000 habitantes/año. |
| Índice de criminalidad percibida | ↓ | Percepción de inseguridad (Numbeo 0–100). |
| Coeficiente de Gini | ↓ | Desigualdad en la distribución del ingreso (0–1). |
| Índice de Felicidad | ↑ | Bienestar subjetivo declarado (0–10). |
| Índice de salud | ↑ | Calidad percibida del sistema de salud (Numbeo 0–100). |
| Tasa de empleo femenino | ↑ | % de mujeres en edad laboral con empleo. |
| Tasa de mortalidad general | ↓ | Muertes por 100 000 habitantes/año. |
| Cobertura 4G/5G urbana | ↑ | % del área urbana con red móvil de alta velocidad. |
| Establecimientos con telemedicina | ↑ | Centros de salud con consulta médica remota. |

### 💼 Economía (16 %)

Competitividad, emprendimiento y digitalización productiva.

| Indicador | Tipo | Qué mide |
|---|---|---|
| PIB per cápita | ↑ | Producto interno bruto por habitante (USD). |
| Salario por hora | ↑ | Remuneración horaria promedio formal (USD). |
| Facilidad para abrir empresa | ↓ | Posición en ranking tipo Doing Business (menor = mejor). |
| Días para crear empresa | ↓ | Días hábiles para constituir una empresa. |
| Motivación emprendedora | ↑ | Ratio de emprendimiento por oportunidad vs. por necesidad. |
| Poder adquisitivo relativo | ↑ | Poder de compra frente a Nueva York (=100). |
| Startups tecnológicas activas | ↑ | Startups con producto validado en el mercado. |
| Comercio electrónico | ↑ | % de empresas que venden por canales digitales. |
| Productividad laboral | ↑ | Valor agregado por ocupado (miles USD/año). |
| Inversión en I+D+TIC | ↑ | % del PIB local destinado a innovación y tecnología. |

### 🏛️ Gobernanza (16 %)

Gobierno digital, transparencia y gestión urbana inteligente.

| Indicador | Tipo | Qué mide |
|---|---|---|
| Índice de E-Participación ONU | ↑ | Participación electrónica ciudadana (0–1). |
| Índice de Derechos Legales | ↑ | Solidez del marco legal (0–12, Banco Mundial). |
| Trámites municipales en línea | ↑ | % de trámites completables 100 % en línea. |
| Datasets de datos abiertos | ↑ | Conjuntos de datos públicos en formatos abiertos. |
| Cámaras de videovigilancia | ↑ | Cámaras conectadas al centro de monitoreo. |
| Satisfacción con servicios digitales | ↑ | Valoración ciudadana de los servicios digitales (1–10). |
| Certificación ISO 37120 | ↑ | Nivel de certificación internacional de servicios urbanos (0–6). |
| Índice Capital Humano EGDI | ↑ | Componente de capital humano del Índice de Gobierno Digital de la ONU. |
| Índice Infraestructura Telecom | ↑ | Componente de telecomunicaciones del EGDI (ONU). |
| Semáforos inteligentes | ↑ | Semáforos con control adaptativo al tráfico. |

### 🌿 Medio Ambiente (16 %)

Sostenibilidad y monitoreo ambiental con sensores.

| Indicador | Tipo | Qué mide |
|---|---|---|
| Áreas verdes per cápita | ↑ | m² de área verde urbana por habitante (la OMS recomienda 9). |
| Índice de Calidad del Aire (AQI) | ↓ | Promedio anual del AQI (menor = aire más limpio). |
| PM2.5 anual | ↓ | Concentración de partículas finas (µg/m³). |
| Energía renovable | ↑ | % de la matriz energética de fuentes renovables. |
| Tratamiento de aguas residuales | ↑ | % de aguas residuales tratadas antes del vertimiento. |
| Emisiones CO₂ por habitante | ↓ | Toneladas de CO₂ equivalente por habitante/año. |
| Vulnerabilidad climática | ↓ | Exposición a riesgos climáticos (1–10). |
| Índice de Desempeño Ambiental (EPI) | ↑ | Puntuación en el EPI de la Universidad de Yale (0–100). |
| Calidad del agua potable | ↑ | Calidad percibida del agua (Numbeo 0–100). |
| Residuos sólidos per cápita | ↓ | Kg de residuos por habitante/año. |

---

## 5. ¿De dónde vienen los datos?

Cada indicador de la plataforma tiene una **fuente identificada, un año y una justificación**; en la ficha de cada ciudad, el icono 🔗 junto al puntaje lleva a la fuente original.

### Fuentes por tipo

| Tipo | Ejemplos usados en la plataforma |
|---|---|
| **Estadísticas oficiales nacionales** | DANE y DNP (Colombia), INE y BCV (Venezuela), IBGE (Brasil), Migración Colombia, SAIME, DIAN, SENIAT, Receita Federal, Policía Nacional |
| **Ministerios y agencias sectoriales** | MinTIC y MinSalud (Colombia), CONATEL (Venezuela), ANATEL y MEC (Brasil), IDEAM, UPME, Computadores para Educar |
| **Organismos internacionales** | Banco Mundial (Doing Business, indicadores de desarrollo), ONU (índices EGDI y E-Participación), CEPAL, ACNUR/R4V, OMS |
| **Mediciones ambientales** | IQAir (calidad del aire y PM2.5), EPI de Yale, redes locales de sensores IoT |
| **Plataformas de datos comparativos** | Numbeo (criminalidad, salud, agua), StartupBlink, CB Insights, Nomad List, OpenStreetMap |
| **Observatorios y academia** | ENCOVI (UCAB), Observatorio Venezolano de Violencia (OVV), PROVEA, Transparencia Venezuela, Analdex, gremios y cámaras de comercio locales |
| **Fuentes locales** | Alcaldías y prefeituras, planes de desarrollo, portales de datos abiertos (datos.gov.co, dados.gov.br) |

### Dato Confirmado vs. Estimado

En ciudades donde la información pública es escasa (especialmente en contexto de crisis institucional), no todos los valores provienen de una medición directa. Por eso cada indicador del modelo oficial está marcado como:

- **DATO (Confirmado)** ✅ — el valor tiene respaldo directo de una fuente oficial o verificada para esa ciudad (o su departamento/estado). En los gráficos comparativos aparece como `[DATO]`.
- **ESTIMADO** ⚠️ — no existe cifra oficial local, así que el valor se estimó con una metodología documentada: por ejemplo, partir del dato nacional o departamental y ajustarlo al contexto fronterizo, o hacer un cálculo proporcional desde una ciudad comparable. La justificación de cada estimación (fuente base + ajuste aplicado) se muestra en el detalle del indicador. En los gráficos aparece como `[ESTIMADO]`.

Esta distinción es deliberada: preferimos mostrar una estimación transparente y trazable a dejar el indicador vacío, pero el usuario siempre puede saber qué tan sólido es cada número.

---

## 6. Preguntas frecuentes

**1. ¿Qué significa el número grande junto a cada ciudad (por ejemplo, 6.05)?**
Es el Índice Compuesto: un resumen de 0 a 10 del desempeño de la ciudad en las 6 dimensiones, ponderado por sus pesos. Un 6.05 corresponde al nivel "Medio": ciudad en desarrollo con fortalezas sectoriales.

**2. ¿Por qué la dimensión Frontera pesa más que las demás (20 % vs. 16 %)?**
Porque es la razón de ser del índice: el ICCI se diseñó específicamente para ciudades fronterizas, donde el comercio binacional y la migración condicionan toda la vida urbana. Esa dimensión es el aporte original de la tesis frente a índices genéricos de ciudad inteligente.

**3. ¿Un puntaje de 10 significa que la ciudad es perfecta en ese indicador?**
Significa que alcanzó o superó la **referencia óptima** definida para ese indicador (basada en estándares internacionales o metas razonables para la región). El puntaje se recorta en 10: superar la referencia no da puntos extra.

**4. ¿Por qué algunos indicadores son "Negativos ↓"?**
Porque en ellos *menos es mejor*: homicidios, desempleo, contaminación, desigualdad. La fórmula se invierte (Referencia ÷ Valor) para que un valor bajo produzca un puntaje alto. Así todos los puntajes se leen igual: más alto = mejor.

**5. ¿Qué significa "N/D" o el punto gris en un indicador?**
Que no hay dato disponible para esa ciudad. El indicador se excluye del promedio de su dimensión (no cuenta como cero), para no castigar a la ciudad por falta de información.

**6. ¿Qué diferencia hay entre un dato "Confirmado" (DATO) y uno "Estimado"?**
Confirmado: respaldado directamente por una fuente oficial o verificada. Estimado: construido con una metodología documentada (dato nacional ajustado, cálculo proporcional) porque no existe cifra oficial local. La justificación exacta de cada estimación se puede leer en el detalle del indicador.

**7. ¿Por qué comparar a Cúcuta con Pacaraima si tienen tamaños tan distintos?**
Porque casi todos los indicadores están normalizados (porcentajes, tasas por 100 000 habitantes, valores per cápita), lo que permite comparar ciudades de distinto tamaño. Lo que las hace comparables no es la población sino su condición compartida de ciudad de frontera.

**8. ¿Cada cuánto se actualizan los datos?**
Los datos corresponden al último año disponible de cada fuente (mayoritariamente 2022–2024; cada indicador muestra su año). La actualización no es automática: el equipo actualiza los valores cuando las fuentes publican nuevas cifras y recarga la base de datos.

**9. ¿Puedo ver la fuente exacta de un número?**
Sí. En el Resumen de una ciudad, cada indicador del modelo oficial tiene un icono 🔗 que abre la fuente original (informe, portal estadístico o noticia) en una pestaña nueva.

**10. ¿Qué significa el distintivo verde "Modelo oficial · 60 indicadores"?**
Que esa ciudad tiene cargado en la base de datos el modelo completo de investigación (60 indicadores con justificación, fuente y año). Si el distintivo no aparece, la ciudad se muestra con el catálogo comparativo embebido en la plataforma.

**11. ¿Por qué el ranking cambia de posiciones si nadie "compite" oficialmente?**
El ranking es solo una lectura ordenada del Índice Compuesto: cuando se actualiza un dato o se refina una estimación, los puntajes (y por tanto las posiciones) pueden cambiar. El objetivo no es la competencia sino identificar brechas y buenas prácticas replicables.

**12. ¿Puedo usar los datos y gráficos en un trabajo académico o una nota de prensa?**
Sí, citando la plataforma (ICCI — Índice de Ciudad Inteligente para Ciudades de Frontera, https://cucuta-smart-city.vercel.app) y, para cifras específicas, la fuente original que aparece en cada indicador.

**13. ¿Se van a agregar más ciudades?**
Sí, el diseño del proyecto contempla ampliar el índice a otras ciudades fronterizas de Latinoamérica (como Tijuana, Foz do Iguaçu, Tacna o Tulcán). Hoy la plataforma incluye las 6 ciudades listadas en la sección 1.

**14. ¿Qué son los indicadores "IoT"? ¿La plataforma mide sensores en tiempo real?**
Los indicadores IoT miden la adopción de tecnología y conectividad en la ciudad (sensores de calidad del aire, cámaras, semáforos inteligentes, telemedicina, cobertura 4G/5G). Por ahora la plataforma registra su cantidad/cobertura a partir de fuentes documentales; no recibe telemetría en tiempo real de los sensores.

**15. La página cargó pero veo datos distintos a los de ayer, ¿es un error?**
Probablemente no: la plataforma consulta la base de datos en vivo al cargar. Si la base de datos está temporalmente fuera de línea, la plataforma muestra su copia de respaldo integrada, que puede diferir ligeramente del modelo oficial. Recargar la página cuando la conexión se restablezca vuelve a mostrar los datos oficiales.

---

*Documento generado como parte del proyecto de tesis ICCI — Índice de Ciudad Inteligente para Ciudades de Frontera. Para la documentación técnica del sistema, ver [DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md).*
