"use client";
import React, { useState, useRef } from "react";
import { supabase, PLATAFORMAS } from "@/config";
import {
  Download,
  Upload,
  Settings,
  Wallet,
  Trash2,
  Truck,
  UserPlus,
  Link2,
  Tv,
  Plus,
  X,
  Search
} from "lucide-react";

export default function ModuloConfig({
  matrices = [],
  suscripciones = [],
  clientes = [],
  proveedores = [],
  movimientosYolo = [],
  nombreBilletera = "Yolo",
  setNombreBilletera,
  linkWhatsappMoss = "",
  setLinkWhatsappMoss,
  plataformasList = PLATAFORMAS,
  recargarTodo,
  notificar
}) {
  const [restaurando, setRestaurando] = useState(false);
  const fileInputRef = useRef(null);

  const [modalPlataformas, setModalPlataformas] = useState(false);
  const [modalProveedores, setModalProveedores] = useState(false);
  const [modalNuevoProv, setModalNuevoProv] = useState(false);

  const [busquedaProv, setBusquedaProv] = useState("");
  const [busquedaPlat, setBusquedaPlat] = useState("");

  // Estado para nueva Plataforma en Supabase
  const [nuevaPlatNombre, setNuevaPlatNombre] = useState("");
  const [nuevaPlatCupos, setNuevaPlatCupos] = useState(5);
  const [nuevaPlatPidePass, setNuevaPlatPidePass] = useState(true);
  const [nuevaPlatPidePerfil, setNuevaPlatPidePerfil] = useState(true);
  const [nuevaPlatPidePin, setNuevaPlatPidePin] = useState(false);

  // Estado para nuevo Proveedor
  const [nombreProv, setNombreProv] = useState("");
  const [telProv, setTelProv] = useState("");

  // Guardar plataforma directamente en la tabla 'plataformas' de Supabase
  const agregarNuevaPlataforma = async (e) => {
    e.preventDefault();
    const limpio = nuevaPlatNombre.trim();
    if (!limpio) return notificar("Escribe el nombre de la plataforma", "error");

    const { error } = await supabase.from("plataformas").upsert(
      [
        {
          nombre: limpio,
          perfiles_default: Number(nuevaPlatCupos || 5),
          tiene_extra_2020: limpio.toLowerCase().includes("netflix"),
          pide_pass: nuevaPlatPidePass,
          pide_perfil: nuevaPlatPidePerfil,
          pide_pin: nuevaPlatPidePin
        }
      ],
      { onConflict: "nombre" }
    );

    if (error) return notificar("Error en Supabase: " + error.message, "error");

    setNuevaPlatNombre("");
    await recargarTodo();
    notificar(`Plataforma ${limpio} guardada en Supabase`);
  };

  const togglePropiedadPlataforma = async (plat, propFront) => {
    const mapaColumna = {
      pidePass: "pide_pass",
      pidePerfil: "pide_perfil",
      pidePin: "pide_pin"
    };
    const colDB = mapaColumna[propFront];
    const nuevoValor = plat[propFront] === false ? true : false;

    const { error } = await supabase
      .from("plataformas")
      .update({ [colDB]: nuevoValor })
      .eq("nombre", plat.nombre);

    if (error) return notificar("Error al actualizar: " + error.message, "error");
    await recargarTodo();
    notificar(`${plat.nombre} actualizada en Supabase`);
  };

  const eliminarPlataforma = async (nombrePlat) => {
    const { error } = await supabase.from("plataformas").delete().eq("nombre", nombrePlat);
    if (error) return notificar("Error al eliminar: " + error.message, "error");
    await recargarTodo();
    notificar(`Plataforma ${nombrePlat} eliminada de Supabase`);
  };

  const guardarAjusteEnSupabase = async (clave, valor) => {
    await supabase.from("ajustes_sistema").upsert([{ clave, valor }], { onConflict: "clave" });
  };

  const agregarProveedorConfig = async (e) => {
    e.preventDefault();
    if (!nombreProv.trim() || !telProv.trim()) return notificar("Ingresa nombre y número", "error");
    await supabase.from("proveedores").insert([{ nombre: nombreProv.trim(), telefono: telProv.trim() }]);
    setNombreProv("");
    setTelProv("");
    setModalNuevoProv(false);
    await recargarTodo();
    notificar("Proveedor agregado en Supabase");
  };

  const eliminarProveedor = async (id) => {
    await supabase.from("proveedores").delete().eq("id", id);
    await recargarTodo();
    notificar("Proveedor eliminado");
  };

  // Descargar Backup consultando directo a Supabase (incluye tabla 'plataformas' y 'ajustes_sistema')
  const descargarBackup = async () => {
    try {
      const [mRes, pefRes, sRes, cRes, prRes, yRes, plRes, ajRes] = await Promise.all([
        supabase.from("matrices_stock").select("*"),
        supabase.from("perfiles_matriz").select("*"),
        supabase.from("suscripciones").select("*"),
        supabase.from("clientes").select("*"),
        supabase.from("proveedores").select("*"),
        supabase.from("movimientos_yolo").select("*"),
        supabase.from("plataformas").select("*"),
        supabase.from("ajustes_sistema").select("*")
      ]);

      const backupObj = {
        fecha_backup: new Date().toISOString(),
        version: "MOSS_CRM_2.0_SUPABASE",
        plataformas: plRes.data || [],
        ajustes_sistema: ajRes.data || [],
        proveedores: prRes.data || [],
        clientes: cRes.data || [],
        matrices_stock: mRes.data || [],
        perfiles_matriz: pefRes.data || [],
        suscripciones: sRes.data || [],
        movimientos_yolo: yRes.data || []
      };

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MOSS_Backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notificar("Backup completo descargado");
    } catch (err) {
      notificar("Error al generar backup: " + err.message, "error");
    }
  };

  const handleSubirBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestaurando(true);
    try {
      const texto = await file.text();
      const data = JSON.parse(texto);

      if (data.plataformas?.length > 0) {
        await supabase.from("plataformas").upsert(data.plataformas, { onConflict: "nombre", ignoreDuplicates: true });
      }
      if (data.ajustes_sistema?.length > 0) {
        await supabase.from("ajustes_sistema").upsert(data.ajustes_sistema, { onConflict: "clave", ignoreDuplicates: true });
      }
      if (data.proveedores?.length > 0) {
        await supabase.from("proveedores").upsert(data.proveedores, { onConflict: "id", ignoreDuplicates: true });
      }
      if (data.clientes?.length > 0) {
        await supabase.from("clientes").upsert(data.clientes, { onConflict: "id", ignoreDuplicates: true });
      }
      if (data.matrices_stock?.length > 0) {
        await supabase.from("matrices_stock").upsert(data.matrices_stock, { onConflict: "id", ignoreDuplicates: true });
      }
      if (data.perfiles_matriz?.length > 0) {
        await supabase.from("perfiles_matriz").upsert(data.perfiles_matriz, { onConflict: "id", ignoreDuplicates: true });
      }
      if (data.suscripciones?.length > 0) {
        await supabase.from("suscripciones").upsert(data.suscripciones, { onConflict: "id", ignoreDuplicates: true });
      }
      if (data.movimientos_yolo?.length > 0) {
        await supabase.from("movimientos_yolo").upsert(data.movimientos_yolo, { onConflict: "id", ignoreDuplicates: true });
      }

      await recargarTodo();
      notificar("¡Backup restaurado en Supabase sin sobrescribir!");
    } catch (err) {
      notificar("Error al subir Backup: " + err.message, "error");
    } finally {
      setRestaurando(false);
      e.target.value = "";
    }
  };

  const eliminarMovimiento = async (id) => {
    await supabase.from("movimientos_yolo").delete().eq("id", id);
    await recargarTodo();
    notificar("Movimiento eliminado");
  };

  return (
    <div className="space-y-6">
      {/* ACCESOS RÁPIDOS A VENTANAS EMERGENTES: PLATAFORMAS Y PROVEEDORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#152613] to-[#0D170C] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <Tv className="w-5 h-5 text-[#66FF00]" /> Plataformas en Supabase ({plataformasList.length})
            </h3>
            <p className="text-xs text-gray-300 mt-1">
              Guardadas en tu base de datos para que nunca se borren.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalPlataformas(true)}
            className="px-4 py-3 bg-[#66FF00] hover:bg-[#52cc00] text-black font-black rounded-2xl text-xs shrink-0 cursor-pointer"
          >
            Ver / Añadir Apps
          </button>
        </div>

        <div className="bg-gradient-to-br from-[#152613] to-[#0D170C] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#66FF00]" /> Mis Proveedores ({proveedores.length})
            </h3>
            <p className="text-xs text-gray-300 mt-1">
              Busca, administra o registra nuevos proveedores.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setModalNuevoProv(true)}
              className="px-3 py-3 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/50 font-extrabold rounded-2xl text-xs cursor-pointer"
            >
              + Nuevo
            </button>
            <button
              type="button"
              onClick={() => setModalProveedores(true)}
              className="px-4 py-3 bg-[#66FF00] hover:bg-[#52cc00] text-black font-black rounded-2xl text-xs cursor-pointer"
            >
              Ver Lista ({proveedores.length})
            </button>
          </div>
        </div>
      </div>

      {/* LINK DE COMUNIDAD / OFERTAS WHATSAPP DE MOSS (GUARDADO EN SUPABASE) */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-3">
        <h3 className="font-black text-[#66FF00] flex items-center gap-2">
          <Link2 className="w-5 h-5" /> Link de Grupo / Comunidad de Ofertas WhatsApp MOSS
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={linkWhatsappMoss}
            onChange={(e) => setLinkWhatsappMoss(e.target.value)}
            placeholder="Ej: https://chat.whatsapp.com/TuCodigoDeGrupoMoss"
            className="flex-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-3 text-white text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              await guardarAjusteEnSupabase("link_whatsapp_moss", linkWhatsappMoss);
              notificar("Link guardado en Supabase");
            }}
            className="px-5 py-3 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer"
          >
            Guardar Link
          </button>
        </div>
      </div>

      {/* SECCIÓN BACKUP Y RESTAURACIÓN */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-bold text-[#66FF00] flex items-center gap-2">
          <Settings className="w-5 h-5" /> Respaldo Total (Backup) y Restauración Inteligente
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={descargarBackup}
            className="px-5 py-3 bg-[#66FF00] hover:bg-[#52cc00] text-black font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Descargar Backup Completo (.JSON)
          </button>

          <button
            type="button"
            disabled={restaurando}
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-3 bg-[#1A2B18] hover:bg-[#253D22] text-[#66FF00] border border-[#66FF00]/50 font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            {restaurando ? "Subiendo registros..." : "Subir Archivo de Backup (Sin sobrescribir)"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleSubirBackup}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* CONFIGURACIÓN DE BILLETERA */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#66FF00]" /> Configuración de Billetera (Yolo / Yape)
        </h3>
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={nombreBilletera}
            onChange={(e) => setNombreBilletera(e.target.value)}
            className="flex-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-sm focus:border-[#66FF00] outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              await guardarAjusteEnSupabase("nombre_billetera", nombreBilletera);
              notificar("Nombre de billetera guardado en Supabase");
            }}
            className="px-4 py-2.5 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer"
          >
            Guardar
          </button>
        </div>

        <div className="pt-3 border-t border-[#1E331A] space-y-2">
          <p className="text-xs font-bold text-gray-400">
            Últimos Movimientos en {nombreBilletera} ({movimientosYolo.length}):
          </p>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {movimientosYolo.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">Aún no hay movimientos registrados.</p>
            ) : (
              movimientosYolo.map((m) => (
                <div key={m.id} className="flex justify-between items-center bg-[#070B06] border border-[#1E331A] p-2.5 rounded-xl text-xs">
                  <div>
                    <span className="font-bold text-gray-200">{m.tipo}: </span>
                    <span className="text-gray-400">{m.descripcion}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-black ${Number(m.monto) >= 0 ? "text-[#66FF00]" : "text-red-400"}`}>
                      {Number(m.monto) >= 0 ? `+Bs ${m.monto}` : `-Bs ${Math.abs(m.monto)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminarMovimiento(m.id)}
                      className="text-gray-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* VENTANA EMERGENTE 1: GESTIÓN DE PLATAFORMAS EN SUPABASE           */}
      {/* ================================================================= */}
      {modalPlataformas && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-[0_0_50px_rgba(102,255,0,0.3)] max-h-[92vh] overflow-y-auto animate-modal">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <h3 className="font-black text-[#66FF00] text-base flex items-center gap-2">
                <Tv className="w-5 h-5" /> Plataformas Guardadas en Supabase ({plataformasList.length})
              </h3>
              <button onClick={() => setModalPlataformas(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={agregarNuevaPlataforma} className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-gray-400">Nombre de la Nueva App</label>
                  <input
                    type="text"
                    placeholder="Ej: ChatGPT Plus, Claude Pro, Crunchyroll..."
                    value={nuevaPlatNombre}
                    onChange={(e) => setNuevaPlatNombre(e.target.value)}
                    className="w-full mt-1 bg-[#111A10] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white focus:border-[#66FF00] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400">Cupos por defecto (si creas Matriz)</label>
                  <input
                    type="number"
                    min="1"
                    value={nuevaPlatCupos}
                    onChange={(e) => setNuevaPlatCupos(e.target.value)}
                    className="w-full mt-1 bg-[#111A10] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap gap-3 text-xs text-gray-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nuevaPlatPidePass}
                      onChange={(e) => setNuevaPlatPidePass(e.target.checked)}
                    />
                    Usa Clave
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nuevaPlatPidePerfil}
                      onChange={(e) => setNuevaPlatPidePerfil(e.target.checked)}
                    />
                    Usa Perfil
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nuevaPlatPidePin}
                      onChange={(e) => setNuevaPlatPidePin(e.target.checked)}
                    />
                    Usa PIN
                  </label>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Guardar en Supabase
                </button>
              </div>
            </form>

            <div className="relative">
              <Search className="w-4 h-4 text-[#66FF00] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar plataforma..."
                value={busquedaPlat}
                onChange={(e) => setBusquedaPlat(e.target.value)}
                className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {plataformasList
                .filter((p) => !busquedaPlat.trim() || p.nombre.toLowerCase().includes(busquedaPlat.toLowerCase()))
                .map((p) => (
                  <div key={p.nombre} className="bg-[#070B06] border border-[#1E331A] rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-white">{p.nombre}</span>
                      <button
                        type="button"
                        onClick={() => eliminarPlataforma(p.nombre)}
                        className="text-gray-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => togglePropiedadPlataforma(p, "pidePass")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                          p.pidePass !== false
                            ? "bg-[#66FF00]/15 text-[#66FF00] border-[#66FF00]/40"
                            : "bg-gray-900 text-gray-500 border-gray-800"
                        }`}
                      >
                        {p.pidePass !== false ? "✓ Clave" : "Invitación"}
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePropiedadPlataforma(p, "pidePerfil")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                          p.pidePerfil !== false
                            ? "bg-[#66FF00]/15 text-[#66FF00] border-[#66FF00]/40"
                            : "bg-gray-900 text-gray-500 border-gray-800"
                        }`}
                      >
                        {p.pidePerfil !== false ? "✓ Perfil" : "Sin Perfil"}
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePropiedadPlataforma(p, "pidePin")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                          p.pidePin !== false
                            ? "bg-[#66FF00]/15 text-[#66FF00] border-[#66FF00]/40"
                            : "bg-gray-900 text-gray-500 border-gray-800"
                        }`}
                      >
                        {p.pidePin !== false ? "✓ PIN" : "Sin PIN"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* VENTANA EMERGENTE 2: LISTA Y BUSCADOR DE PROVEEDORES              */}
      {/* ================================================================= */}
      {modalProveedores && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-[0_0_50px_rgba(102,255,0,0.3)] max-h-[88vh] overflow-y-auto animate-modal">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <h3 className="font-black text-[#66FF00] text-base flex items-center gap-2">
                <Truck className="w-5 h-5" /> Mis Proveedores ({proveedores.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoProv(true)}
                  className="px-3 py-1.5 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer"
                >
                  + Añadir Proveedor
                </button>
                <button onClick={() => setModalProveedores(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#66FF00] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar proveedor por nombre o número..."
                value={busquedaProv}
                onChange={(e) => setBusquedaProv(e.target.value)}
                className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {proveedores
                .filter(
                  (p) =>
                    !busquedaProv.trim() ||
                    p.nombre.toLowerCase().includes(busquedaProv.toLowerCase()) ||
                    p.telefono.includes(busquedaProv)
                )
                .map((p) => (
                  <div key={p.id} className="flex justify-between items-center bg-[#070B06] border border-[#1E331A] p-3 rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-white text-sm">{p.nombre}</p>
                      <p className="text-[#66FF00] font-mono">📞 {p.telefono}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarProveedor(p.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* VENTANA EMERGENTE 3: REGISTRAR NUEVO PROVEEDOR                    */}
      {/* ================================================================= */}
      {modalNuevoProv && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <form
            onSubmit={agregarProveedorConfig}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_50px_rgba(102,255,0,0.3)] animate-modal"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00] flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Registrar Proveedor
              </h3>
              <button type="button" onClick={() => setModalNuevoProv(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-400">Nombre del Proveedor</label>
              <input
                type="text"
                placeholder="Ej: Negocyx"
                value={nombreProv}
                onChange={(e) => setNombreProv(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Número de Teléfono / WhatsApp</label>
              <input
                type="text"
                placeholder="Ej: 75508595"
                value={telProv}
                onChange={(e) => setTelProv(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-sm text-white"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModalNuevoProv(false)} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                Guardar Proveedor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}