# Deployment Guide - Fitness Matrix

Este proyecto está optimizado para funcionar en **Netlify** y **Vercel**. Ambas plataformas soportan:

- ✅ Builds estáticos optimizados
- ✅ API Routes / Serverless Functions
- ✅ Scheduled Functions (Cron Jobs)
- ✅ Environment Variables

---

## 🚀 Deployment en Netlify (Actual: https://ftness.netlify.app/)

### 1. Configuración Inicial

El proyecto ya está configurado con `netlify.toml`. Las funciones serverless están en `netlify/functions/`.

### 2. Environment Variables

Añade estas variables en **Netlify Dashboard → Site settings → Environment variables**:

```bash
STRAVA_CLIENT_ID=tu_client_id
STRAVA_CLIENT_SECRET=tu_client_secret
STRAVA_REFRESH_TOKEN=tu_refresh_token
HEVY_API_KEY=tu_hevy_api_key
ZEPP_EMAIL=tu_email_zepp (opcional)
ZEPP_PASSWORD=tu_password_zepp (opcional)
ZEPP_REFRESH_TOKEN=tu_zepp_refresh_token (opcional)
```

### 3. Scheduled Functions

Netlify ejecutará automáticamente estas funciones diariamente:

- **6:00 AM UTC**: `update-strava` - Actualiza datos de Strava
- **6:15 AM UTC**: `update-hevy` - Actualiza workouts de Hevy
- **6:30 AM UTC**: `update-zepp` - Actualiza datos de salud de Zepp

### 4. Build Settings

```toml
Build command: bun run build
Publish directory: dist
Functions directory: netlify/functions
Node version: 18.17.1
```

### 5. Testing Functions Locally

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Correr funciones localmente
netlify dev

# Test manual de función
curl http://localhost:8888/.netlify/functions/update-strava
```

### 6. Manual Trigger (desde Netlify Dashboard)

Puedes ejecutar manualmente las funciones desde:
- **Functions → [función] → Trigger function**

O vía API:
```bash
curl https://ftness.netlify.app/.netlify/functions/update-strava
```

---

## 🔷 Deployment en Vercel (Alternativa)

### 1. Configuración Inicial

El proyecto incluye `vercel.json` para configuración automática.

### 2. Import Project

```bash
# Opción 1: CLI
vercel

# Opción 2: Dashboard
# 1. Ir a vercel.com/new
# 2. Import tu repositorio de GitHub
# 3. Vercel detectará Astro automáticamente
```

### 3. Environment Variables

Añade en **Vercel Dashboard → Settings → Environment Variables**:

```bash
STRAVA_CLIENT_ID=tu_client_id
STRAVA_CLIENT_SECRET=tu_client_secret
STRAVA_REFRESH_TOKEN=tu_refresh_token
HEVY_API_KEY=tu_hevy_api_key
ZEPP_EMAIL=tu_email_zepp (opcional)
ZEPP_PASSWORD=tu_password_zepp (opcional)
ZEPP_REFRESH_TOKEN=tu_zepp_refresh_token (opcional)
CRON_SECRET=genera_un_secret_aleatorio
```

**Generar CRON_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Cron Jobs Configuration

Los cron jobs están configurados en `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/update-strava",
      "schedule": "0 6 * * *"
    }
  ]
}
```

⚠️ **Nota**: Vercel Cron Jobs requieren un plan **Pro** o superior.

### 5. Build Settings

Vercel detecta automáticamente:
- **Framework**: Astro
- **Build Command**: `bun run build`
- **Output Directory**: `dist`

### 6. Testing API Routes Locally

```bash
# Development mode
bun dev

# Test API route
curl http://localhost:4321/api/update-strava \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 📊 Comparación: Netlify vs Vercel

| Feature | Netlify (Actual) | Vercel |
|---------|-----------------|--------|
| **Cron Jobs Gratis** | ✅ Sí (Scheduled Functions) | ❌ No (requiere Pro) |
| **Build Time** | ~2-3 min | ~1-2 min |
| **Serverless Functions** | ✅ Ilimitadas (Free tier) | ✅ 100 GB-hours/mes (Free) |
| **Edge Network** | ✅ Global CDN | ✅ Global Edge Network |
| **Logs** | ✅ Function logs | ✅ Detailed logs |
| **Deploy Previews** | ✅ Automático | ✅ Automático |

**Recomendación**: Usar **Netlify** para este proyecto por el soporte gratuito de Scheduled Functions.

---

## 🔧 Switching Between Platforms

### De Netlify a Vercel:

1. Deploy a Vercel siguiendo los pasos arriba
2. Actualizar DNS o dominio custom
3. Mantener Netlify como backup

### De Vercel a Netlify:

1. Ya configurado en `netlify.toml`
2. Push a GitHub
3. Netlify auto-deploys

---

## 📝 Notes

### Netlify Specific:

- Las funciones serverless se ejecutan desde `netlify/functions/`
- Los archivos JSON se escriben en `dist/` (directorio de build)
- Scheduled Functions no requieren autenticación especial

### Vercel Specific:

- API routes están en `src/pages/api/`
- Requiere `CRON_SECRET` para seguridad
- Cron jobs verifican el header `Authorization: Bearer $CRON_SECRET`

### Ambas Plataformas:

- Auto-deploys en cada push a `main`
- Support para PR previews
- Environment variables separadas por entorno (Production/Preview)

---

## 🐛 Troubleshooting

### Netlify Functions no ejecutan:

```bash
# Verificar logs
netlify functions:log update-strava

# Verificar deployment
netlify status
```

### Vercel API routes 500 error:

```bash
# Check logs
vercel logs

# Verificar environment variables
vercel env ls
```

### Datos no actualizan:

1. Verificar que las API keys sean válidas
2. Check function logs para errores
3. Verificar que el archivo JSON existe en `dist/` o `public/`

---

## 🔐 Security Best Practices

1. **Nunca** commits API keys al código
2. Usa environment variables en ambas plataformas
3. Para Vercel, usa `CRON_SECRET` para proteger endpoints
4. Rota tokens periódicamente
5. Monitor function logs para intentos no autorizados

---

## 📚 Resources

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Netlify Scheduled Functions](https://docs.netlify.com/functions/scheduled-functions/)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Astro Deployment](https://docs.astro.build/en/guides/deploy/)
