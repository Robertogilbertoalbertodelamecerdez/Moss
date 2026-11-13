"use client";
import React, { useState, useRef } from "react";
import { supabase, PLATAFORMAS, formatearFechaDMA } from "@/config";
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
  ArrowDown,
  ShieldCheck,
  History
} from "lucide-react";

export default function ModuloConfig({
  esSuperAdmin = true,
  adminKeyActual = "admin",
  sesionActual = null,
  subAdmins = [],
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
  const [modalSubAdmins, setModalSubAdmins] = useState(false);

  const [subAdminHistorialFie, setSubAdminHistorialFie] = useState(null);
  const [cuentaFieEditandoId, setCuentaFieEditandoId] = useState(null);
  const [nuevoCostoFieInput, setNuevoCostoFieInput] = useState("");

  const [busquedaProv, setBusquedaProv] = useState("");
  const [busquedaRev, setBusquedaRev] = useState("");
  const [busquedaPlat, setBusquedaPlat] = useState("");

  const [propietarioRevFiltro, setPropietarioRevFiltro] = useState(adminKeyActual);

  const [nuevaPlatNombre, setNuevaPlatNombre] = useState("");
  const [esPorInvitacion, setEsPorInvitacion] = useState(false);
  const [nuevaPlatCupos, setNuevaPlatCupos] = useState(5);
  const [nuevaPlatPrecioCli, setNuevaPlatPrecioCli] = useState(20);
  const [nuevaPlatPrecioRev, setNuevaPlatPrecioRev] = useState(10);
  const [nuevaPlatPrecioSubAdmin, setNuevaPlatPrecioSubAdmin] = useState(10);
  const [nuevaPlatPidePass, setNuevaPlatPidePass] = useState(true);
  const [nuevaPlatPidePerfil, setNuevaPlatPidePerfil] = useState(true);
  const [nuevaPlatPidePin, setNuevaPlatPidePin] = useState(false);

  const [platEditando, setPlatEditando] = useState(null);

  const [nombreProv, setNombreProv] = useState("");
  const [telProv, setTelProv] = useState("");
  const [editProv, setEditProv] = useState(null);

  const [nombreRev, setNombreRev] = useState("");
  const [telRev, setTelRev] = useState("");
  const [userRev, setUserRev] = useState("");
  const [pinRev, setPinRev] = useState("1234");
  const [stockPermRev, setStockPermRev] = useState(true);
  const [editRev, setEditRev] = useState(null);

  const [nombreSubAdm, setNombreSubAdm] = useState("");
  const [telSubAdm, setTelSubAdm] = useState("");
  const [userSubAdm, setUserSubAdm] = useState("");
  const [pinSubAdm, setPinSubAdm] = useState("1234");
  const [editSubAdm, setEditSubAdm] = useState(null);

  const obtenerCuentasAlFieDeSubAdmin = (subAdminId) => {
    return suscripciones.filter((s) => {
      if (s.en_papelera) return false;
      if (s.admin_propietario !== subAdminId) return false;
      const provMoss = String(s.nombre_proveedor || "").toLowerCase().includes("moss");
      const matDeMateus =
        s.matriz_id &&
        (matrices.find((m) => m.id === s.matriz_id)?.admin_propietario || "admin") === "admin";
      return provMoss || Boolean(matDeMateus) || s.tipo_comprador === "subadmin";
    });
  };

  const cerarDeudaAlFieSubAdmin = async (sa) => {
    const pendientes = obtenerCuentasAlFieDeSubAdmin(sa.id).filter(
      (s) => s.pagado_al_admin === false
    );
    if (pendientes.length === 0) {
      return notificar(`${sa.nombre} no tiene deuda al fíe pendiente.`);
    }

    const totalCobrado = pendientes.reduce((acc, s) => acc + Number(s.costo_proveedor || 0), 0);
    const ids = pendientes.map((s) => s.id);

    await supabase
      .from("suscripciones")
      .update({ pagado_al_admin: true })
      .in("id", ids);

    if (totalCobrado > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          admin_propietario: "admin",
          tipo: "Ingreso Venta",
          monto: Math.abs(totalCobrado),
          afecta_ganancia_neta: true,
          descripcion: `Liquidación de ${pendientes.length} cuenta(s) al fíe de Admin ${sa.nombre}`
        }
      ]);
    }

    await recargarTodo();
    notificar(`¡Deuda al fíe de ${sa.nombre} cerada (+Bs ${totalCobrado.toFixed(2)} en tu banco)!`);
  };

  // Guardar la edición del precio al fíe de una cuenta de Marcus para que su costo y ganancia neta se recalculen bien
  const guardarNuevoCostoFieCuenta = async (subId) => {
    const num = Number(nuevoCostoFieInput || 0);
    await supabase
      .from("suscripciones")
      .update({ costo_proveedor: num })
      .eq("id", subId);
    setCuentaFieEditandoId(null);
    await recargarTodo();
    notificar("Precio al fíe actualizado (Se ajustó automáticamente el costo y ganancia neta de Marcus)");
  };

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
          precio_subadmin: Number(nuevaPlatPrecioSubAdmin || nuevaPlatPrecioRev || 10),
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
    notificar(`App ${limpio} guardada`);
  };

  const iniciarEdicionPlataforma = (p, idx) => {
    setPlatEditando({
      nombreOriginal: p.nombre,
      nombre: p.nombre,
      orden: p.orden ?? idx + 1,
      perfilesDefault: p.perfilesDefault ?? 5,
      precioCliente: p.precioCliente ?? 20,
      precioRevendedor: p.precioRevendedor ?? 10,
      precioSubAdmin: p.precioSubAdmin ?? p.precioRevendedor ?? 10,
      pidePass: p.pidePass !== false,
      pidePerfil: p.pidePerfil !== false,
      pidePin: p.pidePin !== false
    });
  };

  const guardarEdicionPlataforma = async () => {
    if (!platEditando) return;
    const payload = {
      nombre: platEditando.nombre.trim(),
      orden: Number(platEditando.orden || 1),
      perfiles_default: Number(platEditando.perfilesDefault || 1),
      tiene_extra_2020: platEditando.nombre.toLowerCase().includes("netflix"),
      precio_cliente: Number(platEditando.precioCliente || 0),
      precio_revendedor: Number(platEditando.precioRevendedor || 0),
      precio_subadmin: Number(platEditando.precioSubAdmin ?? platEditando.precioRevendedor ?? 0),
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
    notificar(`¡${payload.nombre} guardada!`);
  };

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
      precio_subadmin: Number(p.precioSubAdmin ?? p.precioRevendedor ?? 10),
      pide_pass: p.pidePass !== false,
      pide_perfil: p.pidePerfil !== false,
      pide_pin: p.pidePin !== false
    }));

    await supabase.from("plataformas").upsert(payloads, { onConflict: "nombre" });
    await recargarTodo();
    notificar("Orden actualizado");
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
    notificar("Proveedor agregado y sincronizado");
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

  const agregarSubAdmin = async (e) => {
    e.preventDefault();
    if (!nombreSubAdm.trim() || !telSubAdm.trim()) {
      return notificar("Ingresa nombre y teléfono del Admin asociado", "error");
    }
    const usuarioFinal = userSubAdm.trim() || nombreSubAdm.trim().split(" ")[0].toLowerCase();
    const { error } = await supabase.from("sub_admins").insert([
      {
        nombre: nombreSubAdm.trim(),
        telefono: telSubAdm.trim(),
        usuario: usuarioFinal,
        pin: pinSubAdm.trim() || "1234",
        nombre_billetera: `Billetera ${nombreSubAdm.trim()}`,
        activo: true
      }
    ]);
    if (error) return notificar("Error: " + error.message, "error");
    setNombreSubAdm("");
    setTelSubAdm("");
    setUserSubAdm("");
    setPinSubAdm("1234");
    await recargarTodo();
    notificar(`Usuario Admin ${nombreSubAdm.trim()} creado`);
  };

  const guardarEdicionSubAdmin = async () => {
    if (!editSubAdm) return;
    await supabase
      .from("sub_admins")
      .update({
        nombre: editSubAdm.nombre,
        telefono: editSubAdm.telefono,
        usuario: editSubAdm.usuario,
        pin: editSubAdm.pin
      })
      .eq("id", editSubAdm.id);
    setEditSubAdm(null);
    await recargarTodo();
    notificar("Datos del Admin Asociado actualizados");
  };

  const agregarRevendedor = async (e) => {
    e.preventDefault();
    if (!nombreRev.trim() || !telRev.trim()) return notificar("Ingresa nombre y teléfono", "error");
    const usuarioFinal = userRev.trim() || nombreRev.trim().split(" ")[0].toLowerCase();
    const ownerFinal = esSuperAdmin ? propietarioRevFiltro : adminKeyActual;

    await supabase.from("revendedores").insert([
      {
        admin_propietario: ownerFinal,
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
        admin_propietario: editRev.admin_propietario || "admin",
        puede_ver_matrices: editRev.puede_ver_matrices
      })
      .eq("id", editRev.id);
    setEditRev(null);
    await recargarTodo();
    notificar("Datos actualizados");
  };

  const togglePermisoStockRevendedor = async (r) => {
    await supabase
      .from("revendedores")
      .update({ puede_ver_matrices: !r.puede_ver_matrices })
      .eq("id", r.id);
    await recargarTodo();
    notificar("Permiso actualizado");
  };

  const guardarAjusteEnSupabase = async (clave, valor) => {
    await supabase.from("ajustes_sistema").upsert([{ clave, valor }], { onConflict: "clave" });
  };

  const descargarBackup = async () => {
    const [mRes, pefRes, sRes, cRes, prRes, revRes, yRes, plRes, ajRes, saRes] = await Promise.all([
      supabase.from("matrices_stock").select("*"),
      supabase.from("perfiles_matriz").select("*"),
      supabase.from("suscripciones").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("proveedores").select("*"),
      supabase.from("revendedores").select("*"),
      supabase.from("movimientos_yolo").select("*"),
      supabase.from("plataformas").select("*"),
      supabase.from("ajustes_sistema").select("*"),
      supabase.from("sub_admins").select("*")
    ]);

    const backupObj = {
      fecha_backup: new Date().toISOString(),
      version: "MOSS_CRM_7.0",
      sub_admins: saRes.data || [],
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
      if (data.sub_admins?.length) await supabase.from("sub_admins").upsert(data.sub_admins, { onConflict: "id", ignoreDuplicates: true });
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

  const revendedoresFiltradosModal = revendedores.filter((r) => {
    const owner = r.admin_propietario || "admin";
    const ownerFiltro = esSuperAdmin ? propietarioRevFiltro : adminKeyActual;
    if (owner !== ownerFiltro) return false;
    if (!busquedaRev.trim()) return true;
    return (
      r.nombre.toLowerCase().includes(busquedaRev.toLowerCase()) ||
      r.telefono.includes(busquedaRev)
    );
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#66FF00]" /> Catálogo ({plataformasList.length})
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Precios Cliente, Rev. y Marcus</p>
          </div>
          <button onClick={() => setModalPlataformas(true)} className="px-3.5 py-2 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer">
            Abrir
          </button>
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#66FF00]" /> Proveedores ({proveedores.length})
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Sincronizados para todos</p>
          </div>
          <button onClick={() => setModalProveedores(true)} className="px-3.5 py-2 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer">
            Abrir
          </button>
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-[#66FF00]" /> Revendedores
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {esSuperAdmin ? "Tuyos y de Marcus" : "Tus agentes de reventa"}
            </p>
          </div>
          <button
            onClick={() => {
              setPropietarioRevFiltro(adminKeyActual);
              setModalRevendedores(true);
            }}
            className="px-3.5 py-2 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer"
          >
            Abrir
          </button>
        </div>

        {esSuperAdmin && (
          <div className="bg-[#111A10] border-2 border-amber-400/70 rounded-3xl p-5 flex items-center justify-between">
            <div>
              <h3 className="font-black text-amber-300 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" /> Usuarios Admin ({subAdmins.length})
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Cobrar Fíe e Historial</p>
            </div>
            <button
              onClick={() => setModalSubAdmins(true)}
              className="px-3.5 py-2 bg-amber-400 text-black font-black rounded-xl text-xs cursor-pointer"
            >
              Administrar
            </button>
          </div>
        )}
      </div>

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
            <Wallet className="w-4 h-4" /> Nombre de Mi Billetera
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
                if (esSuperAdmin) {
                  await guardarAjusteEnSupabase("nombre_billetera", nombreBilletera);
                } else {
                  await supabase
                    .from("sub_admins")
                    .update({ nombre_billetera: nombreBilletera })
                    .eq("id", adminKeyActual);
                }
                await recargarTodo();
                notificar("Billetera guardada");
              }}
              className="px-4 py-2 bg-[#66FF00] text-black font-bold rounded-xl text-xs cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {esSuperAdmin && (
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#66FF00] flex items-center gap-2">
              <Settings className="w-4 h-4" /> Respaldo Total (Backup .JSON)
            </h2>
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
      )}

      {/* MODAL USUARIOS ADMIN */}
      {modalSubAdmins && esSuperAdmin && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-amber-400 rounded-3xl p-6 max-w-3xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h3 className="font-black text-amber-400 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Usuarios Admin Asociados & Liquidación de Deuda al Fíe
                </h3>
              </div>
              <button onClick={() => setModalSubAdmins(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={agregarSubAdmin} className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-300">+ Crear Nuevo Usuario Admin (Ej: Marcus)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Nombre (Ej: Marcus) *"
                  value={nombreSubAdm}
                  onChange={(e) => setNombreSubAdm(e.target.value)}
                  className="bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Teléfono WhatsApp *"
                  value={telSubAdm}
                  onChange={(e) => setTelSubAdm(e.target.value)}
                  className="bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Usuario Login"
                  value={userSubAdm}
                  onChange={(e) => setUserSubAdm(e.target.value)}
                  className="bg-[#111A10] border border-amber-400/60 rounded-xl p-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="PIN / Contraseña"
                  value={pinSubAdm}
                  onChange={(e) => setPinSubAdm(e.target.value)}
                  className="bg-[#111A10] border border-amber-400/60 rounded-xl p-2 text-xs text-white font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black rounded-xl text-xs cursor-pointer"
              >
                + Guardar Usuario Admin
              </button>
            </form>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {subAdmins.map((sa) => {
                const todasAlFie = obtenerCuentasAlFieDeSubAdmin(sa.id);
                const pendientesAlFie = todasAlFie.filter((s) => s.pagado_al_admin === false);
                const montoDeudaFie = pendientesAlFie.reduce(
                  (acc, s) => acc + Number(s.costo_proveedor || 0),
                  0
                );

                return (
                  <div key={sa.id} className="bg-[#070B06] border-2 border-amber-500/50 p-4 rounded-2xl space-y-3 text-xs">
                    {editSubAdm?.id === sa.id ? (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                        <input
                          type="text"
                          value={editSubAdm.nombre}
                          onChange={(e) => setEditSubAdm({ ...editSubAdm, nombre: e.target.value })}
                          className="bg-black border border-amber-400 rounded-lg p-1.5 text-white"
                        />
                        <input
                          type="text"
                          value={editSubAdm.telefono}
                          onChange={(e) => setEditSubAdm({ ...editSubAdm, telefono: e.target.value })}
                          className="bg-black border border-amber-400 rounded-lg p-1.5 text-white"
                        />
                        <input
                          type="text"
                          value={editSubAdm.usuario}
                          onChange={(e) => setEditSubAdm({ ...editSubAdm, usuario: e.target.value })}
                          className="bg-black border border-amber-400 rounded-lg p-1.5 text-white"
                        />
                        <input
                          type="text"
                          value={editSubAdm.pin}
                          onChange={(e) => setEditSubAdm({ ...editSubAdm, pin: e.target.value })}
                          className="bg-black border border-amber-400 rounded-lg p-1.5 text-white font-mono"
                        />
                        <button
                          onClick={guardarEdicionSubAdmin}
                          className="py-1.5 bg-amber-400 text-black font-black rounded-lg cursor-pointer"
                        >
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-between items-center gap-3">
                        <div>
                          <p className="font-black text-amber-300 text-base">
                            👑 {sa.nombre} · <span className="text-white font-mono text-xs">📞 {sa.telefono}</span>
                          </p>
                          <p className="text-gray-400 text-[11px] mt-0.5">
                            🔑 Usuario: <b className="text-white font-mono">{sa.usuario}</b> | PIN:{" "}
                            <b className="text-amber-300 font-mono">{sa.pin}</b>
                          </p>
                          <p className="mt-1.5 text-xs">
                            Deuda actual al fíe ({pendientesAlFie.length} ctas sin pagar):{" "}
                            <b className={montoDeudaFie > 0 ? "text-amber-400 text-sm font-black" : "text-[#66FF00] font-black"}>
                              Bs {montoDeudaFie.toFixed(2)}
                            </b>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => cerarDeudaAlFieSubAdmin(sa)}
                            className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1 cursor-pointer ${
                              montoDeudaFie > 0
                                ? "bg-[#66FF00] text-black shadow-[0_0_15px_rgba(102,255,0,0.4)]"
                                : "bg-green-950/50 text-green-300 border border-green-600/40"
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            {montoDeudaFie > 0
                              ? `Marcar Pagado (+Bs ${montoDeudaFie.toFixed(1)})`
                              : "✓ Deuda en 0"}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSubAdminHistorialFie(sa)}
                            className="px-3 py-2 bg-amber-400 text-black font-black rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <History className="w-4 h-4" /> Historial al Fíe ({todasAlFie.length})
                          </button>

                          <button
                            onClick={() => {
                              setModalSubAdmins(false);
                              setPropietarioRevFiltro(sa.id);
                              setModalRevendedores(true);
                            }}
                            className="px-3 py-2 bg-purple-950 text-purple-200 border border-purple-500 rounded-xl font-bold cursor-pointer"
                          >
                            Revendedores ({revendedores.filter((r) => r.admin_propietario === sa.id).length})
                          </button>

                          <button onClick={() => setEditSubAdm(sa)} className="p-1.5 text-gray-400 hover:text-amber-300">
                            <Edit3 className="w-4 h-4" />
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

      {/* MODAL HISTORIAL AL FÍE CON EDICIÓN DIRECTA DEL COSTO DE CADA CUENTA */}
      {subAdminHistorialFie && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-amber-400 rounded-3xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h3 className="font-black text-amber-400 text-base flex items-center gap-2">
                  <History className="w-5 h-5" /> Historial de Cuentas al Fíe de {subAdminHistorialFie.nombre}
                </h3>
                <p className="text-[11px] text-gray-400">
                  Puedes tocar "Editar Precio" en cualquier cuenta para ajustar cuánto te paga {subAdminHistorialFie.nombre} y que su ganancia neta se recalcule sola.
                </p>
              </div>
              <button onClick={() => setSubAdminHistorialFie(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {obtenerCuentasAlFieDeSubAdmin(subAdminHistorialFie.id).length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">
                  Aún no hay cuentas registradas al fíe para {subAdminHistorialFie.nombre}.
                </p>
              ) : (
                obtenerCuentasAlFieDeSubAdmin(subAdminHistorialFie.id).map((s) => {
                  const editandoPrecioEsta = cuentaFieEditandoId === s.id;
                  const gananciaDeMarcusEnEsta =
                    Number(s.precio_venta || 0) - Number(s.costo_proveedor || 0);

                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-2xl border flex flex-wrap justify-between items-center gap-2 text-xs ${
                        s.pagado_al_admin
                          ? "bg-[#070B06] border-[#1E331A] opacity-80"
                          : "bg-amber-950/30 border-amber-400"
                      }`}
                    >
                      <div>
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[10px]">
                          {s.plataforma}
                        </span>
                        <span className="ml-2 text-gray-400 font-mono">{formatearFechaDMA(s.fecha_venta)}</span>
                        <p className="text-white font-bold mt-1">
                          Cuenta: <span className="font-mono">{s.correo_cuenta}</span> ({s.nombre_perfil}) · Cliente: {s.nombre_cliente}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Él la vendió en: <b>Bs {Number(s.precio_venta || 0).toFixed(2)}</b> · Su ganancia neta:{" "}
                          <b className="text-[#66FF00]">Bs {gananciaDeMarcusEnEsta.toFixed(2)}</b>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {editandoPrecioEsta ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.5"
                              value={nuevoCostoFieInput}
                              onChange={(e) => setNuevoCostoFieInput(e.target.value)}
                              className="w-20 bg-black border border-amber-400 rounded-lg p-1.5 text-center text-white font-black"
                            />
                            <button
                              type="button"
                              onClick={() => guardarNuevoCostoFieCuenta(s.id)}
                              className="px-2.5 py-1.5 bg-[#66FF00] text-black font-black rounded-lg cursor-pointer"
                            >
                              Guardar
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-black text-amber-300">
                              Su Costo / Fíe: Bs {Number(s.costo_proveedor || 0).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCuentaFieEditandoId(s.id);
                                setNuevoCostoFieInput(String(s.costo_proveedor || 0));
                              }}
                              className="px-2.5 py-1 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/40 rounded-lg font-bold cursor-pointer"
                            >
                              ✏️ Editar Precio
                            </button>
                          </>
                        )}

                        {s.pagado_al_admin ? (
                          <span className="px-2.5 py-1 rounded-lg bg-green-900/40 text-green-300 font-bold">
                            ✓ Pagado
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-black">
                            ⏳ Debe
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PLATAFORMAS CON 3 PRECIOS FIJOS (CLIENTE | REVENDEDOR | MARCUS)      */}
      {/* ========================================================================= */}
      {modalPlataformas && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-3xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h3 className="font-black text-[#66FF00] text-base">
                  Catálogo de Plataformas y Precios Fijos ({plataformasList.length})
                </h3>
                <p className="text-[11px] text-gray-400">
                  Configura el precio fijo de Catálogo Cliente, Revendedor y Admin Asociado (Marcus).
                </p>
              </div>
              <button onClick={() => setModalPlataformas(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  <MailCheck className="w-3.5 h-3.5 inline mr-1" /> Por Invitación
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
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
                  placeholder="Cliente Bs"
                  value={nuevaPlatPrecioCli}
                  onChange={(e) => setNuevaPlatPrecioCli(e.target.value)}
                  className="bg-[#111A10] border border-[#66FF00] rounded-xl p-2 text-xs text-white font-bold"
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Rev. Bs"
                  value={nuevaPlatPrecioRev}
                  onChange={(e) => setNuevaPlatPrecioRev(e.target.value)}
                  className="bg-[#111A10] border border-purple-500 rounded-xl p-2 text-xs text-white font-bold"
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Marcus Bs"
                  value={nuevaPlatPrecioSubAdmin}
                  onChange={(e) => setNuevaPlatPrecioSubAdmin(e.target.value)}
                  className="bg-[#111A10] border border-amber-400 rounded-xl p-2 text-xs text-amber-300 font-bold"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {!esPorInvitacion && (
                  <div className="flex flex-wrap gap-3 text-xs text-gray-200">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={nuevaPlatPidePass} onChange={(e) => setNuevaPlatPidePass(e.target.checked)} />
                      Pide Contraseña
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={nuevaPlatPidePerfil} onChange={(e) => setNuevaPlatPidePerfil(e.target.checked)} />
                      Pide Perfil
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={nuevaPlatPidePin} onChange={(e) => setNuevaPlatPidePin(e.target.checked)} />
                      Pide PIN
                    </label>
                  </div>
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

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {plataformasList.map((p, idx) => {
                if (busquedaPlat.trim() && !p.nombre.toLowerCase().includes(busquedaPlat.toLowerCase())) {
                  return null;
                }
                const estaEditandoEsta = platEditando && platEditando.nombreOriginal === p.nombre;

                return (
                  <div
                    key={p.nombre}
                    className={`bg-[#070B06] border rounded-2xl p-3.5 text-xs transition ${
                      estaEditandoEsta ? "border-2 border-[#66FF00]" : "border-[#1E331A]"
                    }`}
                  >
                    {estaEditandoEsta ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
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
                            <label className="text-[10px] text-[#66FF00] font-bold">Cliente (Bs)</label>
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
                          <div>
                            <label className="text-[10px] text-amber-300 font-black">👑 Marcus (Bs)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={platEditando.precioSubAdmin}
                              onChange={(e) => setPlatEditando({ ...platEditando, precioSubAdmin: e.target.value })}
                              className="w-full mt-0.5 bg-[#111A10] border-2 border-amber-400 rounded-lg p-2 text-xs text-amber-300 font-black text-center"
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
                            {platEditando.pidePass ? "🔑 Pide Contraseña: SÍ" : "📩 Por Invitación"}
                          </button>

                          <div className="ml-auto flex gap-2">
                            <button
                              type="button"
                              onClick={() => setPlatEditando(null)}
                              className="px-3.5 py-1.5 bg-gray-800 text-white rounded-xl font-bold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={guardarEdicionPlataforma}
                              className="px-4 py-1.5 bg-[#66FF00] text-black rounded-xl font-black flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-4 h-4" /> Guardar Cambios
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moverOrdenPlataforma(idx, -1)}
                              className="p-0.5 bg-[#142012] hover:bg-[#66FF00] text-gray-300 hover:text-black rounded disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === plataformasList.length - 1}
                              onClick={() => moverOrdenPlataforma(idx, 1)}
                              className="p-0.5 bg-[#142012] hover:bg-[#66FF00] text-gray-300 hover:text-black rounded disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          <p className="font-black text-white text-sm">
                            #{idx + 1} {p.nombre}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-1 rounded-lg bg-[#122210] border border-[#66FF00]/40 text-[#66FF00] font-bold">
                            Cliente: Bs {p.precioCliente ?? 20}
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-purple-950/50 border border-purple-500/40 text-purple-300 font-bold">
                            Rev: Bs {p.precioRevendedor ?? 10}
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-amber-950/50 border border-amber-400/50 text-amber-300 font-black">
                            👑 Marcus: Bs {p.precioSubAdmin ?? p.precioRevendedor ?? 10}
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
              <h3 className="font-black text-[#66FF00]">Proveedores Compartidos ({proveedores.length})</h3>
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
              <h3 className="font-black text-[#66FF00]">Administrar Revendedores y Accesos</h3>
              <button onClick={() => setModalRevendedores(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            {esSuperAdmin && (
              <div className="flex flex-wrap gap-2 bg-[#070B06] p-2 rounded-2xl border border-[#233820]">
                <button
                  type="button"
                  onClick={() => setPropietarioRevFiltro("admin")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                    propietarioRevFiltro === "admin" ? "bg-[#66FF00] text-black" : "text-gray-300"
                  }`}
                >
                  👑 Mis Revendedores (Mateus) ({revendedores.filter((r) => (r.admin_propietario || "admin") === "admin").length})
                </button>
                {subAdmins.map((sa) => (
                  <button
                    key={sa.id}
                    type="button"
                    onClick={() => setPropietarioRevFiltro(sa.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                      propietarioRevFiltro === sa.id ? "bg-amber-400 text-black" : "text-amber-300"
                    }`}
                  >
                    🤝 Revendedores de {sa.nombre} ({revendedores.filter((r) => r.admin_propietario === sa.id).length})
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={agregarRevendedor} className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input type="text" placeholder="Nombre *" value={nombreRev} onChange={(e) => setNombreRev(e.target.value)} className="bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
                <input type="text" placeholder="Teléfono *" value={telRev} onChange={(e) => setTelRev(e.target.value)} className="bg-[#111A10] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
                <input type="text" placeholder="Usuario Login" value={userRev} onChange={(e) => setUserRev(e.target.value)} className="bg-[#111A10] border border-[#66FF00]/60 rounded-xl p-2 text-xs text-white" />
                <input type="text" placeholder="PIN / Clave" value={pinRev} onChange={(e) => setPinRev(e.target.value)} className="bg-[#111A10] border border-[#66FF00]/60 rounded-xl p-2 text-xs text-white font-mono" />
              </div>
              <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={stockPermRev} onChange={(e) => setStockPermRev(e.target.checked)} />
                  <span>📦 Habilitar apartado de Matrices</span>
                </label>
                <button type="submit" className="px-5 py-2 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer">
                  + Crear Revendedor
                </button>
              </div>
            </form>

            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {revendedoresFiltradosModal.map((r) => (
                <div key={r.id} className="bg-[#070B06] border border-[#1E331A] p-3 rounded-2xl space-y-2 text-xs">
                  {editRev?.id === r.id ? (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                      <input type="text" value={editRev.nombre} onChange={(e) => setEditRev({ ...editRev, nombre: e.target.value })} className="bg-black border border-[#66FF00] rounded-lg p-1.5 text-xs text-white" />
                      <input type="text" value={editRev.telefono} onChange={(e) => setEditRev({ ...editRev, telefono: e.target.value })} className="bg-black border border-[#66FF00] rounded-lg p-1.5 text-xs text-white" />
                      <input type="text" value={editRev.usuario || ""} onChange={(e) => setEditRev({ ...editRev, usuario: e.target.value })} className="bg-black border border-[#66FF00] rounded-lg p-1.5 text-xs text-white" />
                      <input type="text" value={editRev.pin || ""} onChange={(e) => setEditRev({ ...editRev, pin: e.target.value })} className="bg-black border border-[#66FF00] rounded-lg p-1.5 text-xs text-white font-mono" />
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
                            r.puede_ver_matrices ? "bg-[#66FF00]/20 text-[#66FF00] border-[#66FF00]" : "bg-gray-900 text-gray-400 border-gray-700"
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          {r.puede_ver_matrices ? "✓ Acceso a Stock" : "Sin Stock"}
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