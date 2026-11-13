"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  supabase,
  AUTH_CONFIG,
  PLATAFORMAS,
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  obtenerLunesDeSemanaBolivia,
  obtenerDomingoDeSemanaBolivia,
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
  Trash2,
  Check,
  Calendar,
  Truck,
  Edit3
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

  const [subAdmins, setSubAdmins] = useState([]);
  const [matrices, setMatrices] = useState([]);
  const [suscripciones, setSuscripciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [revendedores, setRevendedores] = useState([]);
  const [movimientosYolo, setMovimientosYolo] = useState([]);
  const [movimientosRevendedor, setMovimientosRevendedor] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);

  // Estados del Modal de Banco (Registrar, Editar o Eliminar Gastos/Ingresos)
  const [modalYolo, setModalYolo] = useState(false);
  const [tipoAjusteYolo, setTipoAjusteYolo] = useState("gasto");
  const [montoAjusteYolo, setMontoAjusteYolo] = useState("");
  const [descAjusteYolo, setDescAjusteYolo] = useState("");
  const [afectaGanancia, setAfectaGanancia] = useState(false);
  const [movEditandoBanco, setMovEditandoBanco] = useState(null);
  const [confirmEliminarMovId, setConfirmEliminarMovId] = useState(null);

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
    const [mRes, sRes, cRes, pRes, revRes, yRes, movRevRes, platRes, ajuRes, notRes, subAdmRes] = await Promise.all([
      supabase.from("matrices_stock").select("*, perfiles_matriz(*)").order("creado_en", { ascending: false }),
      supabase.from("suscripciones").select("*").order("creado_en", { ascending: false }),
      supabase.from("clientes").select("*").order("creado_en", { ascending: false }),
      supabase.from("proveedores").select("*").order("creado_en", { ascending: false }),
      supabase.from("revendedores").select("*").order("creado_en", { ascending: false }),
      supabase.from("movimientos_yolo").select("*").order("fecha", { ascending: false }),
      supabase.from("movimientos_revendedor").select("*").order("fecha", { ascending: false }),
      supabase.from("plataformas").select("*").order("orden", { ascending: true }).order("creado_en", { ascending: true }),
      supabase.from("ajustes_sistema").select("*"),
      supabase.from("notificaciones_sistema").select("*").order("creado_en", { ascending: false }).limit(80),
      supabase.from("sub_admins").select("*").order("creado_en", { ascending: true })
    ]);

    if (mRes.data) setMatrices(mRes.data);
    if (sRes.data) setSuscripciones(sRes.data);
    if (cRes.data) setClientes(cRes.data);
    if (pRes.data) setProveedores(pRes.data);
    if (revRes.data) setRevendedores(revRes.data);
    if (yRes.data) setMovimientosYolo(yRes.data);
    if (movRevRes.data) setMovimientosRevendedor(movRevRes.data);
    if (notRes.data) setNotificaciones(notRes.data);
    if (subAdmRes.data) setSubAdmins(subAdmRes.data);

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
          precioRevendedor: p.precio_revendedor ?? 10,
          precioSubAdmin: p.precio_subadmin ?? p.precio_revendedor ?? 10
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

    const canalRealtime = supabase
      .channel("moss-realtime-sync")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        recargarTodo();
      })
      .subscribe();

    const intervaloVivo = setInterval(() => {
      recargarTodo();
    }, 6000);

    const alVolverALaVentana = () => recargarTodo();
    window.addEventListener("focus", alVolverALaVentana);

    return () => {
      supabase.removeChannel(canalRealtime);
      clearInterval(intervaloVivo);
      window.removeEventListener("focus", alVolverALaVentana);
    };
  }, [recargarTodo]);

  if (!montado) return null;

  const esSuperAdmin = sesionActual?.rol === "admin";
  const esSubAdmin = sesionActual?.rol === "subadmin";
  const adminKeyActual = esSubAdmin ? sesionActual.subAdminId : "admin";

  const subAdminLogueadoObj = esSubAdmin
    ? subAdmins.find((sa) => sa.id === sesionActual.subAdminId)
    : null;

  const nombreBilleteraMostrada = esSubAdmin
    ? subAdminLogueadoObj?.nombre_billetera || `Billetera ${sesionActual.nombre}`
    : nombreBilletera;

  const handleLogin = async (e) => {
    e.preventDefault();
    const u = userInput.trim().toLowerCase();
    const p = pinInput.trim();

    if (u === AUTH_CONFIG.usuario.toLowerCase() && p === AUTH_CONFIG.pin) {
      const nuevaSesion = { rol: "admin", adminKey: "admin", nombre: "Mateus" };
      localStorage.setItem("moss_sesion_v3", JSON.stringify(nuevaSesion));
      setSesionActual(nuevaSesion);
      await recargarTodo();
      return notificar("¡Bienvenido a tu Panel Principal, Mateus!");
    }

    const subAdmEncontrado = subAdmins.find(
      (sa) =>
        sa.activo !== false &&
        ((sa.usuario || sa.nombre || "").trim().toLowerCase() === u || sa.telefono.trim() === u) &&
        String(sa.pin || "1234").trim() === p
    );

    if (subAdmEncontrado) {
      const nuevaSesion = {
        rol: "subadmin",
        subAdminId: subAdmEncontrado.id,
        adminKey: subAdmEncontrado.id,
        nombre: subAdmEncontrado.nombre,
        telefono: subAdmEncontrado.telefono
      };
      localStorage.setItem("moss_sesion_v3", JSON.stringify(nuevaSesion));
      setSesionActual(nuevaSesion);
      await recargarTodo();
      return notificar(`¡Bienvenido a tu Panel Admin, ${subAdmEncontrado.nombre}!`);
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

  const misNotificacionesCobro = notificaciones.filter(
    (n) =>
      n.tipo === "venta_revendedor" &&
      (n.admin_destino || "admin") === adminKeyActual
  );

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
          admin_propietario: adminKeyActual,
          tipo: "Ingreso Venta",
          monto: Math.abs(Number(notif.monto_cobrar)),
          afecta_ganancia_neta: true,
          descripcion: `Pago recibido (${notif.nombre_revendedor || "Agente"}): ${notif.titulo}`,
          referencia_id: notif.suscripcion_id
        }
      ]);
    }

    await recargarTodo();
    notificar(`¡Pago de Bs ${notif.monto_cobrar} registrado en ${nombreBilleteraMostrada}!`);
  };

  const cobrarTodasLasPendientes = async () => {
    const pendientes = misNotificacionesCobro.filter((n) => !n.pagado);
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
            admin_propietario: adminKeyActual,
            tipo: "Ingreso Venta",
            monto: Math.abs(Number(n.monto_cobrar)),
            afecta_ganancia_neta: true,
            descripcion: `Liquidación de cobro (${n.nombre_revendedor || "Agente"}): ${n.titulo}`,
            referencia_id: n.suscripcion_id
          }
        ]);
      }
    }
    await recargarTodo();
    notificar(`¡${pendientes.length} cobros marcados como Pagados (+Bs ${sumaTotal.toFixed(2)})!`);
  };

  const esCuentaDeMarcusVinculadaAMateus = (s) => {
    if ((s.admin_propietario || "admin") === "admin") return false;
    const provMoss = String(s.nombre_proveedor || "").toLowerCase().includes("moss");
    const matDeMateus =
      s.matriz_id &&
      (matrices.find((m) => m.id === s.matriz_id)?.admin_propietario || "admin") === "admin";
    return provMoss || Boolean(matDeMateus) || s.tipo_comprador === "subadmin";
  };

  const misSuscripcionesPropias = suscripciones.filter(
    (s) => (s.admin_propietario || "admin") === adminKeyActual
  );

  const misMatricesPropias = matrices.filter(
    (m) => !m.en_papelera && (m.admin_propietario || "admin") === adminKeyActual
  );

  const misMovimientosBilleteraPropios = movimientosYolo.filter(
    (m) => (m.admin_propietario || "admin") === adminKeyActual
  );

  const misRevendedoresPropios = revendedores.filter(
    (r) => (r.admin_propietario || "admin") === adminKeyActual
  );

  const hoyBolivia = obtenerFechaBoliviaISO();
  const lunesEstaSemana = obtenerLunesDeSemanaBolivia(hoyBolivia);
  const domingoEstaSemana = obtenerDomingoDeSemanaBolivia(hoyBolivia);
  const mesActualBolivia = hoyBolivia.slice(0, 7);

  const cumpleFiltroTop = (fechaRaw) => {
    const f = extraerFechaLocalISO(fechaRaw);
    if (filtroTarjetasTop === "hoy") return f === hoyBolivia;
    if (filtroTarjetasTop === "semana") return f >= lunesEstaSemana && f <= domingoEstaSemana;
    if (filtroTarjetasTop === "mes") return f.startsWith(mesActualBolivia);
    return true;
  };

  const calcularGananciaUnitariaVenta = (s) => {
    const cobrado = Number(s.precio_venta || 0);
    if (s.origen === "stock" && s.matriz_id) {
      const mat = matrices.find((m) => m.id === s.matriz_id);
      if ((s.admin_propietario || "admin") !== "admin" && (mat?.admin_propietario || "admin") === "admin") {
        return cobrado - Number(s.costo_proveedor || 0);
      }
      if (mat && Number(mat.costo_total) > 0) {
        const costoCupo = Number(mat.costo_total) / Math.max(1, Number(mat.capacidad_total || 5));
        return cobrado - costoCupo;
      }
      return cobrado - Number(s.costo_proveedor || 0);
    }
    return cobrado - Number(s.costo_proveedor || 0);
  };

  const ventasEnPeriodoTop = misSuscripcionesPropias.filter(
    (s) => !s.en_papelera && cumpleFiltroTop(s.fecha_venta)
  );

  const ingresoMostradoTop = ventasEnPeriodoTop.reduce(
    (acc, s) => acc + Number(s.precio_venta || 0),
    0
  );

  const ajustesEnPeriodoTop = misMovimientosBilleteraPropios
    .filter(
      (m) =>
        m.tipo === "Ajuste Manual" &&
        m.afecta_ganancia_neta &&
        cumpleFiltroTop(m.fecha)
    )
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const gananciaMostradaTop =
    ventasEnPeriodoTop.reduce((acc, s) => acc + calcularGananciaUnitariaVenta(s), 0) +
    ajustesEnPeriodoTop;

  const gastoMatricesPeriodoTop = misMatricesPropias
    .filter((m) => cumpleFiltroTop(m.fecha_compra))
    .reduce((acc, m) => acc + Number(m.costo_total || 0), 0);

  const fiadoDeMateusPeriodoTop = esSubAdmin
    ? ventasEnPeriodoTop
        .filter((s) => esCuentaDeMarcusVinculadaAMateus(s))
        .reduce((acc, s) => acc + Number(s.costo_proveedor || 0), 0)
    : 0;

  const deudaPendienteFieMarcus = esSubAdmin
    ? misSuscripcionesPropias
        .filter((s) => !s.en_papelera && esCuentaDeMarcusVinculadaAMateus(s) && s.pagado_al_admin === false)
        .reduce((acc, s) => acc + Number(s.costo_proveedor || 0), 0)
    : 0;

  const pagadoProveedoresExternosTop = ventasEnPeriodoTop
    .filter((s) => !esCuentaDeMarcusVinculadaAMateus(s))
    .reduce((acc, s) => acc + Number(s.costo_proveedor || 0), 0);

  const saldoActualYolo = misMovimientosBilleteraPropios.reduce((acc, m) => acc + Number(m.monto), 0);

  const etiquetaPeriodoTop =
    filtroTarjetasTop === "hoy"
      ? `DE HOY (${formatearFechaDMA(hoyBolivia).slice(0, 5)})`
      : filtroTarjetasTop === "semana"
      ? `ESTA SEMANA (${formatearFechaDMA(lunesEstaSemana).slice(0, 5)} - ${formatearFechaDMA(domingoEstaSemana).slice(0, 5)})`
      : filtroTarjetasTop === "mes"
      ? "DE ESTE MES"
      : "HISTÓRICO";

  const hoy = new Date(hoyBolivia + "T00:00:00-04:00");
  const cantidadPorRenovar = misSuscripcionesPropias.filter((s) => {
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

  const cantidadCaidos = misSuscripcionesPropias.filter((s) => !s.en_papelera && s.estado === "Caida").length;

  const cobrosPendientesCount = misNotificacionesCobro.filter((n) => !n.pagado).length;
  const erroresCount = esSuperAdmin
    ? notificaciones.filter((n) => n.tipo === "error" && !n.leido).length
    : 0;
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
        admin_propietario: adminKeyActual,
        tipo: "Ajuste Manual",
        monto: montoFinal,
        afecta_ganancia_neta: afectaGanancia,
        descripcion: descAjusteYolo || `Ajuste / Gasto manual en ${nombreBilleteraMostrada}`
      }
    ]);

    setMontoAjusteYolo("");
    setDescAjusteYolo("");
    await recargarTodo();
    notificar(`Saldo de ${nombreBilleteraMostrada} actualizado`);
  };

  // Guardar la edición de un gasto o movimiento existente del banco
  const guardarEdicionMovimientoBanco = async () => {
    if (!movEditandoBanco) return;
    const num = parseFloat(movEditandoBanco.monto);
    if (isNaN(num)) return notificar("Monto inválido", "error");

    await supabase
      .from("movimientos_yolo")
      .update({
        monto: num,
        descripcion: movEditandoBanco.descripcion,
        afecta_ganancia_neta: Boolean(movEditandoBanco.afecta_ganancia_neta)
      })
      .eq("id", movEditandoBanco.id);

    setMovEditandoBanco(null);
    await recargarTodo();
    notificar("Movimiento de banco actualizado y saldo recalculado");
  };

  // Eliminar un gasto o movimiento con confirmación y devolver el saldo a como estaba antes
  const eliminarMovimientoBancoConfirmado = async (idMov) => {
    await supabase.from("movimientos_yolo").delete().eq("id", idMov);
    setConfirmEliminarMovId(null);
    await recargarTodo();
    notificar("Movimiento eliminado. Tu saldo volvió a como estaba antes.");
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
                Acceso Admins & Revendedores
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
                  <span className="text-[11px] text-[#66FF00]">Portal Oficial de Revendedor (En Vivo)</span>
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
                      <Sparkles className="w-2.5 h-2.5" />{" "}
                      {esSuperAdmin ? "CABEZA PRINCIPAL" : "ADMIN ASOCIADO"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">Panel de {sesionActual.nombre}</span>
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
                <Calendar className="w-3.5 h-3.5 text-[#66FF00]" /> Resumen superior de {sesionActual.nombre}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "hoy", label: "Hoy" },
                  { id: "semana", label: "Esta Semana (Lun - Dom)" },
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-gradient-to-br from-[#121D11] to-[#0B120A] border border-[#264023] rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Ingreso {etiquetaPeriodoTop}
                  </p>
                  <p className="text-2xl font-black text-white mt-1">Bs {ingresoMostradoTop.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{ventasEnPeriodoTop.length} venta(s)</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-[#66FF00]/10 border border-[#66FF00]/30 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[#66FF00]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#121D11] to-[#0B120A] border border-[#264023] rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Ganancia Neta (Profit)
                  </p>
                  <p className={`text-2xl font-black mt-1 ${gananciaMostradaTop >= 0 ? "text-[#66FF00]" : "text-red-400"}`}>
                    Bs {gananciaMostradaTop.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Libre del periodo</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-[#66FF00]/10 border border-[#66FF00]/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#66FF00]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#121D11] to-[#0B120A] border border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                {esSubAdmin ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-amber-300">
                        👑 Fiado de Mateus ({etiquetaPeriodoTop.slice(0, 10)})
                      </span>
                      <span className="text-xs font-black text-amber-400">
                        Deuda Fíe: Bs {deudaPendienteFieMarcus.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xl font-black text-white mt-0.5">
                      Bs {fiadoDeMateusPeriodoTop.toFixed(2)}
                    </p>
                    <div className="text-[10px] text-gray-300 flex justify-between pt-1 border-t border-[#1E331A]">
                      <span>Otros Prov: <b className="text-orange-300">Bs {pagadoProveedoresExternosTop.toFixed(1)}</b></span>
                      <span>Mis Matrices: <b className="text-purple-300">Bs {gastoMatricesPeriodoTop.toFixed(1)}</b></span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-orange-300">
                        🚚 Pagos Prov. & Matrices
                      </span>
                      <Truck className="w-4 h-4 text-orange-400" />
                    </div>
                    <p className="text-xl font-black text-white mt-0.5">
                      Bs {(pagadoProveedoresExternosTop + gastoMatricesPeriodoTop).toFixed(2)}
                    </p>
                    <div className="text-[10px] text-gray-300 flex justify-between pt-1 border-t border-[#1E331A]">
                      <span>A Proveedores: <b className="text-orange-300">Bs {pagadoProveedoresExternosTop.toFixed(1)}</b></span>
                      <span>Mis Matrices: <b className="text-purple-300">Bs {gastoMatricesPeriodoTop.toFixed(1)}</b></span>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gradient-to-br from-[#1B3018] via-[#122110] to-[#0B140A] border-2 border-[#66FF00] rounded-2xl p-4 flex items-center justify-between shadow-[0_0_25px_rgba(102,255,0,0.18)]">
                <div>
                  <p className="text-[11px] text-[#66FF00] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#66FF00] animate-ping" /> Saldo en {nombreBilleteraMostrada}
                  </p>
                  <p className="text-2xl font-black text-white mt-1">Bs {saldoActualYolo.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Toca Editar para ver/borrar gastos</p>
                </div>
                <button
                  onClick={() => setModalYolo(true)}
                  className="px-3 py-2 bg-[#66FF00] hover:bg-[#52cc00] text-black rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer"
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
                <FolderSearch className="w-4 h-4" /> Directorio
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
                esSuperAdmin={esSuperAdmin}
                sesionActual={sesionActual}
                adminKeyActual={adminKeyActual}
                subAdmins={subAdmins}
                matrices={matrices}
                clientes={clientes}
                proveedores={proveedores}
                revendedores={misRevendedoresPropios}
                suscripciones={misSuscripcionesPropias}
                linkWhatsappMoss={linkWhatsappMoss}
                plataformasList={plataformasList}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "estadisticas" && (
              <ModuloEstadisticas
                esSuperAdmin={esSuperAdmin}
                adminKeyActual={adminKeyActual}
                subAdmins={subAdmins}
                suscripciones={suscripciones}
                matrices={matrices}
                movimientosYolo={movimientosYolo}
                revendedores={revendedores}
                nombreBilletera={nombreBilleteraMostrada}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "stock" && (
              <ModuloStock
                esSuperAdmin={esSuperAdmin}
                adminKeyActual={adminKeyActual}
                subAdmins={subAdmins}
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
                suscripciones={misSuscripcionesPropias}
                matrices={matrices.filter((m) => (m.admin_propietario || "admin") === adminKeyActual)}
                proveedores={proveedores}
                revendedores={misRevendedoresPropios}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "directorio" && (
              <ModuloDirectorio
                esSuperAdmin={esSuperAdmin}
                adminKeyActual={adminKeyActual}
                subAdmins={subAdmins}
                suscripciones={suscripciones}
                matrices={matrices}
                clientes={clientes}
                proveedores={proveedores}
                revendedores={esSuperAdmin ? revendedores : misRevendedoresPropios}
                linkWhatsappMoss={linkWhatsappMoss}
                plataformasList={plataformasList}
                recargarTodo={recargarTodo}
                notificar={notificar}
              />
            )}

            {tabActiva === "config" && (
              <ModuloConfig
                esSuperAdmin={esSuperAdmin}
                adminKeyActual={adminKeyActual}
                sesionActual={sesionActual}
                subAdmins={subAdmins}
                matrices={matrices}
                suscripciones={suscripciones}
                clientes={clientes}
                proveedores={proveedores}
                revendedores={revendedores}
                movimientosYolo={movimientosYolo}
                nombreBilletera={nombreBilleteraMostrada}
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
                    <Bell className="w-5 h-5" /> Cobros de Revendedores ({sesionActual.nombre})
                  </h3>
                  <button onClick={() => setModalNotificaciones(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h4 className="text-xs font-extrabold uppercase text-amber-300">
                      🛒 Cuentas de Revendedores ({misNotificacionesCobro.length})
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

                  {misNotificacionesCobro.length === 0 ? (
                    <p className="text-xs text-gray-500 bg-[#070B06] p-3 rounded-xl">
                      No hay cobros de revendedores pendientes.
                    </p>
                  ) : (
                    misNotificacionesCobro.map((n) => (
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
                              className="px-4 py-2 bg-[#66FF00] hover:bg-[#52cc00] text-black font-black rounded-xl text-xs flex items-center gap-1 cursor-pointer"
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
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL DE BANCO: REGISTRAR + EDITAR O ELIMINAR GASTOS / MOVIMIENTOS         */}
          {/* ========================================================================= */}
          {modalYolo && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-xl w-full space-y-4 max-h-[92vh] overflow-y-auto animate-modal">
                <div className="flex justify-between items-center border-b border-[#233820] pb-3">
                  <h3 className="font-extrabold text-[#66FF00] flex items-center gap-2 text-base">
                    <Wallet className="w-5 h-5" /> Banco / Billetera ({nombreBilleteraMostrada})
                  </h3>
                  <button type="button" onClick={() => setModalYolo(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* FORMULARIO PARA AGREGAR NUEVO GASTO O INGRESO */}
                <form onSubmit={registrarAjusteYolo} className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-black text-[#66FF00]">+ Registrar Nuevo Gasto o Ingreso</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoAjusteYolo("gasto")}
                      className={`py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                        tipoAjusteYolo === "gasto"
                          ? "bg-red-600 text-white border-red-400"
                          : "bg-[#111A10] text-gray-300 border-[#2A4226]"
                      }`}
                    >
                      ➖ Gasto / Retiro (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoAjusteYolo("ingreso")}
                      className={`py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                        tipoAjusteYolo === "ingreso"
                          ? "bg-[#66FF00] text-black border-[#66FF00]"
                          : "bg-[#111A10] text-gray-300 border-[#2A4226]"
                      }`}
                    >
                      ➕ Ingreso Extra (+)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="Monto (Bs) Ej: 15.50"
                      value={montoAjusteYolo}
                      onChange={(e) => setMontoAjusteYolo(limpiarMontoConSigno(e.target.value))}
                      className="bg-[#111A10] border border-[#66FF00] rounded-xl p-2.5 text-white font-bold text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Motivo / Descripción"
                      value={descAjusteYolo}
                      onChange={(e) => setDescAjusteYolo(e.target.value)}
                      className="bg-[#111A10] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={afectaGanancia}
                        onChange={(e) => setAfectaGanancia(e.target.checked)}
                      />
                      ¿Afecta también la Ganancia Neta?
                    </label>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#66FF00] text-black rounded-xl text-xs font-black cursor-pointer"
                    >
                      Guardar Movimiento
                    </button>
                  </div>
                </form>

                {/* HISTORIAL DE GASTOS Y MOVIMIENTOS PARA EDITAR O ELIMINAR (VUELVE EL SALDO A ANTES) */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-gray-300">
                    📜 Historial de Gastos y Movimientos (Editar o Eliminar para restaurar saldo)
                  </h4>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {misMovimientosBilleteraPropios.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">
                        No hay movimientos registrados en tu banco.
                      </p>
                    ) : (
                      misMovimientosBilleteraPropios.slice(0, 40).map((m) => {
                        const editandoEste = movEditandoBanco?.id === m.id;
                        const confirmandoEste = confirmEliminarMovId === m.id;

                        return (
                          <div
                            key={m.id}
                            className="bg-[#070B06] border border-[#1E331A] rounded-2xl p-3 text-xs space-y-2"
                          >
                            {editandoEste ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] text-gray-400">
                                      Monto (Negativo - para gasto, Positivo + para ingreso)
                                    </label>
                                    <input
                                      type="text"
                                      value={movEditandoBanco.monto}
                                      onChange={(e) =>
                                        setMovEditandoBanco({
                                          ...movEditandoBanco,
                                          monto: limpiarMontoConSigno(e.target.value)
                                        })
                                      }
                                      className="w-full mt-0.5 bg-[#111A10] border border-[#66FF00] rounded-lg p-2 text-white font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-400">Descripción</label>
                                    <input
                                      type="text"
                                      value={movEditandoBanco.descripcion || ""}
                                      onChange={(e) =>
                                        setMovEditandoBanco({
                                          ...movEditandoBanco,
                                          descripcion: e.target.value
                                        })
                                      }
                                      className="w-full mt-0.5 bg-[#111A10] border border-[#2A4226] rounded-lg p-2 text-white"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setMovEditandoBanco(null)}
                                    className="px-3 py-1 bg-gray-800 text-white rounded-lg font-bold"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={guardarEdicionMovimientoBanco}
                                    className="px-3.5 py-1 bg-[#66FF00] text-black rounded-lg font-black cursor-pointer"
                                  >
                                    Guardar Cambios
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap justify-between items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-bold text-[10px]">
                                    {m.tipo}
                                  </span>
                                  <span className="ml-2 text-gray-500 font-mono text-[10px]">
                                    {formatearFechaDMA(m.fecha)}
                                  </span>
                                  <p className="text-gray-200 font-semibold truncate mt-0.5">
                                    {m.descripcion}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-black text-sm ${
                                      Number(m.monto) >= 0 ? "text-[#66FF00]" : "text-red-400"
                                    }`}
                                  >
                                    {Number(m.monto) >= 0
                                      ? `+Bs ${Number(m.monto).toFixed(2)}`
                                      : `-Bs ${Math.abs(Number(m.monto)).toFixed(2)}`}
                                  </span>

                                  {confirmandoEste ? (
                                    <div className="flex items-center gap-1 bg-red-950/80 border border-red-500 px-2 py-1 rounded-xl">
                                      <span className="text-[10px] text-red-200 font-bold mr-1">
                                        ¿Eliminar?
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => eliminarMovimientoBancoConfirmado(m.id)}
                                        className="px-2 py-0.5 bg-red-600 text-white rounded font-black text-[10px] cursor-pointer"
                                      >
                                        Sí
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmEliminarMovId(null)}
                                        className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded font-bold text-[10px] cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setMovEditandoBanco(m)}
                                        className="p-1.5 text-gray-400 hover:text-[#66FF00] cursor-pointer"
                                        title="Editar monto o motivo"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmEliminarMovId(m.id)}
                                        className="p-1.5 text-gray-500 hover:text-red-400 cursor-pointer"
                                        title="Eliminar movimiento y restaurar saldo"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}