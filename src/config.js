import { createClient } from '@supabase/supabase-js';

export const APP_URL = typeof window !== "undefined" 
  ? window.location.origin 
  : "http://localhost:3000";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dgpijysxwshrmaihuckb.supabase.co"; 
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_vvQpxq8RVsURAXlzItrJPQ_fMIWqClX";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fecha exacta en zona horaria Bolivia (America/La_Paz UTC-4)
export const obtenerFechaBoliviaISO = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(dateObj);
};

export const sumarDiasBoliviaISO = (dias = 0, fechaBaseISO = null) => {
  const baseStr = fechaBaseISO || obtenerFechaBoliviaISO();
  const d = new Date(baseStr + "T12:00:00-04:00");
  d.setDate(d.getDate() + Number(dias));
  return obtenerFechaBoliviaISO(d);
};

export const extraerFechaLocalISO = (fechaRaw) => {
  if (!fechaRaw) return "";
  const str = String(fechaRaw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (isNaN(d.getTime())) return str.split("T")[0];
  return obtenerFechaBoliviaISO(d);
};

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

export const AUTH_CONFIG = {
  usuario: "Mateus",
  pin: "2020"
};

export const PLATAFORMAS = [
  { nombre: "Netflix", perfilesDefault: 6, tieneExtra2020: true, pidePass: true, pidePerfil: true, pidePin: true, precioCliente: 30, precioRevendedor: 28 },
  { nombre: "Disney+ / ESPN", perfilesDefault: 7, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: true, precioCliente: 20, precioRevendedor: 20 },
  { nombre: "Max (HBO)", perfilesDefault: 5, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: true, precioCliente: 9, precioRevendedor: 4 },
  { nombre: "Prime Video", perfilesDefault: 6, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: true, precioCliente: 9, precioRevendedor: 4 },
  { nombre: "Crunchyroll", perfilesDefault: 5, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: false, precioCliente: 12, precioRevendedor: 8 },
  { nombre: "Flujo TV", perfilesDefault: 3, tieneExtra2020: false, pidePass: true, pidePerfil: false, pidePin: false, precioCliente: 15, precioRevendedor: 10 },
  { nombre: "IPTV", perfilesDefault: 3, tieneExtra2020: false, pidePass: true, pidePerfil: false, pidePin: false, precioCliente: 14, precioRevendedor: 10 },
  { nombre: "Spotify (Asignada)", perfilesDefault: 1, tieneExtra2020: false, pidePass: true, pidePerfil: false, pidePin: false, precioCliente: 25, precioRevendedor: 20 },
  { nombre: "Spotify (Invitación)", perfilesDefault: 1, tieneExtra2020: false, pidePass: false, pidePerfil: false, pidePin: false, precioCliente: 30, precioRevendedor: 35 },
  { nombre: "YouTube Premium (Invitación)", perfilesDefault: 1, tieneExtra2020: false, pidePass: false, pidePerfil: false, pidePin: false, precioCliente: 30, precioRevendedor: 28 },
  { nombre: "YouTube Premium (Asignada)", perfilesDefault: 1, tieneExtra2020: false, pidePass: true, pidePerfil: false, pidePin: false, precioCliente: 22, precioRevendedor: 20 },
  { nombre: "ChatGPT Plus", perfilesDefault: 5, tieneExtra2020: false, pidePass: true, pidePerfil: false, pidePin: false, precioCliente: 28, precioRevendedor: 20 },
  { nombre: "Claude Pro", perfilesDefault: 5, tieneExtra2020: false, pidePass: true, pidePerfil: true, pidePin: false, precioCliente: 45, precioRevendedor: 40 },
  { nombre: "Gemini Pro", perfilesDefault: 1, tieneExtra2020: false, pidePass: false, pidePerfil: false, pidePin: false, precioCliente: 23, precioRevendedor: 10 },
  { nombre: "Canva Pro", perfilesDefault: 1, tieneExtra2020: false, pidePass: false, pidePerfil: false, pidePin: false, precioCliente: 12, precioRevendedor: 10 },
  { nombre: "CapCut Pro", perfilesDefault: 3, tieneExtra2020: false, pidePass: true, pidePerfil: false, pidePin: false, precioCliente: 27, precioRevendedor: 20 }
];