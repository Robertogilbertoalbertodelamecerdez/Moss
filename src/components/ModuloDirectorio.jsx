"use client";
import React, { useState } from "react";
import { supabase, PLATAFORMAS, formatearFechaDMA } from "@/config";
import {
  Search,
  AlertTriangle,
  RefreshCcw,
  DollarSign,
  Trash2,
  RotateCcw,
  Edit3,
  Users,
  Truck,
  Layers,
  X
} from "lucide-react";

export default function ModuloDirectorio({
  suscripciones = [],
  matrices = [],
  clientes = [],
  proveedores = [],
  plataformasList = PLATAFORMAS,
  recargarTodo,
  notificar
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState("Todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const [subReemplazo, setSubReemplazo] = useState(null);
  const [origenReemp, setOrigenReemp] = useState("stock");
  const [matrizReempId, setMatrizReempId] = useState("");
  const [provReempId, setProvReempId] = useState("");
  const [correoReemp, setCorreoReemp] = useState("");
  const [passReemp, setPassReemp] = useState("");
  const [perfilReemp, setPerfilReemp] = useState("");
  const [pinReemp, setPinReemp] = useState("");
  const [costoReemp, setCostoReemp] = useState(0);

  const [subReembolso, setSubReembolso] = useState(null);
  const [montoReembolsoCalc, setMontoReembolsoCalc] = useState(0);
  const [diasRestantesCalc, setDiasRestantesCalc] = useState(0);
  const [pasoConfirmacionReembolso, setPasoConfirmacionReembolso] = useState(1);

  const [subEditar, setSubEditar] = useState(null);
  const [matrizNuevaEdicionId, setMatrizNuevaEdicionId] = useState("");

  const calcularDiasRestantes = (fechaCorte) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const corte = new Date(fechaCorte + "T00:00:00");
    return Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
  };

  const suscripcionesFiltradas = suscripciones.filter((s) => {
    if (filtroEstado === "papelera") {
      if (!s.en_papelera) return false;
    } else {
      if (s.en_papelera) return false;
    }

    if (filtroPlataforma !== "Todas" && s.plataforma !== filtroPlataforma) return false;

    const dias = calcularDiasRestantes(s.fecha_corte);
    if (filtroEstado === "vence_3" && (dias > 3 || s.estado !== "Activa")) return false;
    if (filtroEstado === "vence_1" && (dias > 1 || s.estado !== "Activa")) return false;
    if (filtroEstado === "caidos" && s.estado !== "Caida") return false;
    if (filtroEstado === "reembolsados" && s.estado !== "Reembolsada") return false;

    if (busqueda.trim() !== "") {
      const q = busqueda.toLowerCase();
      const coincide =
        (s.nombre_cliente || "").toLowerCase().includes(q) ||
        (s.telefono_cliente || "").toLowerCase().includes(q) ||
        (s.correo_cuenta || "").toLowerCase().includes(q) ||
        (s.nombre_perfil || "").toLowerCase().includes(q) ||
        (s.nombre_proveedor || "").toLowerCase().includes(q) ||
        (s.telefono_proveedor || "").toLowerCase().includes(q);
      if (!coincide) return false;
    }

    return true;
  });

  const toggleCaido = async (s) => {
    const nuevo = s.estado === "Caida" ? "Activa" : "Caida";
    await supabase.from("suscripciones").update({ estado: nuevo }).eq("id", s.id);
    await recargarTodo();
    notificar(nuevo === "Caida" ? `Cuenta marcada como Caída` : `Cuenta reactivada`);
  };

  const abrirModalReembolso = (s) => {
    const diasRest = Math.max(0, calcularDiasRestantes(s.fecha_corte));
    const diasContratados = Number(s.dias_totales || 30);
    const reembolsoSugerido = ((Number(s.precio_venta) / diasContratados) * diasRest).toFixed(2);
    setSubReembolso(s);
    setDiasRestantesCalc(diasRest);
    setMontoReembolsoCalc(reembolsoSugerido);
    setPasoConfirmacionReembolso(1);
  };

  const ejecutarReembolsoConfirmado = async () => {
    if (!subReembolso) return;
    if (subReembolso.perfil_id) {
      await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subReembolso.perfil_id);
    }

    await supabase
      .from("suscripciones")
      .update({ estado: "Reembolsada", perfil_id: null })
      .eq("id", subReembolso.id);

    await supabase.from("movimientos_yolo").insert([{
      tipo: "Reembolso",
      monto: -Math.abs(Number(montoReembolsoCalc)),
      afecta_ganancia_neta: true,
      descripcion: `Reembolso a ${subReembolso.nombre_cliente} (${diasRestantesCalc} días restantes)`,
      referencia_id: subReembolso.id
    }]);

    setSubReembolso(null);
    await recargarTodo();
    notificar(`Reembolso de Bs ${montoReembolsoCalc} aplicado`);
  };

  const cancelarReembolso = async (s) => {
    await supabase
      .from("movimientos_yolo")
      .delete()
      .eq("referencia_id", s.id)
      .eq("tipo", "Reembolso");
    await supabase.from("suscripciones").update({ estado: "Activa" }).eq("id", s.id);
    await recargarTodo();
    notificar("Reembolso revertido y saldo restaurado");
  };

  const ejecutarReemplazo = async (e) => {
    e.preventDefault();
    if (!subReemplazo) return;

    let nuevosDatos = { estado: "Activa" };

    if (origenReemp === "stock") {
      const mat = matrices.find((m) => m.id === matrizReempId);
      if (!mat) return notificar("Elige una matriz con espacio", "error");
      const libres = (mat.perfiles_matriz || []).filter((p) => !p.ocupado);
      libres.sort((a, b) => (a.es_extra_final !== b.es_extra_final ? (a.es_extra_final ? 1 : -1) : a.numero_slot - b.numero_slot));
      const slot = libres[0];
      if (!slot) return notificar("Esa matriz no tiene perfiles libres", "error");

      if (subReemplazo.perfil_id) {
        await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subReemplazo.perfil_id);
      }
      await supabase.from("perfiles_matriz").update({ ocupado: true }).eq("id", slot.id);

      nuevosDatos = {
        ...nuevosDatos,
        origen: "stock",
        matriz_id: mat.id,
        perfil_id: slot.id,
        proveedor_id: mat.proveedor_id || null,
        nombre_proveedor: mat.nombre_proveedor || null,
        telefono_proveedor: mat.telefono_proveedor || null,
        correo_cuenta: mat.correo,
        password_cuenta: mat.password,
        nombre_perfil: slot.nombre_perfil,
        pin_perfil: slot.pin
      };
    } else {
      if (subReemplazo.perfil_id) {
        await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subReemplazo.perfil_id);
      }
      const provObj = proveedores.find((p) => p.id === (provReempId || proveedores[0]?.id));
      nuevosDatos = {
        ...nuevosDatos,
        origen: "proveedor",
        matriz_id: null,
        perfil_id: null,
        proveedor_id: provObj ? provObj.id : subReemplazo.proveedor_id,
        nombre_proveedor: provObj ? provObj.nombre : subReemplazo.nombre_proveedor,
        telefono_proveedor: provObj ? provObj.telefono : subReemplazo.telefono_proveedor,
        correo_cuenta: correoReemp,
        password_cuenta: passReemp,
        nombre_perfil: perfilReemp || "Cuenta / Invitación",
        pin_perfil: pinReemp
      };
    }

    await supabase.from("suscripciones").update(nuevosDatos).eq("id", subReemplazo.id);

    if (Number(costoReemp) > 0) {
      await supabase.from("movimientos_yolo").insert([{
        tipo: "Costo Proveedor",
        monto: -Math.abs(Number(costoReemp)),
        afecta_ganancia_neta: true,
        descripcion: `Costo por reemplazo a ${subReemplazo.nombre_cliente}`,
        referencia_id: subReemplazo.id
      }]);
    }

    setSubReemplazo(null);
    await recargarTodo();
    notificar("¡Reemplazo asignado con éxito!");
  };

  const enviarAPapelera = async (s) => {
    if (s.perfil_id) {
      await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", s.perfil_id);
    }
    await supabase.from("suscripciones").update({ en_papelera: true, perfil_id: null }).eq("id", s.id);
    await supabase.from("movimientos_yolo").delete().eq("referencia_id", s.id);
    await recargarTodo();
    notificar("Venta enviada a la Papelera y cupo liberado");
  };

  const restaurarDePapelera = async (s) => {
    await supabase.from("suscripciones").update({ en_papelera: false }).eq("id", s.id);
    await supabase.from("movimientos_yolo").insert([{
      tipo: "Ingreso Venta",
      monto: Number(s.precio_venta),
      afecta_ganancia_neta: true,
      descripcion: `Venta restaurada (${s.nombre_cliente})`,
      referencia_id: s.id
    }]);
    await recargarTodo();
    notificar("Venta restaurada del historial");
  };

  const borrarDefinitivo = async (s) => {
    if (s.perfil_id) {
      await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", s.perfil_id);
    }
    await supabase.from("movimientos_yolo").delete().eq("referencia_id", s.id);
    await supabase.from("suscripciones").delete().eq("id", s.id);

    const otrasVentasDelCliente = suscripciones.filter(
      (otra) => otra.id !== s.id && otra.telefono_cliente === s.telefono_cliente
    );
    if (otrasVentasDelCliente.length === 0) {
      await supabase.from("clientes").delete().eq("telefono", s.telefono_cliente);
    }

    await recargarTodo();
    notificar("Registro eliminado definitivamente de Supabase");
  };

  const vaciarPapeleraCompleta = async () => {
    const enPapelera = suscripciones.filter((s) => s.en_papelera);
    const matricesPapelera = matrices.filter((m) => m.en_papelera);
    if (enPapelera.length === 0 && matricesPapelera.length === 0) {
      return notificar("La papelera ya está vacía", "error");
    }

    for (const s of enPapelera) {
      await supabase.from("movimientos_yolo").delete().eq("referencia_id", s.id);
      await supabase.from("suscripciones").delete().eq("id", s.id);
    }
    for (const m of matricesPapelera) {
      await supabase.from("movimientos_yolo").delete().eq("referencia_id", m.id);
      await supabase.from("matrices_stock").delete().eq("id", m.id);
    }
    await recargarTodo();
    notificar("¡Papelera vaciada de Supabase!");
  };

  const eliminarClienteDeBD = async (cli) => {
    await supabase.from("clientes").delete().eq("id", cli.id);
    await recargarTodo();
    notificar(`Cliente ${cli.nombre} eliminado de la agenda`);
  };

  const guardarEdicionManual = async (e) => {
    e.preventDefault();

    let payload = {
      plataforma: subEditar.plataforma,
      nombre_cliente: subEditar.nombre_cliente,
      telefono_cliente: subEditar.telefono_cliente,
      correo_cuenta: subEditar.correo_cuenta,
      password_cuenta: subEditar.password_cuenta,
      nombre_perfil: subEditar.nombre_perfil,
      pin_perfil: subEditar.pin_perfil,
      precio_venta: Number(subEditar.precio_venta),
      fecha_corte: subEditar.fecha_corte,
      origen: subEditar.origen,
      proveedor_id: subEditar.proveedor_id || null,
      nombre_proveedor: subEditar.nombre_proveedor || null,
      telefono_proveedor: subEditar.telefono_proveedor || null
    };

    if (subEditar.origen === "stock" && matrizNuevaEdicionId) {
      const mat = matrices.find((m) => m.id === matrizNuevaEdicionId);
      if (!mat) return notificar("Selecciona una matriz válida", "error");
      const libres = (mat.perfiles_matriz || []).filter((p) => !p.ocupado);
      libres.sort((a, b) => (a.es_extra_final !== b.es_extra_final ? (a.es_extra_final ? 1 : -1) : a.numero_slot - b.numero_slot));
      const slot = libres[0];
      if (!slot) return notificar("Esa matriz no tiene cupos libres", "error");

      if (subEditar.perfil_id) {
        await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subEditar.perfil_id);
      }
      await supabase.from("perfiles_matriz").update({ ocupado: true }).eq("id", slot.id);

      payload = {
        ...payload,
        matriz_id: mat.id,
        perfil_id: slot.id,
        correo_cuenta: mat.correo,
        password_cuenta: mat.password,
        nombre_perfil: slot.nombre_perfil,
        pin_perfil: slot.pin,
        proveedor_id: mat.proveedor_id || null,
        nombre_proveedor: mat.nombre_proveedor || null,
        telefono_proveedor: mat.telefono_proveedor || null
      };
    } else if (subEditar.origen === "proveedor") {
      if (subEditar.perfil_id) {
        await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subEditar.perfil_id);
      }
      payload.matriz_id = null;
      payload.perfil_id = null;
    }

    await supabase.from("suscripciones").update(payload).eq("id", subEditar.id);
    setSubEditar(null);
    setMatrizNuevaEdicionId("");
    await recargarTodo();
    notificar("Suscripción actualizada correctamente");
  };

  return (
    <div className="space-y-5">
      {/* BUSCADOR Y FILTROS */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#66FF00] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por teléfono, nombre de cliente, correo, perfil o nombre de proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-[#66FF00] outline-none"
            />
          </div>

          <select
            value={filtroPlataforma}
            onChange={(e) => setFiltroPlataforma(e.target.value)}
            className="bg-[#070B06] border border-[#2A4226] rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="Todas">Todas las Plataformas</option>
            {plataformasList.map((p) => (
              <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "todos", label: `Todos Activos (${suscripciones.filter((s) => !s.en_papelera).length})` },
            { id: "vence_3", label: "Por Vencer (≤ 3 días)" },
            { id: "vence_1", label: "Falta 1 Día" },
            { id: "caidos", label: "⚠️ Caídos" },
            { id: "reembolsados", label: "Reembolsados" },
            { id: "clientes_bd", label: `👤 Agenda Clientes (${clientes.length})` },
            { id: "papelera", label: `🗑️ Papelera (${suscripciones.filter((s) => s.en_papelera).length})` }
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setFiltroEstado(b.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                filtroEstado === b.id
                  ? "bg-[#66FF00] text-black border-[#66FF00]"
                  : "bg-[#070B06] text-gray-300 border-[#2A4226]"
              }`}
            >
              {b.label}
            </button>
          ))}

          {filtroEstado === "papelera" && (
            <button
              onClick={vaciarPapeleraCompleta}
              className="ml-auto px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vaciar Papelera
            </button>
          )}
        </div>
      </div>

      {/* AGENDA DE CLIENTES */}
      {filtroEstado === "clientes_bd" ? (
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-[#66FF00] flex items-center gap-2">
            <Users className="w-4 h-4" /> Clientes Guardados ({clientes.length})
          </h3>
          {clientes.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">No hay clientes guardados.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {clientes
                .filter(
                  (c) =>
                    !busqueda.trim() ||
                    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                    c.telefono.includes(busqueda)
                )
                .map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#070B06] border border-[#1E331A] p-3 rounded-xl flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">{c.nombre}</p>
                      <p className="text-[#66FF00] font-mono">📞 {c.telefono}</p>
                    </div>
                    <button
                      onClick={() => eliminarClienteDeBD(c)}
                      className="p-1.5 text-gray-400 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        /* LISTA DE SUSCRIPCIONES EN DIRECTORIO */
        <div className="space-y-3">
          {suscripcionesFiltradas.length === 0 ? (
            <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-8 text-center text-gray-400 text-sm">
              No se encontraron registros con ese filtro o búsqueda.
            </div>
          ) : (
            suscripcionesFiltradas.map((s) => {
              const dias = calcularDiasRestantes(s.fecha_corte);
              return (
                <div
                  key={s.id}
                  className={`bg-[#111A10] border rounded-2xl p-4 space-y-3 ${
                    s.estado === "Caida" ? "border-red-500" : "border-[#233820]"
                  }`}
                >
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                          {s.plataforma}
                        </span>

                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#182616] border border-[#2D4729] text-gray-200 flex items-center gap-1 font-semibold">
                          {s.origen === "stock" ? (
                            <>
                              <Layers className="w-3 h-3 text-[#66FF00]" /> Matriz Stock
                              {s.nombre_proveedor ? ` (Prov: ${s.nombre_proveedor})` : ""}
                            </>
                          ) : (
                            <>
                              <Truck className="w-3 h-3 text-[#66FF00]" /> Proveedor:{" "}
                              <b className="text-[#66FF00]">{s.nombre_proveedor || "Sin asignar"}</b>
                              {s.telefono_proveedor ? ` (${s.telefono_proveedor})` : ""}
                            </>
                          )}
                        </span>

                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            s.estado === "Caida"
                              ? "bg-red-600 text-white"
                              : s.estado === "Reembolsada"
                              ? "bg-purple-600 text-white"
                              : "bg-green-900/40 text-green-300"
                          }`}
                        >
                          {s.estado}
                        </span>
                      </div>

                      <h3 className="font-bold text-base pt-0.5">
                        {s.nombre_cliente} · <span className="text-[#66FF00] font-mono">{s.telefono_cliente}</span>
                      </h3>
                      <p className="text-xs text-gray-300">
                        Correo: <span className="font-mono text-white">{s.correo_cuenta}</span>
                        {s.password_cuenta ? (
                          <>
                            {" "}
                            | Clave: <span className="font-mono text-[#66FF00]">{s.password_cuenta}</span>
                          </>
                        ) : null}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.nombre_perfil && s.nombre_perfil !== "Cuenta / Invitación" ? `Perfil: ${s.nombre_perfil} · ` : ""}
                        {s.pin_perfil ? `PIN: ${s.pin_perfil} · ` : ""}
                        Pagó: <b className="text-white">Bs {s.precio_venta}</b>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className={`text-xs font-bold ${dias <= 1 ? "text-red-400" : dias <= 3 ? "text-yellow-400" : "text-gray-300"}`}>
                        {dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `Quedan ${dias} día(s)`}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Corte: <b className="text-gray-200">{formatearFechaDMA(s.fecha_corte)}</b>
                      </p>
                    </div>
                  </div>

                  {/* ACCIONES */}
                  {!s.en_papelera ? (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1E331A]">
                      <button
                        onClick={() => {
                          setSubEditar(s);
                          setMatrizNuevaEdicionId("");
                        }}
                        className="px-3 py-1.5 bg-[#1A2B18] hover:bg-[#253D22] text-white border border-[#66FF00]/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#66FF00]" /> Editar / Cambiar Proveedor o Matriz
                      </button>

                      <button
                        onClick={() => toggleCaido(s)}
                        className="px-2.5 py-1.5 bg-red-950/70 text-red-300 border border-red-800/50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {s.estado === "Caida" ? "Quitar Caído" : "Marcar Caído"}
                      </button>

                      <button
                        onClick={() => {
                          setSubReemplazo(s);
                          setCostoReemp(0);
                        }}
                        className="px-2.5 py-1.5 bg-[#66FF00] text-black rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCcw className="w-3.5 h-3.5" /> Dar Reemplazo
                      </button>

                      {s.estado !== "Reembolsada" ? (
                        <button
                          onClick={() => abrirModalReembolso(s)}
                          className="px-2.5 py-1.5 bg-purple-950/80 text-purple-300 border border-purple-700/50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Reembolsar Días
                        </button>
                      ) : (
                        <button
                          onClick={() => cancelarReembolso(s)}
                          className="px-2.5 py-1.5 bg-yellow-500 text-black rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Cancelar Reembolso
                        </button>
                      )}

                      <button
                        onClick={() => enviarAPapelera(s)}
                        className="ml-auto p-1.5 bg-gray-900 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded-xl cursor-pointer"
                        title="Enviar a Papelera"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2 border-t border-[#1E331A]">
                      <button
                        onClick={() => restaurarDePapelera(s)}
                        className="px-3 py-1.5 bg-[#66FF00] text-black rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar Venta
                      </button>
                      <button
                        onClick={() => borrarDefinitivo(s)}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Borrar Definitivamente de BD
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VENTANA EMERGENTE: EDITAR SUSCRIPCIÓN */}
      {subEditar && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={guardarEdicionManual}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-[0_0_50px_rgba(102,255,0,0.25)] max-h-[92vh] overflow-y-auto animate-modal"
          >
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <h3 className="font-black text-[#66FF00] text-base">
                Editar Venta / Cambiar Proveedor o Matriz
              </h3>
              <button
                type="button"
                onClick={() => setSubEditar(null)}
                className="p-1 rounded-xl bg-[#070B06] text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0B120A] border border-[#2A4226] rounded-2xl p-3.5 space-y-3">
              <label className="text-xs font-extrabold text-[#66FF00] block">
                Origen de la Cuenta:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubEditar({ ...subEditar, origen: "stock" })}
                  className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    subEditar.origen === "stock"
                      ? "bg-[#66FF00] text-black border-[#66FF00]"
                      : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                  }`}
                >
                  De mi Matriz Stock
                </button>
                <button
                  type="button"
                  onClick={() => setSubEditar({ ...subEditar, origen: "proveedor" })}
                  className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    subEditar.origen === "proveedor"
                      ? "bg-[#66FF00] text-black border-[#66FF00]"
                      : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                  }`}
                >
                  De Proveedor Externo
                </button>
              </div>

              {subEditar.origen === "stock" ? (
                <div>
                  <label className="text-[11px] text-gray-300">
                    Asignar / Mover a una Matriz de mi Stock:
                  </label>
                  <select
                    value={matrizNuevaEdicionId}
                    onChange={(e) => setMatrizNuevaEdicionId(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white"
                  >
                    <option value="">-- Mantener cuenta/perfil actual ({subEditar.correo_cuenta}) --</option>
                    {matrices
                      .filter((m) => !m.en_papelera && m.estado === "Activa")
                      .map((m) => {
                        const libres = (m.perfiles_matriz || []).filter((p) => !p.ocupado).length;
                        return (
                          <option key={m.id} value={m.id}>
                            {m.plataforma} — {m.correo} ({libres} cupos libres)
                          </option>
                        );
                      })}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] text-gray-300">Seleccionar Proveedor de esta cuenta:</label>
                  <select
                    value={subEditar.proveedor_id || ""}
                    onChange={(e) => {
                      const prov = proveedores.find((p) => p.id === e.target.value);
                      if (prov) {
                        setSubEditar({
                          ...subEditar,
                          proveedor_id: prov.id,
                          nombre_proveedor: prov.nombre,
                          telefono_proveedor: prov.telefono
                        });
                      } else {
                        setSubEditar({
                          ...subEditar,
                          proveedor_id: null,
                          nombre_proveedor: "",
                          telefono_proveedor: ""
                        });
                      }
                    }}
                    className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white"
                  >
                    <option value="">-- Sin proveedor / Elegir de la lista --</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — 📞 {p.telefono}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400">Nombre Cliente</label>
                <input
                  type="text"
                  value={subEditar.nombre_cliente}
                  onChange={(e) => setSubEditar({ ...subEditar, nombre_cliente: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">Teléfono Cliente</label>
                <input
                  type="text"
                  value={subEditar.telefono_cliente}
                  onChange={(e) => setSubEditar({ ...subEditar, telefono_cliente: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">Correo Cuenta</label>
                <input
                  type="text"
                  value={subEditar.correo_cuenta}
                  onChange={(e) => setSubEditar({ ...subEditar, correo_cuenta: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">Contraseña</label>
                <input
                  type="text"
                  value={subEditar.password_cuenta || ""}
                  onChange={(e) => setSubEditar({ ...subEditar, password_cuenta: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">Perfil</label>
                <input
                  type="text"
                  value={subEditar.nombre_perfil || ""}
                  onChange={(e) => setSubEditar({ ...subEditar, nombre_perfil: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">PIN</label>
                <input
                  type="text"
                  value={subEditar.pin_perfil || ""}
                  onChange={(e) => setSubEditar({ ...subEditar, pin_perfil: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">Precio Venta (Bs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={subEditar.precio_venta}
                  onChange={(e) => setSubEditar({ ...subEditar, precio_venta: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">
                  Fecha Corte ({formatearFechaDMA(subEditar.fecha_corte)})
                </label>
                <input
                  type="date"
                  value={subEditar.fecha_corte}
                  onChange={(e) => setSubEditar({ ...subEditar, fecha_corte: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubEditar(null)}
                className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer"
              >
                Guardar Todos los Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DAR REEMPLAZO */}
      {subReemplazo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={ejecutarReemplazo} className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-md w-full space-y-4 animate-modal">
            <h3 className="font-bold text-[#66FF00]">Dar Reemplazo a {subReemplazo.nombre_cliente}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrigenReemp("stock")}
                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  origenReemp === "stock" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                }`}
              >
                De mi Stock
              </button>
              <button
                type="button"
                onClick={() => setOrigenReemp("proveedor")}
                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  origenReemp === "proveedor" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                }`}
              >
                De Proveedor
              </button>
            </div>

            {origenReemp === "stock" ? (
              <select
                value={matrizReempId}
                onChange={(e) => setMatrizReempId(e.target.value)}
                className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
              >
                <option value="">-- Selecciona Matriz con espacio --</option>
                {matrices
                  .filter((m) => !m.en_papelera && m.estado === "Activa")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.plataforma} - {m.correo} ({(m.perfiles_matriz || []).filter((p) => !p.ocupado).length} libres)
                    </option>
                  ))}
              </select>
            ) : (
              <div className="space-y-2">
                <select
                  value={provReempId}
                  onChange={(e) => setProvReempId(e.target.value)}
                  className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                >
                  <option value="">-- Mantener proveedor actual --</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.telefono})</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nuevo Correo"
                    value={correoReemp}
                    onChange={(e) => setCorreoReemp(e.target.value)}
                    className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Nueva Clave"
                    value={passReemp}
                    onChange={(e) => setPassReemp(e.target.value)}
                    className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Perfil"
                    value={perfilReemp}
                    onChange={(e) => setPerfilReemp(e.target.value)}
                    className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="PIN"
                    value={pinReemp}
                    onChange={(e) => setPinReemp(e.target.value)}
                    className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400">Costo del Reemplazo (Por defecto 0)</label>
              <input
                type="number"
                step="0.01"
                value={costoReemp}
                onChange={(e) => setCostoReemp(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white"
              />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setSubReemplazo(null)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2 bg-[#66FF00] text-black rounded-xl text-xs font-bold cursor-pointer">
                Confirmar Reemplazo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL REEMBOLSO */}
      {subReembolso && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-purple-500 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-modal">
            <h3 className="font-bold text-purple-300">Calcular Reembolso por Días</h3>
            <p className="text-xs text-gray-300">
              Cliente: <b>{subReembolso.nombre_cliente}</b> ({subReembolso.plataforma})<br />
              Pagó: Bs {subReembolso.precio_venta} por {subReembolso.dias_totales} días.<br />
              Le quedaban: <b className="text-[#66FF00]">{diasRestantesCalc} día(s)</b>.
            </p>

            <div>
              <label className="text-xs text-gray-400">Monto a Reembolsar (Bs)</label>
              <input
                type="number"
                step="0.01"
                value={montoReembolsoCalc}
                onChange={(e) => setMontoReembolsoCalc(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-purple-500 rounded-xl p-2.5 text-white font-bold"
              />
            </div>

            {pasoConfirmacionReembolso === 1 ? (
              <div className="flex gap-2">
                <button onClick={() => setSubReembolso(null)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">
                  Cancelar
                </button>
                <button
                  onClick={() => setPasoConfirmacionReembolso(2)}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Continuar Reembolso
                </button>
              </div>
            ) : (
              <div className="space-y-2 bg-red-950/60 border border-red-600 p-3 rounded-xl">
                <p className="text-xs text-red-200 font-bold text-center">
                  ¿Confirmar descuento de Bs {montoReembolsoCalc}?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPasoConfirmacionReembolso(1)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">
                    Atrás
                  </button>
                  <button
                    onClick={ejecutarReembolsoConfirmado}
                    className="flex-1 py-2 bg-red-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Sí, Reembolsar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}