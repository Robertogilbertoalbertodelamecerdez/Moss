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
  Link2,
  Tv,
  X,
  MailCheck,
  KeyRound,
  Users,
  Edit3,
  Check,
  Layers,
  ArrowUp,
  ArrowDown
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

  // Crear Nueva Plataforma
  const [nuevaPlatNombre, setNuevaPlatNombre] = useState("");
  const [esPorInvitacion, setEsPorInvitacion] = useState(false);
  const [nuevaPlatCupos, setNuevaPlatCupos] = useState(5);
  const [nuevaPlatPrecioCli, setNuevaPlatPrecioCli] = useState(20);
  const [nuevaPlatPrecioRev, setNuevaPlatPrecioRev] = useState(10);
  const [nuevaPlatPidePass, setNuevaPlatPidePass] = useState(true);
  const [nuevaPlatPidePerfil, setNuevaPlatPidePerfil] = useState(true);
  const [nuevaPlatPidePin, setNuevaPlatPidePin] = useState(false);

  // Estado de Edición Manual de Plataforma con botón Guardar y Cancelar
  const [platEditando, setPlatEditando] = useState(null);

  const [nombreProv, setNombreProv] = useState("");
  const [telProv, setTelProv] = useState("");
  const [editProv, setEditProv] = useState(null);

  const [nombreRev, setNombreRev] = useState("");
  const [telRev, setTelRev] = useState("");
  const [userRev, setUserRev] = useState("");
  const [pinRev, setPinRev] = useState("1234");
  const [stockPermRev, setStockPermRev] = useState(false);
  const [editRev, setEditRev] = useState(null);

  const seleccionarModoInvitacionCrear = (modoInv) => {
    setEsPorInvitacion(modoInv);
    if (modoInv) {
      setNuevaPlatPidePass(false);
      setNuevaPlatPidePerfil(false);
      setNuevaPlatPidePin(false);
      setNuevaPlatCupos(1);
    } else {
      setNuevaPlatPidePass(true);
      setNuevaPlatPidePerfil(true);
      setNuevaPlatCupos(5);
    }
  };

  const agregarNuevaPlataforma = async (e) => {
    e.preventDefault();
    const limpio = nuevaPlatNombre.trim();
    if (!limpio) return notificar("Escribe el nombre de la app", "error");
    const siguienteOrden = plataformasList.length + 1;
    const { error } = await supabase.from("plataformas").upsert(
      [
        {
          nombre: limpio,
          orden: siguienteOrden,
          perfiles_default: esPorInvitacion ? 1 : Number(nuevaPlatCupos || 5),
          precio_cliente: Number(nuevaPlatPrecioCli || 20),
          precio_revendedor: Number(nuevaPlatPrecioRev || 10),
          tiene_extra_2020: limpio.toLowerCase().includes("netflix"),
          pide_pass: esPorInvitacion ? false : nuevaPlatPidePass,
          pide_perfil: esPorInvitacion ? false : nuevaPlatPidePerfil,
          pide_pin: esPorInvitacion ? false : nuevaPlatPidePin
        }
      ],
      { onConflict: "nombre" }
    );
    if (error) return notificar("Error: " + error.message, "error");
    setNuevaPlatNombre("");
    await recargarTodo();
    notificar(`App ${limpio} guardada al final de tu lista`);
  };

  // Abrir modo edición de una plataforma existente (Con Guardar y Cancelar)
  const iniciarEdicionPlataforma = (p, idx) => {
    setPlatEditando({
      nombreOriginal: p.nombre,
      nombre: p.nombre,
      orden: p.orden ?? idx + 1,
      perfilesDefault: p.perfilesDefault ?? 5,
      precioCliente: p.precioCliente ?? 20,
      precioRevendedor: p.precioRevendedor ?? 10,
      pidePass: p.pidePass !== false,
      pidePerfil: p.pidePerfil !== false,
      pidePin: p.pidePin !== false
    });
  };

  // Guardar los cambios de la plataforma solo cuando presionas "Guardar Cambios"
  const guardarEdicionPlataforma = async () => {
    if (!platEditando) return;
    const payload = {
      nombre: platEditando.nombre.trim(),
      orden: Number(platEditando.orden || 1),
      perfiles_default: Number(platEditando.perfilesDefault || 1),
      tiene_extra_2020: platEditando.nombre.toLowerCase().includes("netflix"),
      precio_cliente: Number(platEditando.precioCliente || 0),
      precio_revendedor: Number(platEditando.precioRevendedor || 0),
      pide_pass: Boolean(platEditando.pidePass),
      pide_perfil: platEditando.pidePass ? Boolean(platEditando.pidePerfil) : false,
      pide_pin: platEditando.pidePass ? Boolean(platEditando.pidePin) : false
    };

    if (
      platEditando.nombreOriginal &&
      platEditando.nombreOriginal !== platEditando.nombre.trim()
    ) {
      await supabase.from("plataformas").delete().eq("nombre", platEditando.nombreOriginal);
    }

    const { error } = await supabase
      .from("plataformas")
      .upsert([payload], { onConflict: "nombre" });

    if (error) return notificar("Error al guardar: " + error.message, "error");
    setPlatEditando(null);
    await recargarTodo();
    notificar(`¡${payload.nombre} guardada sin alterar tu orden!`);
  };

  // Subir o bajar una plataforma en el orden sin que se mezclen
  const moverOrdenPlataforma = async (indexActual, direccion) => {
    const nuevoIndex = indexActual + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= plataformasList.length) return;

    const copia = [...plataformasList];
    const [movida] = copia.splice(indexActual, 1);
    copia.splice(nuevoIndex, 0, movida);

    const payloads = copia.map((p, idx) => ({
      nombre: p.nombre,
      orden: idx + 1,
      perfiles_default: Number(p.perfilesDefault ?? 5),
      tiene_extra_2020: Boolean(p.tieneExtra2020),
      precio_cliente: Number(p.precioCliente ?? 20),
      precio_revendedor: Number(p.precioRevendedor ?? 10),
      pide_pass: p.pidePass !== false,
      pide_perfil: p.pidePerfil !== false,
      pide_pin: p.pidePin !== false
    }));

    await supabase.from("plataformas").upsert(payloads, { onConflict: "nombre" });
    await recargarTodo();
    notificar("Orden de plataformas actualizado");
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
    await supabase
      .from("proveedores")
      .update({ nombre: editProv.nombre, telefono: editProv.telefono })
      .eq("id", editProv.id);
    setEditProv(null);
    await recargarTodo();
    notificar("Proveedor actualizado");
  };

  const agregarRevendedor = async (e) => {
    e.preventDefault();
    if (!nombreRev.trim() || !telRev.trim()) return notificar("Ingresa nombre y teléfono", "error");
    const usuarioFinal = userRev.trim() || nombreRev.trim().split(" ")[0].toLowerCase();
    await supabase.from("revendedores").insert([
      {
        nombre: nombreRev.trim(),
        telefono: telRev.trim(),
        usuario: usuarioFinal,
        pin: pinRev.trim() || "1234",
        puede_ver_matrices: stockPermRev,
        activo: true
      }
    ]);
    setNombreRev("");
    setTelRev("");
    setUserRev("");
    setPinRev("1234");
    setStockPermRev(false);
    await recargarTodo();
    notificar(`Revendedor creado (Usuario: ${usuarioFinal})`);
  };

  const guardarEdicionRev = async () => {
    if (!editRev) return;
    await supabase
      .from("revendedores")
      .update({
        nombre: editRev.nombre,
        telefono: editRev.telefono,
        usuario: editRev.usuario,
        pin: editRev.pin,
        puede_ver_matrices: editRev.puede_ver_matrices
      })
      .eq("id", editRev.id);
    setEditRev(null);
    await recargarTodo();
    notificar("Acceso y datos del revendedor actualizados");
  };

  const togglePermisoStockRevendedor = async (r) => {
    await supabase
      .from("revendedores")
      .update({ puede_ver_matrices: !r.puede_ver_matrices })
      .eq("id", r.id);
    await recargarTodo();
    notificar(
      !r.puede_ver_matrices
        ? `${r.nombre} ahora puede sacar cuentas de Stock`
        : `Permiso de Stock retirado a ${r.nombre}`
    );
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
      version: "MOSS_CRM_5.0",
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#66FF00]" /> Catálogo y Orden ({plataformasList.length})
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Editar apps, precios y elegir orden</p>
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
              <Users className="w-4 h-4 text-[#66FF00]" /> Revendedores y Accesos ({revendedores.length})
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Usuarios, PIN y permiso de Stock</p>
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

      {/* ========================================================================= */}
      {/* MODAL PLATAFORMAS: CON BOTÓN GUARDAR / CANCELAR Y FLECHAS DE ORDEN ⬆️⬇️   */}
      {/* ========================================================================= */}
      {modalPlataformas && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-3xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h3 className="font-black text-[#66FF00] text-base">
                  Catálogo de Plataformas, Precios y Orden ({plataformasList.length})
                </h3>
                <p className="text-[11px] text-gray-400">
                  Usa las flechas ⬆️ ⬇️ para elegir el orden y el botón "Editar" para cambiar datos y confirmar con Guardar.
                </p>
              </div>
              <button onClick={() => setModalPlataformas(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CREAR NUEVA PLATAFORMA */}
            <form onSubmit={agregarNuevaPlataforma} className="bg-[#070B06] border border-[#233820] rounded-2xl p-3.5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => seleccionarModoInvitacionCrear(false)}
                  className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    !esPorInvitacion ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#111A10] text-gray-300 border-[#2A4226]"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 inline mr-1" /> Con Clave
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarModoInvitacionCrear(true)}
                  className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    esPorInvitacion ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#111A10] text-gray-300 border-[#2A4226]"
                  }`}
                >
                  <MailCheck className="w-3.5 h-3.5 inline mr-1" /> Por Invitación (Solo Correo)
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la App *"
                  value={nuevaPlatNombre}
                  onChange={(e) => setNuevaPlatNombre(e.target.value)}
                  className="col-span-2 bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Cupos"
                  value={nuevaPlatCupos}
                  onChange={(e) => setNuevaPlatCupos(e.target.value)}
                  className="bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Catálogo Bs"
                  value={nuevaPlatPrecioCli}
                  onChange={(e) => setNuevaPlatPrecioCli(e.target.value)}
                  className="bg-[#111A10] border border-[#66FF00] rounded-xl p-2 text-xs text-white font-bold"
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Reventa Bs"
                  value={nuevaPlatPrecioRev}
                  onChange={(e) => setNuevaPlatPrecioRev(e.target.value)}
                  className="bg-[#111A10] border border-purple-500 rounded-xl p-2 text-xs text-white font-bold"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {!esPorInvitacion ? (
                  <div className="flex flex-wrap gap-3 text-xs text-gray-200">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nuevaPlatPidePass}
                        onChange={(e) => setNuevaPlatPidePass(e.target.checked)}
                      />
                      Pide Contraseña
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nuevaPlatPidePerfil}
                        onChange={(e) => setNuevaPlatPidePerfil(e.target.checked)}
                      />
                      Pide Perfil
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nuevaPlatPidePin}
                        onChange={(e) => setNuevaPlatPidePin(e.target.checked)}
                      />
                      Pide PIN
                    </label>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#66FF00] font-bold">
                    ✓ Modo Invitación: Solo pedirá correo del cliente.
                  </span>
                )}

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer ml-auto"
                >
                  + Agregar Nueva App
                </button>
              </div>
            </form>

            <input
              type="text"
              placeholder="Buscar plataforma..."
              value={busquedaPlat}
              onChange={(e) => setBusquedaPlat(e.target.value)}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
            />

            {/* LISTA DE PLATAFORMAS CON ORDEN FIJO Y BOTÓN EDITAR (CON GUARDAR Y CANCELAR) */}
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {plataformasList.map((p, idx) => {
                if (
                  busquedaPlat.trim() &&
                  !p.nombre.toLowerCase().includes(busquedaPlat.toLowerCase())
                ) {
                  return null;
                }

                const estaEditandoEsta =
                  platEditando && platEditando.nombreOriginal === p.nombre;

                return (
                  <div
                    key={p.nombre}
                    className={`bg-[#070B06] border rounded-2xl p-3.5 text-xs transition ${
                      estaEditandoEsta ? "border-2 border-[#66FF00]" : "border-[#1E331A]"
                    }`}
                  >
                    {estaEditandoEsta ? (
                      /* MODO EDICIÓN CON BOTÓN GUARDAR Y CANCELAR */
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[#66FF00] font-black uppercase">
                            ✏️ Editando: {platEditando.nombreOriginal}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            Modifica lo que necesites y dale a Guardar
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <div className="col-span-2">
                            <label className="text-[10px] text-gray-400">Nombre Plataforma</label>
                            <input
                              type="text"
                              value={platEditando.nombre}
                              onChange={(e) => setPlatEditando({ ...platEditando, nombre: e.target.value })}
                              className="w-full mt-0.5 bg-[#111A10] border border-[#66FF00] rounded-lg p-2 text-xs text-white font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">Cupos Matriz</label>
                            <input
                              type="number"
                              min="1"
                              value={platEditando.perfilesDefault}
                              onChange={(e) => setPlatEditando({ ...platEditando, perfilesDefault: e.target.value })}
                              className="w-full mt-0.5 bg-[#111A10] border border-[#2A4226] rounded-lg p-2 text-xs text-white text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#66FF00] font-bold">Catálogo (Bs)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={platEditando.precioCliente}
                              onChange={(e) => setPlatEditando({ ...platEditando, precioCliente: e.target.value })}
                              className="w-full mt-0.5 bg-[#111A10] border border-[#66FF00] rounded-lg p-2 text-xs text-white font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-purple-300 font-bold">Revendedor (Bs)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={platEditando.precioRevendedor}
                              onChange={(e) => setPlatEditando({ ...platEditando, precioRevendedor: e.target.value })}
                              className="w-full mt-0.5 bg-[#111A10] border border-purple-500 rounded-lg p-2 text-xs text-white font-bold text-center"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setPlatEditando({
                                ...platEditando,
                                pidePass: !platEditando.pidePass,
                                pidePerfil: !platEditando.pidePass ? true : false,
                                pidePin: !platEditando.pidePass ? platEditando.pidePin : false
                              })
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                              platEditando.pidePass
                                ? "bg-[#66FF00]/20 text-[#66FF00] border-[#66FF00]"
                                : "bg-blue-950 text-blue-300 border-blue-500"
                            }`}
                          >
                            {platEditando.pidePass ? "🔑 Pide Contraseña: SÍ" : "📩 Por Invitación (Sin Clave)"}
                          </button>

                          {platEditando.pidePass && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setPlatEditando({ ...platEditando, pidePerfil: !platEditando.pidePerfil })
                                }
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                                  platEditando.pidePerfil
                                    ? "bg-[#66FF00]/20 text-[#66FF00] border-[#66FF00]"
                                    : "bg-gray-900 text-gray-400 border-gray-700"
                                }`}
                              >
                                {platEditando.pidePerfil ? "👤 Pide Perfil: SÍ" : "👤 Pide Perfil: NO"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setPlatEditando({ ...platEditando, pidePin: !platEditando.pidePin })
                                }
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                                  platEditando.pidePin
                                    ? "bg-[#66FF00]/20 text-[#66FF00] border-[#66FF00]"
                                    : "bg-gray-900 text-gray-400 border-gray-700"
                                }`}
                              >
                                {platEditando.pidePin ? "📌 Pide PIN: SÍ" : "📌 Pide PIN: NO"}
                              </button>
                            </>
                          )}

                          <div className="ml-auto flex gap-2">
                            <button
                              type="button"
                              onClick={() => setPlatEditando(null)}
                              className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={guardarEdicionPlataforma}
                              className="px-4 py-1.5 bg-[#66FF00] hover:bg-[#52cc00] text-black rounded-xl font-black flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-4 h-4" /> Guardar Cambios
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* MODO VISTA CON FLECHAS DE ORDEN Y BOTÓN EDITAR */
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moverOrdenPlataforma(idx, -1)}
                              className="p-0.5 bg-[#142012] hover:bg-[#66FF00] text-gray-300 hover:text-black rounded disabled:opacity-30 cursor-pointer"
                              title="Subir posición"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === plataformasList.length - 1}
                              onClick={() => moverOrdenPlataforma(idx, 1)}
                              className="p-0.5 bg-[#142012] hover:bg-[#66FF00] text-gray-300 hover:text-black rounded disabled:opacity-30 cursor-pointer"
                              title="Bajar posición"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div>
                            <p className="font-black text-white text-sm">
                              #{idx + 1} {p.nombre}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {p.pidePass === false ? "📩 Por Invitación" : "🔑 Con Clave"}
                              {p.pidePass !== false && p.pidePerfil !== false ? " · 👤 Perfil" : ""}
                              {p.pidePass !== false && p.pidePin !== false ? " · 📌 PIN" : ""}
                              {` · ${p.perfilesDefault ?? 5} cupos`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded-lg bg-[#122210] border border-[#66FF00]/40 text-[#66FF00] font-bold">
                            Catálogo: Bs {p.precioCliente ?? 20}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-purple-950/50 border border-purple-500/40 text-purple-300 font-bold">
                            Revendedor: Bs {p.precioRevendedor ?? 10}
                          </span>

                          <button
                            type="button"
                            onClick={() => iniciarEdicionPlataforma(p, idx)}
                            className="px-3 py-1.5 bg-[#66FF00] text-black font-black rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => eliminarPlataforma(p.nombre)}
                            className="p-1.5 text-gray-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROVEEDORES */}
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

      {/* MODAL REVENDEDORES */}
      {modalRevendedores && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-2xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00]">Administrar Revendedores y Accesos ({revendedores.length})</h3>
              <button onClick={() => setModalRevendedores(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={agregarRevendedor} className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-[#66FF00]">+ Registrar Nuevo Revendedor con Acceso Propio</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input type="text" placeholder="Nombre *" value={nombreRev} onChange={(e) => setNombreRev(e.target.value)} className="bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
                <input type="text" placeholder="Teléfono *" value={telRev} onChange={(e) => setTelRev(e.target.value)} className="bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
                <input type="text" placeholder="Usuario Login" value={userRev} onChange={(e) => setUserRev(e.target.value)} className="bg-[#111A10] border border-[#66FF00]/60 rounded-xl p-2 text-xs text-white" />
                <input type="text" placeholder="PIN / Clave" value={pinRev} onChange={(e) => setPinRev(e.target.value)} className="bg-[#111A10] border border-[#66FF00]/60 rounded-xl p-2 text-xs text-white font-mono" />
              </div>
              <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={stockPermRev} onChange={(e) => setStockPermRev(e.target.checked)} />
                  <span>📦 Habilitar apartado de Matrices (Puede sacar cupos libres de mi Stock)</span>
                </label>
                <button type="submit" className="px-5 py-2 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer">
                  + Crear Revendedor
                </button>
              </div>
            </form>

            <input type="text" placeholder="Buscar revendedor..." value={busquedaRev} onChange={(e) => setBusquedaRev(e.target.value)} className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />

            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {revendedores
                .filter((r) => !busquedaRev.trim() || r.nombre.toLowerCase().includes(busquedaRev.toLowerCase()) || r.telefono.includes(busquedaRev))
                .map((r) => (
                  <div key={r.id} className="bg-[#070B06] border border-[#1E331A] p-3 rounded-2xl space-y-2 text-xs">
                    {editRev?.id === r.id ? (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                        <input type="text" value={editRev.nombre} onChange={(e) => setEditRev({ ...editRev, nombre: e.target.value })} placeholder="Nombre" className="bg-black border border-[#66FF00] rounded-lg p-1.5 text-xs text-white" />
                        <input type="text" value={editRev.telefono} onChange={(e) => setEditRev({ ...editRev, telefono: e.target.value })} placeholder="Teléfono" className="bg-black border border-[#66FF00] rounded-lg p-1.5 text-xs text-white" />
                        <input type="text" value={editRev.usuario || ""} onChange={(e) => setEditRev({ ...editRev, usuario: e.target.value })} placeholder="Usuario" className="bg-black border border-[#66FF00] rounded-lg p-1.5 text-xs text-white" />
                        <input type="text" value={editRev.pin || ""} onChange={(e) => setEditRev({ ...editRev, pin: e.target.value })} placeholder="PIN" className="bg-black border border-[#66FF00] rounded-lg p-1.5 text-xs text-white font-mono" />
                        <button onClick={guardarEdicionRev} className="py-1.5 bg-[#66FF00] text-black font-black rounded-lg text-xs cursor-pointer">
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div>
                          <p className="font-black text-white text-sm">{r.nombre} · <span className="text-[#66FF00] font-mono">📞 {r.telefono}</span></p>
                          <p className="text-gray-400 text-[11px] mt-0.5">
                            🔑 Usuario: <b className="text-white font-mono">{r.usuario || r.nombre.toLowerCase()}</b> | PIN: <b className="text-[#66FF00] font-mono">{r.pin || "1234"}</b>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePermisoStockRevendedor(r)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border flex items-center gap-1 cursor-pointer ${
                              r.puede_ver_matrices
                                ? "bg-[#66FF00]/20 text-[#66FF00] border-[#66FF00]"
                                : "bg-gray-900 text-gray-400 border-gray-700"
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5" />
                            {r.puede_ver_matrices ? "✓ Acceso a Matrices Activo" : "Sin Acceso a Matrices"}
                          </button>

                          <button onClick={() => setEditRev({ ...r, usuario: r.usuario || r.nombre.toLowerCase(), pin: r.pin || "1234" })} className="p-1.5 text-gray-400 hover:text-[#66FF00]">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={async () => { await supabase.from("revendedores").delete().eq("id", r.id); await recargarTodo(); }} className="p-1.5 text-gray-500 hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}