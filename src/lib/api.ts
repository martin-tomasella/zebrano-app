const SUPA_URL = 'https://xsciujuvkbubnhhnpcix.supabase.co';
const SUPA_KEY = 'sb_publishable_gI_zCp__hlMim3bIhXX7jg_QwY5MwzZ';

export async function chatCotizador(params) {
  const res = await fetch(`${SUPA_URL}/functions/v1/zebrano-cotizador`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPA_KEY}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function imageToBase64(uri) {
  const r = await fetch(uri);
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function supaFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Prefer': 'return=representation',
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const db = {
  sesiones: {
    list: () => supaFetch('cotizacion_sesiones?select=*,cotizacion_resumen(precio_sugerido,render_url)&order=created_at.desc&limit=50'),
    get: (id) => supaFetch(`cotizacion_sesiones?id=eq.${id}&select=*,cotizacion_piezas(*),cotizacion_hojas(*),cotizacion_herrajes(*),cotizacion_mano_obra(*),cotizacion_resumen(*)&limit=1`).then(r => r[0]),
  },
  ot: {
    activas: () => supaFetch('ordenes_trabajo?estado=neq.completada&order=created_at.desc&limit=20'),
  },
  config: {
    placas: () => supaFetch('config_placas?activo=eq.true&order=material'),
    herrajes: () => supaFetch('config_herrajes?activo=eq.true&order=nombre'),
  },
};
