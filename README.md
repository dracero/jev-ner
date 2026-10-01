# JevNER • Moderador & Anonimizador de Encuestas Estudiantiles

Aplicación fullstack desarrollada **100% en Astro** (Frontend reactivo + API Backend Serverless con `@astrojs/vercel`), integrada directamente con **TypeSafe Jev System One** (`jev-latest` / `jev-1.13.0`).

Diseñada para que universidades e instituciones educativas puedan **limpiar, anonimizar (NER/PER), detectar insultos y moderar respuestas abiertas de encuestas a estudiantes** antes de su publicación o análisis institucional.

---

## 🚀 Despliegue en Vercel

El proyecto está configurado con `@astrojs/vercel` en modo Serverless con `maxDuration: 60s` para soportar análisis AI en lotes.

### Opción 1: Conectar Repositorio GitHub a Vercel
1. Sube este repositorio a tu GitHub o GitLab.
2. Ingresa a [Vercel Dashboard](https://vercel.com/new) e importa el repositorio.
3. Vercel detectará automáticamente el framework **Astro**.
4. En la sección **Environment Variables**, agrega:
   - **`JEV_API_KEY`**: Tu clave API de TypeSafe Jev.
5. Haz clic en **Deploy**. ¡Listo!

### Opción 2: Despliegue mediante Vercel CLI
```bash
npx vercel
```
O para producción directa:
```bash
npx vercel --prod
```

---

## 💻 Desarrollo Local

```bash
npm run dev
```

La aplicación estará disponible inmediatamente en:
👉 **[http://localhost:4321/](http://localhost:4321/)**

---

## 🌟 Características Principales

1. **Arquitectura 100% Astro + Vercel Serverless**:
   - Todo se ejecuta en un solo proyecto unificado.
   - Endpoints de backend integrados en `src/pages/api/`.
   - Compatibilidad total con entornos serverless stateless.

2. **Integración con TypeSafe Jev System One**:
   - **NER / PER (Person Entities)**: Detecta menciones de docentes, ayudantes, autoridades y alumnos con probabilidades calibradas (`has_person_name`).
   - **Detección de Cátedras / Materias**: Identifica asignaturas específicas (`has_chair_reference`).
   - **Moderación de Lenguaje Inapropiado / Insultos**: Identifica agravios, vulgaridades y ofensas (`has_insult`).
   - **Puntaje de Severidad / Toxicidad**: Escala continua calibrada de 1 a 5 con distribución de probabilidades (`toxicity_level`).
   - **Clasificación Temática**: Categoriza el motivo principal (docencia, evaluaciones, organización, infraestructura, agresión personal).
   - **Acción Recomendada**: Sugiere si publicar directo, anonimizar o descartar.

3. **Motor de Reconocimiento y Resaltado de Entidades**:
   - Resaltado visual en tiempo real con chips de color:
     - 🟨 **PER**: Docente o persona identificada.
     - 🟦 **CÁTEDRA**: Asignatura o cátedra detectada.
     - 🟥 **INSULTO**: Lenguaje agresivo o inapropiado.
   - Sustitución configurable por etiquetas descriptivas (`[DOCENTE_1]`, `[CÁTEDRA_1]`, `[LENGUAJE INAPROPIADO]`).

4. **Soporte de Archivos**:
   - Carga arrastrando y soltando archivos **`.xlsx`**, **`.xls`** o **`.csv`**.
   - Detección automática de la columna de texto/comentarios.
   - Botón de carga con **1 click de Encuesta de Ejemplo** con 10 respuestas reales de estudiantes universitarios.

5. **Playground de Evaluación Inmediata**:
   - Pestaña interactiva para probar comentarios individuales en ~100ms.
   - Prompts preconfigurados para calibración rápida.

6. **Exportación Flexible**:
   - Formatos: **Microsoft Excel (`.xlsx`)** y **CSV (`.csv`)**.
   - Modos de exportación:
     - Reemplazar columna original por versión anonimizada.
     - Agregar columna `[columna]_anonimizado`.
     - Incluir reporte completo de auditoría Jev (flags, toxicidad, tema, acción).
   - Filtro para excluir comentarios descartados/agresiones severas.

---

## 📁 Estructura del Proyecto

```
jev-ner/
├── .env                     # Clave JEV_API_KEY local
├── .gitignore               # Ignora dependencias, builds (.vercel, dist)
├── astro.config.mjs         # Configuración Astro SSR con @astrojs/vercel
├── package.json             # Scripts y dependencias
├── public/
│   ├── favicon.svg
│   └── sample/              # Archivos de encuesta de ejemplo (.xlsx y .csv)
├── src/
│   ├── lib/
│   │   ├── anonymizer.ts    # Extracción de entidades y enmascarado
│   │   ├── jevService.ts    # Cliente y preguntas TypeSafe Jev System One
│   │   ├── sampleData.ts    # Datos de prueba de encuestas estudiantiles
│   │   └── sessionStore.ts  # Almacenamiento en memoria de sesiones
│   ├── pages/
│   │   ├── index.astro      # UI principal con sistema de tabs y tablas
│   │   └── api/
│   │       ├── status.ts         # GET: Estado y clave Jev
│   │       ├── upload.ts         # POST: Carga y parseo de Excel/CSV
│   │       ├── sample.ts         # GET: Carga dataset de ejemplo
│   │       ├── analyze-single.ts # POST: Análisis en tiempo real
│   │       ├── analyze-batch.ts  # POST: Procesamiento por lotes
│   │       └── export.ts         # POST: Descarga de dataset limpio
│   └── styles/
│       └── index.css        # Sistema de diseño, tokens, modo oscuro
```

---

## 🔑 Variables de Entorno

En local (`.env`) o en Vercel Dashboard (**Project Settings > Environment Variables**):
```env
JEV_API_KEY=tu_api_key_de_typesafe
```
