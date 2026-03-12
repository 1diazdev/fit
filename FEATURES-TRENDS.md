# Nuevas Funcionalidades - Tendencias y Comparaciones

Este documento describe las nuevas funcionalidades agregadas para visualizar tendencias temporales y comparar métricas entre diferentes períodos.

## 📱 Componentes Mobile-Friendly

Todos los nuevos componentes están optimizados para dispositivos móviles con:

- Touch targets de al menos 44x44px
- Diseño responsive que se adapta a diferentes tamaños de pantalla
- Eliminación de efectos de tap highlight en iOS
- Inputs optimizados para evitar zoom en iOS (font-size: 16px)

## 🆕 Nuevos Componentes

### 1. DatePicker (Mejorado)

**Ubicación**: `src/components/DatePicker.astro`

Calendario completo con vista mensual para seleccionar fechas.

**Props**:

```typescript
{
  selectedDate: string;  // YYYY-MM-DD format
  baseUrl?: string;      // Default: "/"
}
```

**Características**:

- Vista de calendario mensual
- Navegación entre meses
- Atajos rápidos: Today, Yesterday, Last Week
- Deshabilita fechas futuras
- Diseño responsive con mejor UX en móvil

**Ejemplo de uso**:

```astro
import DatePicker from "@components/DatePicker.astro";

<DatePicker selectedDate="2026-03-11" baseUrl="/day/" />
```

---

### 2. TrendsPanel

**Ubicación**: `src/components/TrendsPanel.astro`

Panel de análisis de tendencias con gráficos y estadísticas.

**Props**:

```typescript
{
  trendData: TrendDataPoint[];  // Array de datos por día
  period?: "7d" | "30d" | "90d"; // Default: "7d"
  currentDate: string;           // YYYY-MM-DD
}

interface TrendDataPoint {
  date: string;
  steps: number;
  distance: number;
  calories: number;
  activities: number;
  workouts: number;
}
```

**Características**:

- Selector de período (7, 30, 90 días)
- Estadísticas promedio (steps/day, distance/day, calories/day)
- Indicador de tendencia (up/down/stable)
- Gráfico de barras para steps
- Gráfico de frecuencia de actividades/workouts
- Mobile-friendly con diseño en columna en pantallas pequeñas

**Ejemplo de uso**:

```astro
import TrendsPanel from "@components/TrendsPanel.astro"; import {
  prepareTrendData
} from "@utils/trendsUtils"; const trendData = prepareTrendData( stepsData,
activities, workouts, "2026-03-11", 7 // 7 días );

<TrendsPanel trendData={trendData} period="7d" currentDate="2026-03-11" />
```

---

### 3. MetricsComparison

**Ubicación**: `src/components/MetricsComparison.astro`

Compara métricas entre el período actual y el anterior.

**Props**:

```typescript
{
  currentPeriod: PeriodStats;
  previousPeriod: PeriodStats;
  periodLabel?: string;       // Default: "THIS_PERIOD"
  comparisonLabel?: string;   // Default: "PREVIOUS_PERIOD"
}

interface PeriodStats {
  steps: number;
  distance: number;
  calories: number;
  activities: number;
  workouts: number;
  activeDays: number;
}
```

**Características**:

- Compara 6 métricas clave
- Calcula cambio porcentual
- Indicadores visuales (↗ positivo, ↘ negativo, → neutral)
- Barras de progreso con colores según tendencia
- Resumen general de rendimiento
- Diseño responsive con layout en columna en móvil

**Ejemplo de uso**:

```astro
import MetricsComparison from "@components/MetricsComparison.astro"; import {
  prepareComparisonData
} from "@utils/trendsUtils"; const {(current, previous)} = prepareComparisonData(
stepsData, activities, workouts, "2026-03-11", 7 // Comparar últimas 2 semanas );

<MetricsComparison
  currentPeriod={current}
  previousPeriod={previous}
  periodLabel="THIS_WEEK"
  comparisonLabel="LAST_WEEK"
/>
```

---

## 🛠️ Utilidades

### trendsUtils.ts

**Ubicación**: `src/utils/trendsUtils.ts`

Funciones helper para preparar datos:

#### `prepareTrendData()`

Prepara datos de tendencias para un número específico de días.

```typescript
function prepareTrendData(
  stepsData: Record<
    string,
    { steps: number; distance: number; calories: number }
  >,
  activitiesData: any[],
  workoutsData: any[],
  endDate: string,
  days: number,
): TrendDataPoint[];
```

#### `calculatePeriodStats()`

Calcula estadísticas agregadas para un período.

```typescript
function calculatePeriodStats(trendData: TrendDataPoint[]): PeriodStats;
```

#### `prepareComparisonData()`

Prepara datos para comparación entre dos períodos.

```typescript
function prepareComparisonData(
  stepsData: Record<
    string,
    { steps: number; distance: number; calories: number }
  >,
  activitiesData: any[],
  workoutsData: any[],
  endDate: string,
  days: number,
): { current: PeriodStats; previous: PeriodStats };
```

#### `getPeriodLabel()` y `getComparisonLabel()`

Generan etiquetas automáticas según el número de días.

---

## 📋 Cómo Integrar en Homepage

### Paso 1: Importar componentes y utilidades

```astro
---
// En index.astro
import TrendsPanel from "@components/TrendsPanel.astro";
import MetricsComparison from "@components/MetricsComparison.astro";
import DatePicker from "@components/DatePicker.astro";
import {
  prepareTrendData,
  prepareComparisonData,
  getPeriodLabel,
  getComparisonLabel,
} from "@utils/trendsUtils";
---
```

### Paso 2: Preparar datos

```astro
---
// Obtener período seleccionado de query param
const url = new URL(Astro.request.url);
const period = url.searchParams.get("period") || "7d";
const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;

// Preparar datos de tendencias
const trendData = prepareTrendData(
  stepsData,
  allActivities,
  allWorkouts,
  selectedDate,
  periodDays,
);

// Preparar datos de comparación
const { current, previous } = prepareComparisonData(
  stepsData,
  allActivities,
  allWorkouts,
  selectedDate,
  periodDays,
);

const periodLabel = getPeriodLabel(periodDays);
const comparisonLabel = getComparisonLabel(periodDays);
---
```

### Paso 3: Usar componentes en el template

```astro
<Base title="Fitness Dashboard">
  <!-- Date Picker -->
  <SectionLayout title="[SELECT_DATE]">
    <DatePicker selectedDate={selectedDate} baseUrl="/day/" />
  </SectionLayout>

  <!-- Trends Panel -->
  <SectionLayout title="[TRENDS_ANALYSIS]">
    <TrendsPanel
      trendData={trendData}
      period={period}
      currentDate={selectedDate}
    />
  </SectionLayout>

  <!-- Metrics Comparison -->
  <SectionLayout title="[PERFORMANCE_COMPARISON]">
    <MetricsComparison
      currentPeriod={current}
      previousPeriod={previous}
      periodLabel={periodLabel}
      comparisonLabel={comparisonLabel}
    />
  </SectionLayout>
</Base>
```

---

## 🎨 Estilos Matrix Theme

Todos los componentes mantienen el tema Matrix con:

- Fondo degradado negro/verde oscuro
- Bordes verdes neón con glow
- Tipografía monoespaciada (Courier New)
- Animaciones suaves
- Efectos hover con glow verde

### Código de colores:

- Verde primario: `#00ff00`
- Verde secundario: `rgba(0, 255, 0, 0.8)`
- Verde oscuro: `rgba(0, 20, 0, 0.7)`
- Positivo: `rgb(0, 255, 100)`
- Negativo: `rgb(255, 100, 0)`
- Neutral: `rgb(200, 200, 0)`

---

## 📱 Consideraciones Mobile

### Breakpoints:

- Desktop: > 768px
- Tablet: 480px - 768px
- Mobile: < 480px

### Touch Targets:

Todos los botones e inputs tienen mínimo 44x44px en móvil para cumplir con las guías de accesibilidad de Apple y Google.

### Grid Layouts:

Los grids se adaptan automáticamente:

- Desktop: 2-3 columnas
- Tablet: 2 columnas
- Mobile: 1 columna

---

## 🚀 Próximos Pasos

Para implementar estas funcionalidades:

1. ✅ Componentes creados y mobile-optimizados
2. ✅ Utilidades para preparar datos
3. ⏳ Integrar en `index.astro`
4. ⏳ Integrar en `health.astro` o crear página dedicada de trends
5. ⏳ Agregar persistencia de preferencias (período seleccionado)
6. ⏳ Agregar exportación de datos (CSV, JSON)

---

## 📝 Notas

- Todos los componentes son SSR (Server-Side Rendered) para mejor performance
- Los datos se calculan en build time cuando sea posible
- El código es TypeScript con tipos estrictos
- Seguir el patrón existente de carga de datos desde JSON
