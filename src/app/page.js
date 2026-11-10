"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  supabase,
  AUTH_CONFIG,
  PLATAFORMAS,
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  sumarDiasBoliviaISO,
  extraerFechaLocalISO
} from "@/config";
import ModuloVentas from "@/components/ModuloVentas";
import ModuloStock from "@/components/ModuloStock";
import ModuloRenovaciones from "@/components/ModuloRenovaciones";
import ModuloDirectorio from "@/components/ModuloDirectorio";
import ModuloConfig from "@/components/ModuloConfig";
import ModuloEstadisticas from "@/components/ModuloEstadisticas";
import PortalRevendedor from "@/components/PortalRevendedor";
import {
  Wallet,
  TrendingUp,
  DollarSign,
  LogOut,
  Edit,
  Layers,
  ShoppingCart,
  BellRing,
  FolderSearch,
  Settings,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Bell,
  Copy,
  Trash2,
  Check,
  Calendar
} from "lucide-react";

const limpiarMontoConSigno = (val) => {
  let v = String(val).replace(/,/g, ".").replace(/[^0-9.\-+]/g, "");
  const signo = v.startsWith("-") ? "-" : v.startsWith("+") ? "+" : "";
  v = v.replace(/[\-+]/g, "");
  const partes = v.split(".");
  if (partes.length > 2) v = partes[0] + "." + partes.slice(1).join("");
  return signo + v;
};

export default function MossCRM() {
  const [montado, setMontado] = useState(false);
  const [sesionActual, setSesionActual] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [toast, setToast] = useState(null);

  const [modalNotificaciones, setModalNotificaciones] = useState(false);
  const [filtroTarjetasTop, setFiltroTarjetasTop] = useState("hoy");

  const [tabActiva, setTabActiva] = useState("ventas");
  const [nombreBilletera, setNombreBilletera] = useState("Yolo");
  const [linkWhatsappMoss, setLinkWhatsappMoss] = useState("");
  const [plataformasList, setPlataformasList] = useState(PLATAFORMAS);

  const [matrices, setMatrices] = useState([]);
  const [suscripciones, setSuscripciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [revendedores, setRevendedores] = useState([]);
  const [movimientosYolo, setMovimientosYolo] = useState([]);
  const [movimientosRevendedor, setMovimientosRevendedor] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);

  const [modalYolo, setModalYolo] = useState(false);
  const [tipoAjusteYolo, setTipoAjusteYolo] = useState("gasto");
  const [montoAjusteYolo, setMontoAjusteYolo] = useState("");
  const [descAjusteYolo, setDescAjusteYolo] = useState("");
  const [afectaGanancia, setAfectaGanancia] = useState(false);

  const registrarErrorSistema = useCallback(async (origen, mensajeError, usuarioNombre = "Sistema") => {
    try {
      await supabase.from("notificaciones_sistema").insert([
        {
          tipo: "error",
          titulo: `⚠️ Error en ${origen} (${usuarioNombre})`,
          mensaje: String(mensajeError),
          detalle_tecnico: `Origen: ${origen} | Usuario: ${usuarioNombre} | Error: ${mensajeError}`
        }
      ]);
    } catch {
      // Silencioso
    }
  }, []);

  const notificar = useCallback(
    (texto, tipo = "exito", guardarEnConsola = false) => {
      const id = Date.now();
      setToast({ id, texto, tipo });
      if (tipo === "error" && guardarEnConsola) {
        registrarErrorSistema("Sistema", texto, sesionActual?.nombre || "Admin");
      }
      setTimeout(() => {
        setToast((actual) => (actual?.id === id ? null : actual));
      }, 3000);
    },
    [registrarErrorSistema, sesionActual]
  );

  const recargarTodo = useCallback(async () => {
    const [mRes, sRes, cRes, pRes, revRes, yRes, movRevRes, platRes, ajuRes, notRes] = await Promise.all([
      supabase.from("matrices_stock").select("*, perfiles_matriz(*)").order("creado_en", { ascending: false }),
      supabase.from("suscripciones").select("*").order("creado_en", { ascending: false }),
      supabase.from("clientes").select("*").order("creado_en", { ascending: false }),
      supabase.from("proveedores").select("*").order("creado_en", { ascending: false }),
      supabase.from("revendedores").select("*").order("creado_en", { ascending: false }),
      supabase.from("movimientos_yolo").select("*").order("fecha", { ascending: false }),
      supabase.from("movimientos_revendedor").select("*").order("fecha", { ascending: false }),
      supabase.from("plataformas").select("*").order("orden", { ascending: true }).order("creado_en", { ascending: true }),
      supabase.from("ajustes_sistema").select("*"),
      supabase.from("notificaciones_sistema").select("*").order("creado_en", { ascending: false }).limit(60)
    ]);

    if (mRes.data) setMatrices(mRes.data);
    if (sRes.data) setSuscripciones(sRes.data);
    if (cRes.data) setClientes(cRes.data);
    if (pRes.data) setProveedores(pRes.data);
    if (revRes.data) setRevendedores(revRes.data);
    if (yRes.data) setMovimientosYolo(yRes.data);
    if (movRevRes.data) setMovimientosRevendedor(movRevRes.data);
    if (notRes.data) setNotificaciones(notRes.data);

    if (platRes.data && platRes.data.length > 0) {
      setPlataformasList(
        platRes.data.map((p, idx) => ({
          id: p.id,
          nombre: p.nombre,
          orden: p.orden ?? idx + 1,
          perfilesDefault: p.perfiles_default ?? 5,
          tieneExtra2020: p.tiene_extra_2020 ?? false,
          pidePass: p.pide_pass ?? true,
          pidePerfil: p.pide_perfil ?? true,
          pidePin: p.pide_pin ?? true,
          precioCliente: p.precio_cliente ?? 20,
          precioRevendedor: p.precio_revendedor ?? 10
        }))
      );
    }

    if (ajuRes.data && ajuRes.data.length > 0) {
      const bDB = ajuRes.data.find((a) => a.clave === "nombre_billetera");
      const lDB = ajuRes.data.find((a) => a.clave === "link_whatsapp_moss");
      if (bDB?.valor) setNombreBilletera(bDB.valor);
      if (lDB?.valor !== undefined) setLinkWhatsappMoss(lDB.valor);
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    const guardada = localStorage.getItem("moss_sesion_v3");
    if (guardada) {
      try {
        setSesionActual(JSON.parse(guardada));
      } catch {
        localStorage.removeItem("moss_sesion_v3");
      }
    }
    recargarTodo();
  }, [recargarTodo]);

  if (!montado) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    const u = userInput.trim().toLowerCase();
    const p = pinInput.trim();

    if (u === AUTH_CONFIG.usuario.toLowerCase() && p === AUTH_CONFIG.pin) {
      const nuevaSesion = { rol: "admin", nombre: "Mateus" };
      localStorage.setItem("moss_sesion_v3", JSON.stringify(nuevaSesion));
      setSesionActual(nuevaSesion);
      await recargarTodo();
      return notificar("¡Bienvenido a tu Panel Admin, Mateus!");
    }

    const revEncontrado = revendedores.find(
      (r) =>
        r.activo !== false &&
        ((r.usuario || r.nombre || "").trim().toLowerCase() === u || r.telefono.trim() === u) &&
        String(r.pin || "1234").trim() === p
    );

    if (revEncontrado) {
      const nuevaSesion = {
        rol: "revendedor",
        revendedorId: revEncontrado.id,
        nombre: revEncontrado.nombre
      };
      localStorage.setItem("moss_sesion_v3", JSON.stringify(nuevaSesion));
      setSesionActual(nuevaSesion);
      await recargarTodo();
      return notificar(`¡Bienvenido, ${revEncontrado.nombre}!`);
    }

    notificar("Usuario o PIN incorrecto (Verifica tus datos)", "error", false);
  };

  const marcarCobroRevendedorComoPagado = async (notif) => {
    await supabase
      .from("notificaciones_sistema")
      .update({ pagado: true, leido: true })
      .eq("id", notif.id);

    if (notif.suscripcion_id) {
      await supabase
        .from("suscripciones")
        .update({ pagado_al_admin: true })
        .eq("id", notif.suscripcion_id);
    }

    if (Number(notif.monto_cobrar) > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          tipo: "Ingreso Venta",
          monto: Math.abs(Number(notif.monto_cobrar)),
          afecta_ganancia_neta: true,
          descripcion: `Pago recibido de revendedor ${notif.nombre_revendedor || ""} (${notif.titulo})`,
          referencia_id: notif.suscripcion_id
        }
      ]);
    }

    await recargarTodo();
    notificar(`¡Pago de Bs ${notif.monto_cobrar} registrado en ${nombreBilletera}!`);
  };

  // Liquidar todas las cuentas pendientes de pago de golpe
  const cobrarTodasLasPendientes = async () => {
    const pendientes = notificaciones.filter((n) => n.tipo === "venta_revendedor" && !n.pagado);
    if (pendientes.length === 0) return;

    let sumaTotal = 0;
    for (const n of pendientes) {
      sumaTotal += Number(n.monto_cobrar || 0);
      await supabase.from("notificaciones_sistema").update({ pagado: true, leido: true }).eq("id", n.id);
      if (n.suscripcion_id) {
        await supabase.from("suscripciones").update({ pagado_al_admin: true }).eq("id", n.suscripcion_id);
      }
      if (Number(n.monto_cobrar) > 0) {
        await supabase.from("movimientos_yolo").insert([
          {
            tipo: "Ingreso Venta",
            monto: Math.abs(Number(n.monto_cobrar)),
            afecta_ganancia_neta: true,
            descripcion: `Liquidación de cobro revendedor ${n.nombre_revendedor || ""} (${n.titulo})`,
            referencia_id: n.suscripcion_id
          }
        ]);
      }
    }
    await recargarTodo();
    notificar(`¡${pendientes.length} cobros marcados como Pagados (+Bs ${sumaTotal.toFixed(2)})!`);
  };

  const hoyBolivia = obtenerFechaBoliviaISO();
  const hace7DiasBolivia = sumarDiasBoliviaISO(-6, hoyBolivia);
  const mesActualBolivia = hoyBolivia.slice(0, 7);

  const cumpleFiltroTop = (fechaRaw) => {
    const f = extraerFechaLocalISO(fechaRaw);
    if (filtroTarjetasTop === "hoy") return f === hoyBolivia;
    if (filtroTarjetasTop === "semana") return f >= hace7DiasBolivia && f <= hoyBolivia;
    if (filtroTarjetasTop === "mes") return f.startsWith(mesActualBolivia);
    return true;
  };

  const calcularGananciaUnitariaVenta = (s) => {
    const cobrado = Number(s.precio_venta || 0);
    if (s.origen === "stock" && s.matriz_id) {
      const mat = matrices.find((m) => m.id === s.matriz_id);
      if (mat && Number(mat.costo_total) > 0) {
        const costoCupo = Number(mat.costo_total) / Math.max(1, Number(mat.capacidad_total || 5));
        return cobrado - costoCupo;
      }
      return cobrado;
    }
    return cobrado - Number(s.costo_proveedor || 0);
  };

  const ventasEnPeriodoTop = suscripciones.filter(
    (s) => !s.en_papelera && cumpleFiltroTop(s.fecha_venta)
  );

  const ingresoMostradoTop = ventasEnPeriodoTop.reduce(
    (acc, s) => acc + Number(s.precio_venta || 0),
    0
  );

  const ajustesEnPeriodoTop = movimientosYolo
    .filter(
      (m) =>
        m.tipo === "Ajuste Manual" &&
        m.afecta_ganancia_neta &&
        cumpleFiltroTop(m.fecha)
    )
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const gananciaMostradaTop =
    filtroTarjetasTop === "siempre"
      ? movimientosYolo
          .filter((m) => m.afecta_ganancia_neta)
          .reduce((acc, m) => acc + Number(m.monto || 0), 0)
      : ventasEnPeriodoTop.reduce((acc, s) => acc + calcularGananciaUnitariaVenta(s), 0) +
        ajustesEnPeriodoTop;

  const saldoActualYolo = movimientosYolo.reduce((acc, m) => acc + Number(m.monto), 0);

  const etiquetaPeriodoTop =
    filtroTarjetasTop === "hoy"
      ? `DE HOY (${formatearFechaDMA(hoyBolivia).slice(0, 5)})`
      : filtroTarjetasTop === "semana"
      ? "DE ESTA SEMANA (7D)"
      : filtroTarjetasTop === "mes"
      ? "DE ESTE MES"
      : "HISTÓRICO SIEMPRE";

  const hoy = new Date(hoyBolivia + "T00:00:00-04:00");
  const cantidadPorRenovar = suscripciones.filter((s) => {
    if (s.en_papelera || s.estado !== "Activa") return false;
    const corte = new Date(s.fecha_corte + "T00:00:00-04:00");
    const dias = Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
    const venceCliente = dias <= 3 && !s.avisado_renovacion;
    const venceProveedorIntermedio =
      s.fecha_renovacion_proveedor &&
      s.fecha_renovacion_proveedor < s.fecha_corte &&
      Math.ceil((new Date(s.fecha_renovacion_proveedor + "T00:00:00-04:00") - hoy) / (1000 * 60 * 60 * 24)) <= 3;
    return venceCliente || venceProveedorIntermedio;
  }).length;

  const cantidadCaidos = suscripciones.filter((s) => !s.en_papelera && s.estado === "Caida").length;

  const cobrosPendientesCount = notificaciones.filter(
    (n) => n.tipo === "venta_revendedor" && !n.pagado
  ).length;
  const erroresCount = notificaciones.filter((n) => n.tipo === "error" && !n.leido).length;
  const alertasTotalesBadge = cobrosPendientesCount + erroresCount;

  const registrarAjusteYolo = async (e) => {
    e.preventDefault();
    const numBase = parseFloat(montoAjusteYolo);
    if (isNaN(numBase) || numBase === 0) {
      return notificar("Ingresa un monto numérico válido", "error");
    }
    const montoFinal =
      String(montoAjusteYolo).startsWith("-")
        ? -Math.abs(numBase)
        : String(montoAjusteYolo).startsWith("+")
        ? Math.abs(numBase)
        : tipoAjusteYolo === "gasto"
        ? -Math.abs(numBase)
        : Math.abs(numBase);

    await supabase.from("movimientos_yolo").insert([
      {
        tipo: "Ajuste Manual",
        monto: montoFinal,
        afecta_ganancia_neta: afectaGanancia,
        descripcion: descAjusteYolo || `Ajuste / Gasto manual en ${nombreBilletera}`
      }
    ]);

    setMontoAjusteYolo("");
    setDescAjusteYolo("");
    setModalYolo(false);
    await recargarTodo();
    notificar(`Saldo de ${nombreBilletera} actualizado`);
  };

  const revendedorLogueadoObj =
    sesionActual?.rol === "revendedor"
      ? revendedores.find((r) => r.id === sesionActual.revendedorId)
      : null;

  return (
    <div className="min-h-screen text-white pb-16">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-2xl border-2 shadow-2xl flex items-center gap-2.5 animate-modal backdrop-blur-xl ${
            toast.tipo === "error"
              ? "bg-red-950/95 border-red-500 text-red-100"
              : "bg-[#10200E]/95 border-[#66FF00] text-white shadow-[0_0_25px_rgba(102,255,0,0.35)]"
          }`}
        >
          {toast.tipo === "error" ? (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-[#66FF00] shrink-0" />
          )}
          <span className="text-xs font-extrabold">{toast.texto}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!sesionActual ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <form
            onSubmit={handleLogin}
            className="bg-[#0E170D]/90 backdrop-blur-xl border-2 border-[#66FF00] rounded-3xl p-8 max-w-sm w-full text-center space-y-5 shadow-[0_0_50px_rgba(102,255,0,0.25)] animate-modal"
          >
            <div className="w-24 h-24 mx-auto rounded-full border-2 border-[#66FF00] flex items-center justify-center bg-[#070B06] shadow-[0_0_25px_rgba(102,255,0,0.5)]">
              <span className="text-5xl font-black text-[#66FF00]">M</span>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-widest text-white">MOSS</h1>
              <p className="text-xs text-[#66FF00] font-semibold tracking-wider uppercase mt-1">
                Acceso Admin & Revendedores
              </p>
            </div>
            <div className="space-y-3 text-left">
              <div>
                <label className="text-xs text-gray-400">Usuario o Teléfono</label>
                <input
                  type="text"
                  placeholder="Tu usuario"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-3 text-white focus:border-[#66FF00] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">PIN / Contraseña</label>
                <input
                  type="password"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-3 text-white text-center tracking-widest focus:border-[#66FF00] outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-[#66FF00] to-[#45B800] hover:brightness-110 text-black font-black rounded-xl shadow-[0_0_20px_rgba(102,255,0,0.4)] transition cursor-pointer"
            >
              ENTRAR AL SISTEMA
            </button>
          </form>
        </div>
      ) : sesionActual.rol === "revendedor" ? (
        <>
          <header className="border-b border-[#66FF00]/20 bg-[#0A1209]/90 sticky top-0 z-40 backdrop-blur-xl">
            <div className="max-w-5xl mx-auto px-4 py-3.5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-[#66FF00] flex items-center justify-center bg-[#070B06]">
                  <span className="text-xl font-black text-[#66FF00]">M</span>
                </div>
                <div>
                  <h1 className="font-black text-base text-white">
                    MOSS · Panel de {revendedorLogueadoObj?.nombre || sesionActual.nombre}
                  </h1>
                  <span className="text-[11px] text-[#66FF00]">Portal Oficial de Revendedor</span>
                </div>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem("moss_sesion_v3");
                  setSesionActual(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#142013] border border-[#233820] text-xs text-gray-300 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Salir
              </button>
            </div>
          </header>

          <main className="max-w-5xl mx-auto px-4 pt-6">
            {revendedorLogueadoObj ? (
              <PortalRevendedor
                revendedor={revendedorLogueadoObj}
                suscripciones={suscripciones}
                matrices={matrices}
                movimientosRevendedor={movimientosRevendedor.filter(
                  (m) => m.revendedor_id === revendedorLogueadoObj.id
                )}
                plataformasList={plataformasList}
                recargarTodo={recargarTodo}
                notificar={notificar}
                registrarErrorSistema={registrarErrorSistema}
              />
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">
                Cargando tu perfil de revendedor...
              </div>
            )}
          </main>
        </>
      ) : (
        <>
          <header className="border-b border-[#66FF00]/20 bg-[#0A1209]/85 sticky top-0 z-40 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
            <div className="max-w-6xl mx-auto px-4 py-3.5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full border-2 border-[#66FF00] flex items-center justify-center bg-[#070B06] shadow-[0_0_15px_rgba(102,255,0,0.6)]">
                  <span className="text-2xl font-black text-[#66FF00]">M</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-black tracking-widest text-xl leading-none text-white">MOSS</h1>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-[#66FF00]/15 text-[#66FF00] border border-[#66FF00]/40 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> ADMIN CRM
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">Panel de Mateus</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setModalNotificaciones(true)}
                  className="relative px-3.5 py-2 rounded-xl bg-[#142013] hover:bg-[#1E311C] border border-[#66FF00]/50 flex items-center gap-1.5 text-xs font-extrabold text-white cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#66FF00]" />
                  <span>Alertas / Cobros</span>
                  {alertasTotalesBadge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-black text-[10px]">
                      {alertasTotalesBadge}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    localStorage.removeItem("moss_sesion_v3");
                    setSesionActual(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-[#142013] hover:bg-red-950/60 border border-[#233820] flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Salir
                </button>
              </div>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 pt-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0E170D]/90 px-4 py-2.5 rounded-2xl border border-[#233820]">
              <span className="text-xs text-gray-400 font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#66FF00]" /> Resumen superior mostrando:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "hoy", label: "Hoy" },
                  { id: "semana", label: "Esta Semana" },
                  { id: "mes", label: "Este Mes" },
                  { id: "siempre", label: "Siempre (Total)" }
                ].map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setFiltroTarjetasTop(op.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                      filtroTarjetasTop === op.id
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226] hover:border-[#66FF00]/50"
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-[#121D11] to-[#0B120A] border border-[#264023] rounded-2xl p-5 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Ingreso {etiquetaPeriodoTop}
                  </p>
                  <p className="text-3xl font-black text-white mt-1">Bs {ingresoMostradoTop.toFixed(2)}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{ventasEnPeriodoTop.length} venta(s) en este periodo</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#66FF00]/10 border border-[#66FF00]/30 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-[#66FF00]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#121D11] to-[#0B120A] border border-[#264023] rounded-2xl p-5 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Ganancia Neta {etiquetaPeriodoTop}
                  </p>
                  <p className={`text-3xl font-black mt-1 ${gananciaMostradaTop >= 0 ? "text-[#66FF00]" : "text-red-400"}`}>
                    Bs {gananciaMostradaTop.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Ganancia libre del periodo</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#66FF00]/10 border border-[#66FF00]/30 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-[#66FF00]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#1B3018] via-[#122110] to-[#0B140A] border-2 border-[#66FF00] rounded-2xl p-5 flex items-center justify-between shadow-[0_0_25px_rgba(102,255,0,0.18)]">
                <div>
                  <p className="text-xs text-[#66FF00] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#66FF00] animate-ping" /> Saldo en {nombreBilletera}
                  </p>
                  <p className="text-3xl font-black text-white mt-1">Bs {saldoActualYolo.toFixed(2)}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Saldo total acumulado</p>
                </div>
                <button
                  onClick={() => setModalYolo(true)}
                  className="px-3.5 py-2.5 bg-[#66FF00] hover:bg-[#52cc00] text-black rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Gasto / Editar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#0E170D]/90 p-2 rounded-2xl border border-[#264023] shadow-xl">
              <button
                onClick={() => setTabActiva("ventas")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  tabActiva === "ventas"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black"
                    : "text-gray-300 hover:bg-[#162414]"
                }`}
              >
                <ShoppingCart className="w-4 h-4" /> Ventas
              </button>

              <button
                onClick={() => setTabActiva("estadisticas")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  tabActiva === "estadisticas"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black"
                    : "text-gray-300 hover:bg-[#162414]"
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Estadísticas
              </button>

              <button
                onClick={() => setTabActiva("stock")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  tabActiva === "stock"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black"
                    : "text-gray-300 hover:bg-[#162414]"
                }`}
              >
                <Layers className="w-4 h-4" /> Stock ({matrices.filter((m) => !m.en_papelera).length})
              </button>

              <button
                onClick={() => setTabActiva("renovaciones")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  tabActiva === "renovaciones"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black"
                    : "text-gray-300 hover:bg-[#162414]"
                }`}
              >
                <BellRing className="w-4 h-4" /> Renovaciones
                {cantidadPorRenovar > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-orange-500 text-black">
                    {cantidadPorRenovar}
                  </span>
                )}
              </button>

              <button
                onClick={() => setTabActiva("directorio")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  tabActiva === "directorio"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black"
                    : "text-gray-300 hover:bg-[#162414]"
                }`}
              >
                <FolderSearch className="w-4 h-4" /> Directorio ({suscripciones.filter((s) => !s.en_papelera).length})
                {cantidadCaidos > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-red-600 text-white">
                    {cantidadCaidos}
                  </span>
                )}
              </button>

              <button
                onClick={() => setTabActiva("config")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  tabActiva === "config"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black"
                    : "text-gray-300 hover:bg-[#162414]"
                }`}
              >
                <Settings className="w-4 h-4" /> Ajustes
              </button>
            </div>

            {tabActiva === "ventas" && (
              <ModuloVentas
                matrices={matrices}
                clientes={clientes}
                proveedores={proveedores}
                revendedores={revendedores}
                suscripciones={suscripciones}
                linkWhatsappMoss={linkWhatsappMoss}
                plataformasList={plataformasList}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "estadisticas" && (
              <ModuloEstadisticas
                suscripciones={suscripciones}
                matrices={matrices}
                movimientosYolo={movimientosYolo}
                revendedores={revendedores}
                nombreBilletera={nombreBilletera}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "stock" && (
              <ModuloStock
                matrices={matrices}
                suscripciones={suscripciones}
                proveedores={proveedores}
                plataformasList={plataformasList}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "renovaciones" && (
              <ModuloRenovaciones
                suscripciones={suscripciones}
                matrices={matrices}
                proveedores={proveedores}
                revendedores={revendedores}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "directorio" && (
              <ModuloDirectorio
                suscripciones={suscripciones}
                matrices={matrices}
                clientes={clientes}
                proveedores={proveedores}
                revendedores={revendedores}
                linkWhatsappMoss={linkWhatsappMoss}
                plataformasList={plataformasList}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "config" && (
              <ModuloConfig
                matrices={matrices}
                suscripciones={suscripciones}
                clientes={clientes}
                proveedores={proveedores}
                revendedores={revendedores}
                movimientosYolo={movimientosYolo}
                nombreBilletera={nombreBilletera}
                setNombreBilletera={setNombreBilletera}
                linkWhatsappMoss={linkWhatsappMoss}
                setLinkWhatsappMoss={setLinkWhatsappMoss}
                plataformasList={plataformasList}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}
          </main>

          {modalNotificaciones && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-2xl w-full space-y-5 max-h-[90vh] overflow-y-auto animate-modal">
                <div className="flex justify-between items-center border-b border-[#233820] pb-3">
                  <h3 className="font-black text-[#66FF00] text-base flex items-center gap-2">
                    <Bell className="w-5 h-5" /> Centro de Cobros (Stock y Renovaciones de Revendedores)
                  </h3>
                  <button onClick={() => setModalNotificaciones(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h4 className="text-xs font-extrabold uppercase text-amber-300">
                      🛒 Cuentas de Stock y Renovaciones por Cobrar ({notificaciones.filter((n) => n.tipo === "venta_revendedor").length})
                    </h4>
                    {cobrosPendientesCount > 1 && (
                      <button
                        onClick={cobrarTodasLasPendientes}
                        className="px-3.5 py-1.5 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer"
                      >
                        ✅ Marcar Todas como Pagadas ({cobrosPendientesCount})
                      </button>
                    )}
                  </div>

                  {notificaciones.filter((n) => n.tipo === "venta_revendedor").length === 0 ? (
                    <p className="text-xs text-gray-500 bg-[#070B06] p-3 rounded-xl">
                      No hay cuentas ni renovaciones pendientes de cobro.
                    </p>
                  ) : (
                    notificaciones
                      .filter((n) => n.tipo === "venta_revendedor")
                      .map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 rounded-2xl border flex flex-wrap justify-between items-center gap-3 text-xs ${
                            n.pagado
                              ? "bg-[#070B06] border-[#1E331A] opacity-70"
                              : "bg-amber-950/30 border-amber-500"
                          }`}
                        >
                          <div className="space-y-1">
                            <p className="font-black text-white text-sm">{n.titulo}</p>
                            <p className="text-gray-300">{n.mensaje}</p>
                            <p className="text-[10px] text-gray-500">{formatearFechaDMA(n.creado_en)}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            {n.pagado ? (
                              <span className="px-3 py-1.5 rounded-xl bg-green-900/40 text-green-300 font-bold">
                                ✓ Pagado (Bs {n.monto_cobrar})
                              </span>
                            ) : (
                              <button
                                onClick={() => marcarCobroRevendedorComoPagado(n)}
                                className="px-4 py-2 bg-[#66FF00] hover:bg-[#52cc00] text-black font-black rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(102,255,0,0.4)]"
                              >
                                <Check className="w-4 h-4" /> Marcar Pagado (+Bs {n.monto_cobrar})
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                await supabase.from("notificaciones_sistema").delete().eq("id", n.id);
                                await recargarTodo();
                              }}
                              className="p-1.5 text-gray-500 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>

                <div className="space-y-2.5 pt-3 border-t border-[#233820]">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-extrabold uppercase text-red-400">
                      🛠️ Registro Técnico de Errores ({notificaciones.filter((n) => n.tipo === "error").length})
                    </h4>
                    {notificaciones.some((n) => n.tipo === "error") && (
                      <button
                        onClick={async () => {
                          await supabase.from("notificaciones_sistema").delete().eq("tipo", "error");
                          await recargarTodo();
                        }}
                        className="text-[11px] text-gray-400 hover:text-white underline cursor-pointer"
                      >
                        Limpiar todos
                      </button>
                    )}
                  </div>

                  {notificaciones.filter((n) => n.tipo === "error").length === 0 ? (
                    <p className="text-xs text-gray-500 bg-[#070B06] p-3 rounded-xl">
                      ✓ Sin errores registrados. Todo funciona limpio.
                    </p>
                  ) : (
                    notificaciones
                      .filter((n) => n.tipo === "error")
                      .map((err) => (
                        <div
                          key={err.id}
                          className="bg-red-950/30 border border-red-600/50 rounded-2xl p-3 flex flex-wrap justify-between items-center gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-red-300">{err.titulo}</p>
                            <p className="text-gray-300 font-mono text-[11px] break-all mt-0.5">{err.mensaje}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(err.detalle_tecnico || err.mensaje);
                                notificar("Error copiado");
                              }}
                              className="px-3 py-1.5 bg-red-600 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copiar
                            </button>
                            <button
                              onClick={async () => {
                                await supabase.from("notificaciones_sistema").delete().eq("id", err.id);
                                await recargarTodo();
                              }}
                              className="p-1.5 text-gray-400 hover:text-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {modalYolo && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <form
                onSubmit={registrarAjusteYolo}
                className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4 animate-modal"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-[#66FF00] flex items-center gap-2">
                    <Wallet className="w-5 h-5" /> Ajustar Saldo en {nombreBilletera}
                  </h3>
                  <button type="button" onClick={() => setModalYolo(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoAjusteYolo("gasto")}
                    className={`py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      tipoAjusteYolo === "gasto"
                        ? "bg-red-600 text-white border-red-400"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    ➖ Gasto / Retiro (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoAjusteYolo("ingreso")}
                    className={`py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      tipoAjusteYolo === "ingreso"
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    ➕ Ingreso Extra (+)
                  </button>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Monto (Bs)</label>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Ej: 15.50"
                    value={montoAjusteYolo}
                    onChange={(e) => setMontoAjusteYolo(limpiarMontoConSigno(e.target.value))}
                    className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Motivo / Descripción</label>
                  <input
                    type="text"
                    placeholder="Ej: Retiro o pago"
                    value={descAjusteYolo}
                    onChange={(e) => setDescAjusteYolo(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={afectaGanancia}
                    onChange={(e) => setAfectaGanancia(e.target.checked)}
                  />
                  ¿Afecta también la Ganancia Neta?
                </label>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setModalYolo(false)} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}