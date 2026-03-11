# Optimización de Build - Leer de JSONs en lugar de APIs

## Problema Actual

Las páginas están llamando a las APIs durante el build:

```typescript
// En index.astro línea 95-97
await Promise.all([
  fetchStepsData(365).catch(() => ({})),    // ← API Google Fit
  fetchActivities(1, 200).catch(() => []),  // ← API Strava
  fetchHevyData().catch(() => []),          // ← API Hevy
]);

// En dataAggregationService.ts línea 207-222
const [...] = await Promise.all([
  fetchStepsData(...),      // ← API
  fetchSleepData(...),      // ← API
  fetchHeartRateData(...),  // ← API
  fetchMoveMinutesData(...),// ← API
  fetchHeartRateZones(...), // ← API
  fetchActivities(...),     // ← API
  fetchHevyData(),          // ← API
]);
```

**Consecuencias:**
- ❌ Build tarda 10-15 segundos (solo en llamadas API)
- ❌ Puede fallar por rate limits
- ❌ Puede fallar por timeouts de red
- ❌ Los JSONs generados por los scripts NO se usan
- ❌ Builds inestables

## Solución: Leer de JSONs Pre-generados

### Paso 1: Modificar dataAggregationService.ts

Agregar función para cargar datos de JSONs:

```typescript
/**
 * Load all data from pre-generated JSON files (fast!)
 * Falls back to API calls only if JSONs don't exist
 */
async function loadDataFromJSON() {
  const cwd = process.cwd();

  try {
    // Load health data (Google Fit)
    const healthPath = resolve(cwd, "public", "health-data.json");
    const healthRaw = await readFile(healthPath, "utf-8");
    const healthData = JSON.parse(healthRaw);

    // Load Hevy data
    const hevyPath = resolve(cwd, "public", "hevy-data.json");
    const hevyRaw = await readFile(hevyPath, "utf-8");
    const hevyData = JSON.parse(hevyRaw);

    // Load Strava data
    const stravaPath = resolve(cwd, "public", "last-activities.json");
    const stravaRaw = await readFile(stravaPath, "utf-8");
    const stravaData = JSON.parse(stravaRaw);

    return {
      health: healthData,
      hevy: hevyData.workouts || [],
      strava: stravaData,
      fromJSON: true,
    };
  } catch (error) {
    console.warn("Could not load from JSON, falling back to API:", error);
    return null;
  }
}
```

### Paso 2: Modificar getDataForDate()

```typescript
export async function getDataForDate(date: string): Promise<DayData> {
  return memoize(`day-data-${date}`, async () => {
    // Try to load from JSON first (fast!)
    const jsonData = await loadDataFromJSON();

    if (jsonData?.fromJSON) {
      console.log(`[DataAggregation] ✅ Loaded from JSON (fast!)`);

      // Extract data for specific date
      const stepsData = jsonData.health.steps || {};
      const sleepData = jsonData.health.sleep || {};
      const hrData = jsonData.health.heartRate || {};
      const moveData = jsonData.health.moveMinutes || {};

      // ... process and return
    }

    // Fallback to API calls (slow)
    console.log(`[DataAggregation] ⚠️ JSONs not found, calling APIs...`);
    // ... existing API code
  });
}
```

### Paso 3: Beneficios

| Antes (API calls) | Después (JSON) |
|-------------------|----------------|
| 10-15 segundos | <100ms |
| Puede fallar | Siempre funciona |
| Rate limits | Sin límites |
| Inestable | Estable |

## Implementación Paso a Paso

1. **Generar JSONs inicialmente:**
   ```bash
   bun run update-all
   ```

2. **Modificar servicios** para leer de JSON primero

3. **GitHub Actions** actualiza los JSONs diariamente

4. **Builds** leen de JSONs (rápido y estable)

## Estado Actual

- ✅ Scripts generan JSONs: `update-all`
- ✅ GitHub Actions corre diariamente
- ❌ **Páginas AÚN llaman APIs** (necesita fix)
- ❌ **Build es lento** (necesita fix)

## Próximos Pasos

1. Aplicar fix a `dataAggregationService.ts`
2. Verificar todas las páginas usan el servicio (no APIs directas)
3. Test builds locales
4. Deploy y verificar performance

## Notas

- `health/[date].astro` ya lo hace correctamente ✅
- Usar ese patrón para todos los demás
- Los servicios (fetchStepsData, etc.) solo se usan en scripts, NO en páginas
