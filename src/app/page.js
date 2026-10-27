"use client";
import React, { useState, useEffect, useCallback } from "react";
import { supabase, AUTH_CONFIG, PLATAFORMAS } from "@/config";
import ModuloVentas from "@/components/ModuloVentas";
import ModuloStock from "@/components/ModuloStock";
import ModuloRenovaciones from "@/components/ModuloRenovaciones";
import ModuloDirectorio from "@/components/ModuloDirectorio";
import ModuloConfig from "@/components/ModuloConfig";
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
  AlertTriangle
} from "lucide-react";

export default function MossCRM() {
  const [montado, setMontado] = useState(false);
  const [autenticado, setAutenticado] = useState(false);
  const [userInput, setUserInput] = useState("Mateus");
  const [pinInput, setPinInput] = useState("");

  const [toast, setToast] = useState(null);

  const notificar = useCallback((texto, tipo = "exito") => {
    const id = Date.now();
    setToast({ id, texto, tipo });
    setTimeout(() => {
      setToast((actual) => (actual?.id === id ? null : actual));
    }, 3000);
  }, []);

  const [tabActiva, setTabActiva] = useState("ventas");
  const [nombreBilletera, setNombreBilletera] = useState("Yolo");
  const [linkWhatsappMoss, setLinkWhatsappMoss] = useState("");
  const [plataformasList, setPlataformasList] = useState(PLATAFORMAS);

  const [matrices, setMatrices] = useState([]);
  const [suscripciones, setSuscripciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movimientosYolo, setMovimientosYolo] = useState([]);

  const [modalYolo, setModalYolo] = useState(false);
  const [montoAjusteYolo, setMontoAjusteYolo] = useState("");
  const [descAjusteYolo, setDescAjusteYolo] = useState("");
  const [afectaGanancia, setAfectaGanancia] = useState(false);

  useEffect(() => {
    setMontado(true);
    const sesion = localStorage.getItem("moss_auth");
    if (sesion === "ok") {
      setAutenticado(true);
      recargarTodo();
    }
  }, []);

  const recargarTodo = async () => {
    const [mRes, sRes, cRes, pRes, yRes, platRes, ajuRes] = await Promise.all([
      supabase.from("matrices_stock").select("*, perfiles_matriz(*)").order("creado_en", { ascending: false }),
      supabase.from("suscripciones").select("*").order("creado_en", { ascending: false }),
      supabase.from("clientes").select("*").order("creado_en", { ascending: false }),
      supabase.from("proveedores").select("*").order("creado_en", { ascending: false }),
      supabase.from("movimientos_yolo").select("*").order("fecha", { ascending: false }),
      supabase.from("plataformas").select("*").order("creado_en", { ascending: true }),
      supabase.from("ajustes_sistema").select("*")
    ]);

    if (mRes.data) setMatrices(mRes.data);
    if (sRes.data) setSuscripciones(sRes.data);
    if (cRes.data) setClientes(cRes.data);
    if (pRes.data) setProveedores(pRes.data);
    if (yRes.data) setMovimientosYolo(yRes.data);

    // Cargar plataformas guardadas en Supabase
    if (platRes.data && platRes.data.length > 0) {
      const mapeadas = platRes.data.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        perfilesDefault: p.perfiles_default ?? 5,
        tieneExtra2020: p.tiene_extra_2020 ?? false,
        pidePass: p.pide_pass ?? true,
        pidePerfil: p.pide_perfil ?? true,
        pidePin: p.pide_pin ?? true
      }));
      setPlataformasList(mapeadas);
    }

    // Cargar ajustes (Billetera y Link de WhatsApp) desde Supabase
    if (ajuRes.data && ajuRes.data.length > 0) {
      const billeteraDB = ajuRes.data.find((a) => a.clave === "nombre_billetera");
      const linkDB = ajuRes.data.find((a) => a.clave === "link_whatsapp_moss");
      if (billeteraDB?.valor) setNombreBilletera(billeteraDB.valor);
      if (linkDB?.valor !== undefined) setLinkWhatsappMoss(linkDB.valor);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (
      userInput.trim().toLowerCase() === AUTH_CONFIG.usuario.toLowerCase() &&
      pinInput.trim() === AUTH_CONFIG.pin
    ) {
      localStorage.setItem("moss_auth", "ok");
      setAutenticado(true);
      recargarTodo();
      notificar("¡Bienvenido a MOSS CRM, Mateus!");
    } else {
      notificar("Usuario o PIN incorrecto", "error");
    }
  };

  const ingresoBrutoTotal = movimientosYolo
    .filter((m) => m.monto > 0 && m.afecta_ganancia_neta)
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const gananciaNeta = movimientosYolo
    .filter((m) => m.afecta_ganancia_neta)
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const saldoActualYolo = movimientosYolo.reduce((acc, m) => acc + Number(m.monto), 0);

  let cantidadPorRenovar = 0;
  if (montado) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    cantidadPorRenovar = suscripciones.filter((s) => {
      if (s.en_papelera || s.estado !== "Activa") return false;
      const corte = new Date(s.fecha_corte + "T00:00:00");
      const dias = Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
      return dias <= 3 && !s.avisado_renovacion;
    }).length;
  }

  const cantidadCaidos = suscripciones.filter((s) => !s.en_papelera && s.estado === "Caida").length;

  const registrarAjusteYolo = async (e) => {
    e.preventDefault();
    if (!montoAjusteYolo) return notificar("Ingresa un monto válido", "error");

    await supabase.from("movimientos_yolo").insert([{
      tipo: "Ajuste Manual",
      monto: Number(montoAjusteYolo),
      afecta_ganancia_neta: afectaGanancia,
      descripcion: descAjusteYolo || `Ajuste / Gasto manual en ${nombreBilletera}`
    }]);

    setMontoAjusteYolo("");
    setDescAjusteYolo("");
    setModalYolo(false);
    await recargarTodo();
    notificar(`Saldo de ${nombreBilletera} actualizado`);
  };

  if (!montado) return null;

  return (
    <div className="min-h-screen text-white pb-16">
      {/* NOTIFICACIÓN EMERGENTE ARRIBA A LA DERECHA (3 SEGUNDOS) */}
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

      {!autenticado ? (
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
                Streaming & Control CRM
              </p>
            </div>
            <div className="space-y-3 text-left">
              <div>
                <label className="text-xs text-gray-400">Usuario</label>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-3 text-white focus:border-[#66FF00] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">PIN de Acceso</label>
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
              ENTRAR AL PANEL
            </button>
          </form>
        </div>
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
                      <Sparkles className="w-2.5 h-2.5" /> PRO CRM
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">Panel de Mateus</span>
                </div>
              </div>

              <button
                onClick={() => {
                  localStorage.removeItem("moss_auth");
                  setAutenticado(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#142013] hover:bg-red-950/60 border border-[#233820] hover:border-red-700/50 flex items-center gap-1.5 text-xs text-gray-300 hover:text-red-300 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Salir
              </button>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
            {/* TARJETAS FINANCIERAS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-[#121D11] to-[#0B120A] border border-[#264023] hover:border-[#66FF00]/50 transition rounded-2xl p-5 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ingreso Total (Ventas)</p>
                  <p className="text-3xl font-black text-white mt-1">Bs {ingresoBrutoTotal.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#66FF00]/10 border border-[#66FF00]/30 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-[#66FF00]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#121D11] to-[#0B120A] border border-[#264023] hover:border-[#66FF00]/50 transition rounded-2xl p-5 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ganancia Neta (Negocio)</p>
                  <p className={`text-3xl font-black mt-1 ${gananciaNeta >= 0 ? "text-[#66FF00]" : "text-red-400"}`}>
                    Bs {gananciaNeta.toFixed(2)}
                  </p>
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
                </div>
                <button
                  onClick={() => setModalYolo(true)}
                  className="px-3.5 py-2.5 bg-[#66FF00] hover:bg-[#52cc00] text-black rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-[0_0_15px_rgba(102,255,0,0.4)] transition cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Gasto / Editar
                </button>
              </div>
            </div>

            {/* BARRA DE 5 PESTAÑAS */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[#0E170D]/90 p-2 rounded-2xl border border-[#264023] shadow-xl">
              <button
                onClick={() => setTabActiva("ventas")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  tabActiva === "ventas"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black shadow-[0_0_18px_rgba(102,255,0,0.4)]"
                    : "text-gray-300 hover:bg-[#162414] hover:text-white"
                }`}
              >
                <ShoppingCart className="w-4 h-4" /> Ventas
              </button>

              <button
                onClick={() => setTabActiva("stock")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  tabActiva === "stock"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black shadow-[0_0_18px_rgba(102,255,0,0.4)]"
                    : "text-gray-300 hover:bg-[#162414] hover:text-white"
                }`}
              >
                <Layers className="w-4 h-4" /> Stock ({matrices.filter((m) => !m.en_papelera).length})
              </button>

              <button
                onClick={() => setTabActiva("renovaciones")}
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  tabActiva === "renovaciones"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black shadow-[0_0_18px_rgba(102,255,0,0.4)]"
                    : "text-gray-300 hover:bg-[#162414] hover:text-white"
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
                className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  tabActiva === "directorio"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black shadow-[0_0_18px_rgba(102,255,0,0.4)]"
                    : "text-gray-300 hover:bg-[#162414] hover:text-white"
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
                className={`col-span-2 sm:col-span-1 py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  tabActiva === "config"
                    ? "bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black shadow-[0_0_18px_rgba(102,255,0,0.4)]"
                    : "text-gray-300 hover:bg-[#162414] hover:text-white"
                }`}
              >
                <Settings className="w-4 h-4" /> Config / Backup
              </button>
            </div>

            {/* CONTENIDO DE PESTAÑAS */}
            {tabActiva === "ventas" && (
              <ModuloVentas
                matrices={matrices}
                clientes={clientes}
                proveedores={proveedores}
                suscripciones={suscripciones}
                linkWhatsappMoss={linkWhatsappMoss}
                plataformasList={plataformasList}
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

          {/* VENTANA EMERGENTE AJUSTAR SALDO */}
          {modalYolo && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <form
                onSubmit={registrarAjusteYolo}
                className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_40px_rgba(102,255,0,0.25)] animate-modal"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-[#66FF00] flex items-center gap-2">
                    <Wallet className="w-5 h-5" /> Ajustar Saldo en {nombreBilletera}
                  </h3>
                  <button type="button" onClick={() => setModalYolo(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Usa un número negativo (ej. <span className="text-white">-20</span>) si hiciste un gasto o retiro, o positivo si ingresaste plata.
                </p>
                <div>
                  <label className="text-xs text-gray-400">Monto (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: -15.50"
                    value={montoAjusteYolo}
                    onChange={(e) => setMontoAjusteYolo(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white focus:border-[#66FF00] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Motivo / Descripción</label>
                  <input
                    type="text"
                    placeholder="Ej: Retiro o pago"
                    value={descAjusteYolo}
                    onChange={(e) => setDescAjusteYolo(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white focus:border-[#66FF00] outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={afectaGanancia}
                    onChange={(e) => setAfectaGanancia(e.target.checked)}
                  />
                  ¿Este movimiento también afecta la Ganancia Neta del negocio?
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalYolo(false)}
                    className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer"
                  >
                    Guardar Movimiento
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