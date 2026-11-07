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
// 3. FECHA EXACTA DE BOLIVIA (America/La_Paz UTC-4)
// ==========================================
// Devuelve YYYY-MM-DD exacto en hora de Santa Cruz, Bolivia (nunca salta de día a las 8 PM)
export const obtenerFechaBoliviaISO = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(dateObj);
};

// Suma o resta días sobre una fecha en zona horaria Bolivia
export const sumarDiasBoliviaISO = (dias = 0, fechaBaseISO = null) => {
  const baseStr = fechaBaseISO || obtenerFechaBoliviaISO();
  const d = new Date(baseStr + "T12:00:00-04:00");
  d.setDate(d.getDate() + Number(dias));
  return obtenerFechaBoliviaISO(d);
};

// Convierte cualquier timestamp UTC de Supabase (ej. movimientos_yolo.fecha) a fecha YYYY-MM-DD de Bolivia
export const extraerFechaLocalISO = (fechaRaw) => {
  if (!fechaRaw) return "";
  const str = String(fechaRaw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (isNaN(d.getTime())) return str.split("T")[0];
  return obtenerFechaBoliviaISO(d);
};

// Formateador visual Día/Mes/Año (DD/MM/YYYY)
export const formatearFechaDMA = (fechaRaw) => {
  if (!fechaRaw) return "";
  const limpia = /^\d{4}-\d{2}-\d{2}$/.test(String(fechaRaw))
    ? String(fechaRaw)
    : extraerFechaLocalISO(fechaRaw);
  const partes = limpia.split("-");
  if (partes.length !== 3) return String(fechaRaw);
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
};

// ==========================================
// 4. CREDENCIALES Y PLATAFORMAS BASE
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