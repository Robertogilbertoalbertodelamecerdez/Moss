import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. VARIABLE UNIVERSAL DE URL / DOMINIO
// ==========================================
export const APP_URL = typeof window !== "undefined" 
  ? window.location.origin 
  : "http://localhost:3000";

// ==========================================
// 2. CONEXIÓN A SUPABASE (CON TU LLAVE FIJA)
// ==========================================
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dgpijysxwshrmaihuckb.supabase.co"; 
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_vvQpxq8RVsURAXlzItrJPQ_fMIWqClX";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 3. FORMATEADOR UNIVERSAL DE FECHA (DÍA/MES/AÑO)
// ==========================================
export const formatearFechaDMA = (fechaISO) => {
  if (!fechaISO) return "";
  const limpia = String(fechaISO).split("T")[0];
  const partes = limpia.split("-");
  if (partes.length !== 3) return fechaISO;
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
};

// ==========================================
// 4. CREDENCIALES Y RESPALDO INICIAL
// ==========================================
export const AUTH_CONFIG = {
  usuario: "Mateus",
  pin: "2020"
};

export const PLATAFORMAS = [
  { nombre: "Netflix", perfilesDefault: 6, tieneExtra2020: true, pidePass: true, pidePerfil: true, pidePin: true },
  { nombre: "Disney+ / ESPN", perfilesDefault: 7, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: true },
  { nombre: "Prime Video", perfilesDefault: 6, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: true },
  { nombre: "Crunchyroll", perfilesDefault: 5, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: false },
  { nombre: "Max (HBO)", perfilesDefault: 5, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: true },
  { nombre: "Gemini Pro", perfilesDefault: 1, tieneExtra2020: false, pidePass: false, pidePerfil: false, pidePin: false },
  { nombre: "ChatGPT Plus", perfilesDefault: 5, tieneExtra2020: false, pidePass: true, pidePerfil: false, pidePin: false },
  { nombre: "Claude Pro", perfilesDefault: 5, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: false },
  { nombre: "Spotify (Asignada)", perfilesDefault: 1, tieneExtra2020: false, pidePass: true, pidePerfil: false, pidePin: false },
  { nombre: "Spotify (Invitación)", perfilesDefault: 1, tieneExtra2020: false, pidePass: false, pidePerfil: false, pidePin: false },
  { nombre: "YouTube Premium", perfilesDefault: 1, tieneExtra2020: false, pidePass: false, pidePerfil: false, pidePin: false },
  { nombre: "Canva Pro", perfilesDefault: 1, tieneExtra2020: false, pidePass: false, pidePerfil: false, pidePin: false }
];