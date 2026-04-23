# ZEBRANO APP — Contexto para el agente

## Stack
React Native + Expo Router v4 · TypeScript · Supabase · TanStack Query · Zustand

## Supabase
- URL: https://xsciujuvkbubnhhnpcix.supabase.co
- Proyecto: zebrano
- Storage bucket: zebrano-proyectos

## Webhooks n8n activos
- Cotizador AI: POST https://n8n-n8n.z8ixjp.easypanel.host/webhook/zebrano-cotizador
- Leader Zebrano: POST https://n8n-n8n.z8ixjp.easypanel.host/webhook/zebrano-leader

## Edge Functions Supabase
- cotizador-ai: /functions/v1/cotizador-ai
- zebrano-leader: /functions/v1/zebrano-leader
- zebrano-cotizador: /functions/v1/zebrano-cotizador
- n8n-bridge: /functions/v1/n8n-bridge

## Render IA (gratuito)
- Pollinations.ai: https://image.pollinations.ai/prompt/{encoded_prompt}
- Sin API key, sin costo

## Flujo cotizador
1. Usuario sube imagen/texto → app/(tabs)/cotizador.tsx
2. POST /webhook/zebrano-cotizador con {sesion_id, mensaje, imagenes_base64[]}
3. n8n → Edge Function zebrano-cotizador → Claude API
4. Respuesta con despiece + hojas + costos
5. App muestra render (Pollinations) + resumen
6. Usuario aprueba → se crea OT en Supabase

## Estructura de carpetas de proyectos en Storage
zebrano-proyectos/
└── proyectos/
    └── {proyecto_id}/
        └── sesion_{sesion_id}/
            ├── plano_original.jpg
            ├── render_v1.jpg
            └── cotizacion_v1.pdf

## Reglas
- Dark theme obligatorio (colors de src/lib/theme.ts)
- Sin `any` en TypeScript
- Commit después de cada feature
- EAS account: tomillo007
