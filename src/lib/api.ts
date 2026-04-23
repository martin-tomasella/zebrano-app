// src/lib/api.ts
// Todas las llamadas a los webhooks de n8n y Edge Functions

import Constants from 'expo-constants';

const N8N_BASE = Constants.expoConfig?.extra?.n8nWebhookBase ?? 'https://n8n-n8n.z8ixjp.easypanel.host/webhook';
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl ?? '';

// ── COTIZADOR AI ──────────────────────────────────────────
export interface CotizadorInput {
  sesion_id?: string;
  mensaje?: string;
  imagenes_base64?: string[];
  origen?: string;
  cliente_nombre?: string;
}

export interface CotizadorOutput {
  ok: boolean;
  sesion_id: string;
  respuesta: string;
  datos?: Record<string, unknown>;
  resumen?: {
    costoTotal: number;
    precioSugerido: number;
    margen: number;
    hojas: Record<string, { hojas_reales: number; m2_neto: number }>;
  };
  error?: string;
}

export async function callCotizador(input: CotizadorInput): Promise<CotizadorOutput> {
  const res = await fetch(`${N8N_BASE}/zebrano-cotizador`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json();
}

// ── LEADER ZEBRANO (comandos generales) ───────────────────
export async function callLeader(comando: string, contexto = {}): Promise<{
  ok: boolean;
  intent: string;
  respuesta_voz: string;
  resultado: Record<string, unknown>;
}> {
  const res = await fetch(`${N8N_BASE}/zebrano-leader`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comando, fuente: 'app_zebrano', contexto }),
  });
  return res.json();
}

// ── IMAGEN A BASE64 ───────────────────────────────────────
export async function imageUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── RENDER IA (Pollinations — gratuito) ───────────────────
// Pollinations.ai es gratuito, no requiere API key
export function generateRenderUrl(prompt: string, width = 1024, height = 768): string {
  const encoded = encodeURIComponent(
    `Interior design render, ${prompt}, photorealistic, modern Argentine carpentry, white melamine furniture, professional lighting, 4k quality`
  );
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&enhance=true`;
}

// ── SUBIR IMAGEN A STORAGE ────────────────────────────────
export async function uploadImageToProject(
  projectId: string,
  sesionId: string,
  base64: string,
  fileName: string
): Promise<string | null> {
  try {
    const path = `proyectos/${projectId}/sesion_${sesionId}/${fileName}`;
    const byteCharacters = atob(base64);
    const byteNumbers = Array.from(byteCharacters, c => c.charCodeAt(0));
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, Constants.expoConfig?.extra?.supabaseAnonKey ?? '');
    const { error } = await sb.storage.from('zebrano-proyectos').upload(path, blob, { upsert: true });
    if (error) return null;
    const { data } = sb.storage.from('zebrano-proyectos').getPublicUrl(path);
    return data.publicUrl;
  } catch { return null; }
}
