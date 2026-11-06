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
  Search,
  MailCheck,
  KeyRound,
  Users,
  Edit3,
  Check
} from "lucide-react";

export default function ModuloConfig({
  matrices = [],
  suscripciones = [],
  clientes = [],
  proveedores = [],
  revendedores = [],
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
  const [modalRevendedores, setModalRevendedores] = useState(false);

  const [busquedaProv, setBusquedaProv] = useState("");
  const [busquedaRev, setBusquedaRev] = useState("");
  const [busquedaPlat, setBusquedaPlat] = useState("");

  // Nueva Plataforma
  const [nuevaPlatNombre, setNuevaPlatNombre] = useState("");
  const [esPorInvitacion, setEsPorInvitacion] = useState(false);
  const [nuevaPlatCupos, setNuevaPlatCupos] = useState(5);
  const [nuevaPlatPidePass, setNuevaPlatPidePass] = useState(true);
  const [nuevaPlatPidePerfil, setNuevaPlatPidePerfil] = useState(true);
  const [nuevaPlatPidePin, setNuevaPlatPidePin] = useState(false);

  // Nuevo Proveedor / Edición
  const [nombreProv, setNombreProv] = useState("");
  const [telProv, setTelProv] = useState("");
  const [editProv, setEditProv] = useState(null);

  // Nuevo Revendedor / Edición
  const [nombreRev, setNombreRev] = useState("");
  const [telRev, setTelRev] = useState("");
  const [editRev, setEditRev] = useState(null);

  const agregarNuevaPlataforma = async (e) => {
    e.preventDefault();
    const limpio = nuevaPlatNombre.trim();
    if (!limpio) return notificar("Escribe el nombre de la app", "error");
    await supabase.from("plataformas").upsert([{
      nombre: limpio,
      perfiles_default: esPorInvitacion ? 1 : Number(nuevaPlatCupos || 5),
      tiene_extra_2020: limpio.toLowerCase().includes("netflix"),
      pide_pass: esPorInvitacion ? false : nuevaPlatPidePass,
      pide_perfil: esPorInvitacion ? false : nuevaPlatPidePerfil,
      pide_pin: esPorInvitacion ? false : nuevaPlatPidePin
    }], { onConflict: "nombre" });
    setNuevaPlatNombre("");
    await recargarTodo();
    notificar(`App ${limpio} guardada`);
  };

  const eliminarPlataforma = async (nombrePlat) => {
    await supabase.from("plataformas").delete().eq("nombre", nombrePlat);
    await recargarTodo();
    notificar("Plataforma eliminada");
  };

  const agregarProveedor = async (e) => {
    e.preventDefault();
    if (!nombreProv.trim() || !telProv.trim()) return;
    await supabase.from("proveedores").insert([{ nombre: nombreProv.trim(), telefono: telProv.trim() }]);
    setNombreProv("");
    setTelProv("");
    await recargarTodo();
    notificar("Proveedor agregado");
  };

  const guardarEdicionProv = async () => {
    if (!editProv) return;
    await supabase.from("proveedores").update({ nombre: editProv.nombre, telefono: editProv.telefono }).eq("id", editProv.id);
    setEditProv(null);
    await recargarTodo();
    notificar("Proveedor actualizado");
  };

  const agregarRevendedor = async (e) => {
    e.preventDefault();
    if (!nombreRev.trim() || !telRev.trim()) return;
    await supabase.from("revendedores").insert([{ nombre: nombreRev.trim(), telefono: telRev.trim() }]);
    setNombreRev("");
    setTelRev("");
    await recargarTodo();
    notificar("Revendedor agregado");
  };

  const guardarEdicionRev = async () => {
    if (!editRev) return;
    await supabase.from("revendedores").update({ nombre: editRev.nombre, telefono: editRev.telefono }).eq("id", editRev.id);
    setEditRev(null);
    await recargarTodo();
    notificar("Revendedor actualizado");
  };

  const guardarAjusteEnSupabase = async (clave, valor) => {
    await supabase.from("ajustes_sistema").upsert([{ clave, valor }], { onConflict: "clave" });
  };

  const descargarBackup = async () => {
    const [mRes, pefRes, sRes, cRes, prRes, revRes, yRes, plRes, ajRes] = await Promise.all([
      supabase.from("matrices_stock").select("*"),
      supabase.from("perfiles_matriz").select("*"),
      supabase.from("suscripciones").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("proveedores").select("*"),
      supabase.from("revendedores").select("*"),
      supabase.from("movimientos_yolo").select("*"),
      supabase.from("plataformas").select("*"),
      supabase.from("ajustes_sistema").select("*")
    ]);

    const backupObj = {
      fecha_backup: new Date().toISOString(),
      version: "MOSS_CRM_3.0",
      plataformas: plRes.data || [],
      ajustes_sistema: ajRes.data || [],
      proveedores: prRes.data || [],
      revendedores: revRes.data || [],
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
  };

  const handleSubirBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestaurando(true);
    try {
      const data = JSON.parse(await file.text());
      if (data.plataformas?.length) await supabase.from("plataformas").upsert(data.plataformas, { onConflict: "nombre", ignoreDuplicates: true });
      if (data.proveedores?.length) await supabase.from("proveedores").upsert(data.proveedores, { onConflict: "id", ignoreDuplicates: true });
      if (data.revendedores?.length) await supabase.from("revendedores").upsert(data.revendedores, { onConflict: "id", ignoreDuplicates: true });
      if (data.clientes?.length) await supabase.from("clientes").upsert(data.clientes, { onConflict: "id", ignoreDuplicates: true });
      if (data.matrices_stock?.length) await supabase.from("matrices_stock").upsert(data.matrices_stock, { onConflict: "id", ignoreDuplicates: true });
      if (data.perfiles_matriz?.length) await supabase.from("perfiles_matriz").upsert(data.perfiles_matriz, { onConflict: "id", ignoreDuplicates: true });
      if (data.suscripciones?.length) await supabase.from("suscripciones").upsert(data.suscripciones, { onConflict: "id", ignoreDuplicates: true });
      if (data.movimientos_yolo?.length) await supabase.from("movimientos_yolo").upsert(data.movimientos_yolo, { onConflict: "id", ignoreDuplicates: true });
      await recargarTodo();
      notificar("Backup restaurado");
    } catch (err) {
      notificar("Error: " + err.message, "error");
    } finally {
      setRestaurando(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* 3 BOTONES EMERGENTES: PLATAFORMAS, PROVEEDORES Y REVENDEDORES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#66FF00]" /> Plataformas ({plataformasList.length})
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Apps con clave o por invitación</p>
          </div>
          <button onClick={() => setModalPlataformas(true)} className="px-4 py-2.5 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer">
            Administrar
          </button>
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#66FF00]" /> Proveedores ({proveedores.length})
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Agregar, buscar o editar</p>
          </div>
          <button onClick={() => setModalProveedores(true)} className="px-4 py-2.5 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer">
            Administrar
          </button>
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-[#66FF00]" /> Revendedores ({revendedores.length})
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Agregar, buscar o editar</p>
          </div>
          <button onClick={() => setModalRevendedores(true)} className="px-4 py-2.5 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer">
            Administrar
          </button>
        </div>
      </div>

      {/* LINK DE COMUNIDAD Y BILLETERA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-2">
          <h3 className="font-black text-[#66FF00] text-xs flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Link de Comunidad WhatsApp MOSS
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={linkWhatsappMoss}
              onChange={(e) => setLinkWhatsappMoss(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="flex-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs"
            />
            <button
              onClick={async () => {
                await guardarAjusteEnSupabase("link_whatsapp_moss", linkWhatsappMoss);
                notificar("Link guardado");
              }}
              className="px-4 py-2 bg-[#66FF00] text-black font-bold rounded-xl text-xs cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>

        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-2">
          <h3 className="font-black text-[#66FF00] text-xs flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Nombre de Billetera Principal
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={nombreBilletera}
              onChange={(e) => setNombreBilletera(e.target.value)}
              className="flex-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs"
            />
            <button
              onClick={async () => {
                await guardarAjusteEnSupabase("nombre_billetera", nombreBilletera);
                notificar("Billetera guardada");
              }}
              className="px-4 py-2 bg-[#66FF00] text-black font-bold rounded-xl text-xs cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* BACKUP */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#66FF00] flex items-center gap-2">
            <Settings className="w-4 h-4" /> Respaldo Total (Backup .JSON)
          </h2>
          <p className="text-xs text-gray-400">Incluye plataformas, proveedores, revendedores, stock y ventas.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={descargarBackup} className="px-4 py-2.5 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
            <Download className="w-4 h-4" /> Descargar Backup
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/50 font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4" /> {restaurando ? "Subiendo..." : "Restaurar Backup"}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleSubirBackup} style={{ display: "none" }} />
        </div>
      </div>

      {/* MODAL PLATAFORMAS */}
      {modalPlataformas && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00]">Plataformas ({plataformasList.length})</h3>
              <button onClick={() => setModalPlataformas(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={agregarNuevaPlataforma} className="bg-[#070B06] border border-[#233820] rounded-2xl p-3.5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setEsPorInvitacion(false)} className={`py-2 rounded-xl text-xs font-bold border ${!esPorInvitacion ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#111A10] text-gray-300 border-[#2A4226]"}`}>
                  <KeyRound className="w-3.5 h-3.5 inline mr-1" /> Con Clave
                </button>
                <button type="button" onClick={() => setEsPorInvitacion(true)} className={`py-2 rounded-xl text-xs font-bold border ${esPorInvitacion ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#111A10] text-gray-300 border-[#2A4226]"}`}>
                  <MailCheck className="w-3.5 h-3.5 inline mr-1" /> Por Invitación (Solo Correo)
                </button>
              </div>
              <input type="text" placeholder="Nombre de la App (ej: Gemini Pro, Crunchyroll...)" value={nuevaPlatNombre} onChange={(e) => setNuevaPlatNombre(e.target.value)} className="w-full bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
              {!esPorInvitacion && (
                <div className="flex gap-3 text-xs text-gray-300">
                  <label><input type="checkbox" checked={nuevaPlatPidePass} onChange={(e) => setNuevaPlatPidePass(e.target.checked)} /> Clave</label>
                  <label><input type="checkbox" checked={nuevaPlatPidePerfil} onChange={(e) => setNuevaPlatPidePerfil(e.target.checked)} /> Perfil</label>
                  <label><input type="checkbox" checked={nuevaPlatPidePin} onChange={(e) => setNuevaPlatPidePin(e.target.checked)} /> PIN</label>
                </div>
              )}
              <button type="submit" className="w-full py-2 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer">+ Guardar Plataforma</button>
            </form>

            <input type="text" placeholder="Buscar app..." value={busquedaPlat} onChange={(e) => setBusquedaPlat(e.target.value)} className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {plataformasList
                .filter((p) => !busquedaPlat.trim() || p.nombre.toLowerCase().includes(busquedaPlat.toLowerCase()))
                .map((p) => (
                  <div key={p.nombre} className="bg-[#070B06] border border-[#1E331A] rounded-xl p-2.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white">{p.nombre}</p>
                      <span className="text-[10px] text-[#66FF00]">{p.pidePass === false ? "📩 Por Invitación" : "🔑 Con Credenciales"}</span>
                    </div>
                    <button onClick={() => eliminarPlataforma(p.nombre)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROVEEDORES (CON EDICIÓN) */}
      {modalProveedores && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00]">Mis Proveedores ({proveedores.length})</h3>
              <button onClick={() => setModalProveedores(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={agregarProveedor} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input type="text" placeholder="Nombre" value={nombreProv} onChange={(e) => setNombreProv(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
              <input type="text" placeholder="Teléfono" value={telProv} onChange={(e) => setTelProv(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
              <button type="submit" className="bg-[#66FF00] text-black font-extrabold rounded-xl p-2 text-xs cursor-pointer">+ Agregar</button>
            </form>
            <input type="text" placeholder="Buscar proveedor..." value={busquedaProv} onChange={(e) => setBusquedaProv(e.target.value)} className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {proveedores
                .filter((p) => !busquedaProv.trim() || p.nombre.toLowerCase().includes(busquedaProv.toLowerCase()) || p.telefono.includes(busquedaProv))
                .map((p) => (
                  <div key={p.id} className="bg-[#070B06] border border-[#1E331A] p-2.5 rounded-xl flex justify-between items-center text-xs">
                    {editProv?.id === p.id ? (
                      <div className="flex gap-1.5 flex-1 mr-2">
                        <input type="text" value={editProv.nombre} onChange={(e) => setEditProv({ ...editProv, nombre: e.target.value })} className="bg-black border border-[#66FF00] rounded px-2 py-1 text-xs text-white w-1/2" />
                        <input type="text" value={editProv.telefono} onChange={(e) => setEditProv({ ...editProv, telefono: e.target.value })} className="bg-black border border-[#66FF00] rounded px-2 py-1 text-xs text-white w-1/2" />
                        <button onClick={guardarEdicionProv} className="text-[#66FF00]"><Check className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-white">{p.nombre}</p>
                        <p className="text-[#66FF00] font-mono">📞 {p.telefono}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setEditProv(p)} className="text-gray-400 hover:text-[#66FF00]"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={async () => { await supabase.from("proveedores").delete().eq("id", p.id); await recargarTodo(); }} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL REVENDEDORES (CON EDICIÓN) */}
      {modalRevendedores && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00]">Mis Revendedores ({revendedores.length})</h3>
              <button onClick={() => setModalRevendedores(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={agregarRevendedor} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input type="text" placeholder="Nombre Revendedor" value={nombreRev} onChange={(e) => setNombreRev(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
              <input type="text" placeholder="Teléfono" value={telRev} onChange={(e) => setTelRev(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
              <button type="submit" className="bg-[#66FF00] text-black font-extrabold rounded-xl p-2 text-xs cursor-pointer">+ Agregar</button>
            </form>
            <input type="text" placeholder="Buscar revendedor..." value={busquedaRev} onChange={(e) => setBusquedaRev(e.target.value)} className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {revendedores
                .filter((r) => !busquedaRev.trim() || r.nombre.toLowerCase().includes(busquedaRev.toLowerCase()) || r.telefono.includes(busquedaRev))
                .map((r) => (
                  <div key={r.id} className="bg-[#070B06] border border-[#1E331A] p-2.5 rounded-xl flex justify-between items-center text-xs">
                    {editRev?.id === r.id ? (
                      <div className="flex gap-1.5 flex-1 mr-2">
                        <input type="text" value={editRev.nombre} onChange={(e) => setEditRev({ ...editRev, nombre: e.target.value })} className="bg-black border border-[#66FF00] rounded px-2 py-1 text-xs text-white w-1/2" />
                        <input type="text" value={editRev.telefono} onChange={(e) => setEditRev({ ...editRev, telefono: e.target.value })} className="bg-black border border-[#66FF00] rounded px-2 py-1 text-xs text-white w-1/2" />
                        <button onClick={guardarEdicionRev} className="text-[#66FF00]"><Check className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-white">{r.nombre}</p>
                        <p className="text-[#66FF00] font-mono">📞 {r.telefono}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setEditRev(r)} className="text-gray-400 hover:text-[#66FF00]"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={async () => { await supabase.from("revendedores").delete().eq("id", r.id); await recargarTodo(); }} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}