// src/types/index.ts

export interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  origen_lead: string;
  activo: boolean;
  created_at: string;
}

export interface Proyecto {
  id: string;
  cliente_id: string;
  nombre: string;
  estado: string;
  tipo_trabajo: string;
  valor_estimado?: number;
  fecha_entrega_estimada?: string;
  created_at: string;
  clientes?: Cliente;
}

export interface CotizacionSesion {
  id: string;
  origen: string;
  cliente_id?: string;
  cliente_nombre?: string;
  estado: 'iniciada' | 'procesando' | 'borrador' | 'revisada' | 'aprobada' | 'descartada';
  descripcion_raw?: string;
  imagenes_urls: string[];
  tipo_trabajo?: string;
  ambiente?: string;
  notas_internas?: string;
  created_at: string;
  cotizacion_resumen?: CotizacionResumen[];
}

export interface CotizacionMensaje {
  id: string;
  sesion_id: string;
  rol: 'user' | 'agent' | 'system';
  contenido: string;
  imagenes: string[];
  created_at: string;
}

export interface CotizacionPieza {
  id: string;
  sesion_id: string;
  modulo_nombre: string;
  nombre_pieza: string;
  material: string;
  largo_mm: number;
  ancho_mm: number;
  cantidad: number;
  con_canto_largo: boolean;
  con_canto_ancho: boolean;
  orden: number;
}

export interface CotizacionHoja {
  id: string;
  sesion_id: string;
  material: string;
  hojas_reales: number;
  hojas_teoricas: number;
  m2_neto: number;
  precio_hoja: number;
  subtotal: number;
}

export interface CotizacionResumen {
  id: string;
  sesion_id: string;
  costo_materiales: number;
  costo_herrajes: number;
  costo_mano_obra: number;
  costo_total_interno: number;
  margen_pct: number;
  precio_sugerido: number;
  precio_final?: number;
  horas_totales_est?: number;
  render_url?: string;
  pdf_presupuesto_url?: string;
  pdf_ot_url?: string;
}

export interface OrdenTrabajo {
  id: string;
  numero_ot: string;
  estado: 'pendiente' | 'en_proceso' | 'terminada' | 'cancelada';
  avance_pct: number;
  horas_estimadas?: number;
  horas_reales: number;
  fecha_entrega_estimada?: string;
}

export interface Mensaje {
  id: string;
  rol: 'user' | 'agent';
  contenido: string;
  imagenes?: string[];
  renderUrl?: string;
  timestamp: string;
}
