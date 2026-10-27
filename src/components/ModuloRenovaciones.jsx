"use client";
import React, { useState } from "react";
import { supabase, formatearFechaDMA } from "@/config";
import { extraerDatosProveedor } from "@/utils/extractorProveedor";
import {
  Copy,
  Share2,
  Check,
  RefreshCw,
  XCircle,
  X,
  Sparkles,
  ClipboardPaste,
  Truck
} from "lucide-react";

export default function ModuloRenovaciones({
  suscripciones = [],
  matrices = [],
  proveedores = [],
  recargarTodo,
  notificar
}) {
  const [subTab, setSubTab] = useState("por_avisar");
  const [subRenovar, setSubRenovar] = useState(null);

  const [confirmandoNoRenuevaId, setConfirmandoNoRenuevaId] = useState(null);
  const [confirmandoRenovarMatrizId, setConfirmandoRenovarMatrizId] = useState(null);

  const [precioRenovacion, setPrecioRenovacion] = useState("");
  const [mesesRenovacion, setMesesRenovacion] = useState(1);
  const [origenRenovacion, setOrigenRenovacion] = useState("misma");
  const [nuevaMatrizId, setNuevaMatrizId] = useState("");
  const [proveedorRenovId, setProveedorRenovId] = useState("");
  const [textoProveedorCrudo, setTextoProveedorCrudo] = useState("");
  const [provCorreo, setProvCorreo] = useState("");
  const [provPass, setProvPass] = useState("");
  const [provPerfil, setProvPerfil] = useState("");
  const [provPin, setProvPin] = useState("");
  const [costoProv, setCostoProv] = useState("");

  const calcularDias = (fechaCorte) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const corte = new Date(fechaCorte + "T00:00:00");
    return Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
  };

  const subsPorVencer = suscripciones.filter((s) => {
    if (s.en_papelera || s.estado !== "Activa") return false;
    return calcularDias(s.fecha_corte) <= 3;
  });

  const listaPorAvisar = subsPorVencer.filter((s) => !s.avisado_renovacion);
  const listaAvisados = subsPorVencer.filter((s) => s.avisado_renovacion);

  const matricesPorVencer = matrices.filter((m) => {
    if (m.en_papelera || m.estado !== "Activa") return false;
    return calcularDias(m.fecha_corte_matriz) <= 3;
  });

  const marcarComoAvisado = async (sub, estadoBool) => {
    await supabase.from("suscripciones").update({ avisado_renovacion: estadoBool }).eq("id", sub.id);
    await recargarTodo();
    notificar(
      estadoBool
        ? `${sub.nombre_cliente} movido a Ya Avisados`
        : `${sub.nombre_cliente} devuelto a Por Avisar`
    );
  };

  const ejecutarNoVaARenovar = async (sub) => {
    if (sub.perfil_id) {
      await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", sub.perfil_id);
    }
    await supabase
      .from("suscripciones")
      .update({ estado: "No Renovo", perfil_id: null })
      .eq("id", sub.id);
    setConfirmandoNoRenuevaId(null);
    await recargarTodo();
    notificar(`Perfil de ${sub.nombre_cliente} liberado del stock`);
  };

  const ejecutarRenovarMatriz30Dias = async (m) => {
    const nuevaFecha = new Date(m.fecha_corte_matriz + "T12:00:00");
    nuevaFecha.setDate(nuevaFecha.getDate() + 30);

    await supabase
      .from("matrices_stock")
      .update({
        fecha_corte_matriz: nuevaFecha.toISOString().split("T")[0]
      })
      .eq("id", m.id);

    if (Number(m.costo_total) > 0) {
      await supabase.from("movimientos_yolo").insert([{
        tipo: "Costo Matriz",
        monto: -Math.abs(Number(m.costo_total)),
        afecta_ganancia_neta: true,
        descripcion: `Renovación matriz ${m.plataforma} (${m.correo})`,
        referencia_id: m.id
      }]);
    }

    setConfirmandoRenovarMatrizId(null);
    await recargarTodo();
    notificar(`Matriz ${m.correo} renovada por +30 días`);
  };

  const abrirModalRenovar = (sub) => {
    setSubRenovar(sub);
    setPrecioRenovacion(sub.precio_venta);
    setMesesRenovacion(1);
    setOrigenRenovacion("misma");
    setProveedorRenovId(sub.proveedor_id || proveedores[0]?.id || "");
    setTextoProveedorCrudo("");
    setProvCorreo(sub.correo_cuenta);
    setProvPass(sub.password_cuenta || "");
    setProvPerfil(sub.nombre_perfil || "");
    setProvPin(sub.pin_perfil || "");
    setCostoProv("0");
  };

  const procesarTextoRenovacion = (texto) => {
    setTextoProveedorCrudo(texto);
    const extraido = extraerDatosProveedor(texto);
    if (extraido.correo) setProvCorreo(extraido.correo);
    if (extraido.password) setProvPass(extraido.password);
    if (extraido.perfil) setProvPerfil(extraido.perfil);
    if (extraido.pin) setProvPin(extraido.pin);
    notificar("Datos extraídos para la renovación");
  };

  const pegarPortapapelesRenovacion = async () => {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) procesarTextoRenovacion(texto);
    } catch {
      notificar("Pega el mensaje directamente en el recuadro", "error");
    }
  };

  const confirmarRenovacion = async (e) => {
    e.preventDefault();
    if (precioRenovacion === "" || Number(precioRenovacion) < 0) {
      return notificar("Ingresa el precio de renovación", "error");
    }

    const diasSumar = Number(mesesRenovacion) * 30;
    const hoy = new Date();
    const corteActual = new Date(subRenovar.fecha_corte + "T12:00:00");
    const baseFecha = corteActual > hoy ? corteActual : hoy;
    baseFecha.setDate(baseFecha.getDate() + diasSumar);
    const nuevaFechaCorte = baseFecha.toISOString().split("T")[0];

    let datosUpdate = {
      precio_venta: Number(precioRenovacion),
      meses_contratados: Number(mesesRenovacion),
      dias_totales: diasSumar,
      fecha_corte: nuevaFechaCorte,
      avisado_renovacion: false,
      estado: "Activa"
    };

    if (origenRenovacion === "otra_matriz") {
      const mat = matrices.find((m) => m.id === nuevaMatrizId);
      if (!mat) return notificar("Selecciona la matriz de stock", "error");
      const libres = (mat.perfiles_matriz || []).filter((p) => !p.ocupado);
      libres.sort((a, b) => (a.es_extra_final !== b.es_extra_final ? (a.es_extra_final ? 1 : -1) : a.numero_slot - b.numero_slot));
      const slot = libres[0];
      if (!slot) return notificar("Esa matriz no tiene cupos libres", "error");

      if (subRenovar.perfil_id) {
        await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subRenovar.perfil_id);
      }
      await supabase.from("perfiles_matriz").update({ ocupado: true }).eq("id", slot.id);

      datosUpdate = {
        ...datosUpdate,
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
    } else if (origenRenovacion === "proveedor") {
      if (!provCorreo.trim()) {
        return notificar("Ingresa al menos el correo de la cuenta", "error");
      }
      if (subRenovar.perfil_id) {
        await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subRenovar.perfil_id);
      }
      const provObj = proveedores.find((p) => p.id === proveedorRenovId);
      datosUpdate = {
        ...datosUpdate,
        origen: "proveedor",
        matriz_id: null,
        perfil_id: null,
        proveedor_id: provObj ? provObj.id : subRenovar.proveedor_id,
        nombre_proveedor: provObj ? provObj.nombre : subRenovar.nombre_proveedor,
        telefono_proveedor: provObj ? provObj.telefono : subRenovar.telefono_proveedor,
        correo_cuenta: provCorreo.trim(),
        password_cuenta: provPass.trim(),
        nombre_perfil: provPerfil.trim() || "Cuenta / Invitación",
        pin_perfil: provPin.trim(),
        costo_proveedor: Number(costoProv || 0)
      };
    }

    await supabase.from("suscripciones").update(datosUpdate).eq("id", subRenovar.id);

    await supabase.from("movimientos_yolo").insert([{
      tipo: "Renovacion",
      monto: Math.abs(Number(precioRenovacion)),
      afecta_ganancia_neta: true,
      descripcion: `Renovación ${subRenovar.plataforma} - ${subRenovar.nombre_cliente}`,
      referencia_id: subRenovar.id
    }]);

    if (origenRenovacion === "proveedor" && Number(costoProv) > 0) {
      await supabase.from("movimientos_yolo").insert([{
        tipo: "Costo Proveedor",
        monto: -Math.abs(Number(costoProv)),
        afecta_ganancia_neta: true,
        descripcion: `Costo proveedor renovación ${subRenovar.plataforma} (${subRenovar.nombre_cliente})`,
        referencia_id: subRenovar.id
      }]);
    }

    setSubRenovar(null);
    await recargarTodo();
    notificar(`¡Suscripción renovada hasta el ${formatearFechaDMA(nuevaFechaCorte)}!`);
  };

  const listaMostrar = subTab === "por_avisar" ? listaPorAvisar : listaAvisados;

  return (
    <div className="space-y-5">
      {/* SUB-PESTAÑAS */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSubTab("por_avisar")}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
            subTab === "por_avisar"
              ? "bg-[#66FF00] text-black border-[#66FF00]"
              : "bg-[#111A10] text-gray-300 border-[#233820]"
          }`}
        >
          Por Avisar ({listaPorAvisar.length})
        </button>

        <button
          onClick={() => setSubTab("avisados")}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
            subTab === "avisados"
              ? "bg-[#66FF00] text-black border-[#66FF00]"
              : "bg-[#111A10] text-gray-300 border-[#233820]"
          }`}
        >
          Ya Avisados ({listaAvisados.length})
        </button>

        <button
          onClick={() => setSubTab("matrices")}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
            subTab === "matrices"
              ? "bg-yellow-400 text-black border-yellow-400"
              : "bg-[#111A10] text-yellow-400 border-yellow-600/40"
          }`}
        >
          Matrices por Vencer ({matricesPorVencer.length})
        </button>
      </div>

      {/* VISTA DE MATRICES POR VENCER */}
      {subTab === "matrices" ? (
        <div className="space-y-3">
          {matricesPorVencer.length === 0 ? (
            <p className="text-sm text-gray-400 bg-[#111A10] p-6 rounded-2xl border border-[#233820] text-center">
              Ninguna matriz tuya vence en los próximos 3 días.
            </p>
          ) : (
            matricesPorVencer.map((m) => {
              const dias = calcularDias(m.fecha_corte_matriz);
              return (
                <div
                  key={m.id}
                  className="bg-[#111A10] border border-yellow-500/70 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3"
                >
                  <div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                      {m.plataforma}
                    </span>
                    {m.nombre_proveedor && (
                      <span className="ml-2 text-xs text-gray-300">
                        Prov: <b>{m.nombre_proveedor}</b> ({m.telefono_proveedor})
                      </span>
                    )}
                    <p className="font-bold mt-1">{m.correo}</p>
                    <p className="text-xs text-gray-400">
                      Clave: {m.password} · Corte: {formatearFechaDMA(m.fecha_corte_matriz)} · Costo: Bs {m.costo_total}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-yellow-400">
                      {dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `Vence en ${dias} día(s)`}
                    </span>

                    {confirmandoRenovarMatrizId === m.id ? (
                      <div className="flex items-center gap-1.5 bg-[#070B06] border border-[#66FF00] px-2.5 py-1.5 rounded-xl">
                        <span className="text-[11px] text-gray-200 font-bold">¿Descontar Bs {m.costo_total}?</span>
                        <button
                          onClick={() => ejecutarRenovarMatriz30Dias(m)}
                          className="px-2.5 py-1 bg-[#66FF00] text-black text-xs font-black rounded-lg cursor-pointer"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => setConfirmandoRenovarMatrizId(null)}
                          className="px-2 py-1 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoRenovarMatrizId(m.id)}
                        className="px-3 py-2 bg-[#66FF00] text-black text-xs font-extrabold rounded-xl cursor-pointer"
                      >
                        Renovar Matriz (+30d)
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* LISTA DE CLIENTES POR VENCER (CON FECHA EN FORMATO DÍA/MES/AÑO) */
        <div className="space-y-3">
          {listaMostrar.length === 0 ? (
            <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-8 text-center text-gray-400 text-sm">
              No hay clientes pendientes en esta bandeja.
            </div>
          ) : (
            listaMostrar.map((s) => {
              const dias = calcularDias(s.fecha_corte);
              const fechaCorteDMA = formatearFechaDMA(s.fecha_corte);
              const textoDias =
                dias < 0
                  ? `Venció hace ${Math.abs(dias)} día(s)`
                  : dias === 0
                  ? "¡Vence HOY!"
                  : `Vence en ${dias} día(s)`;

              const lineaPerfil =
                s.nombre_perfil && s.nombre_perfil !== "Cuenta / Invitación"
                  ? `\n👤 *Perfil:* ${s.nombre_perfil}`
                  : "";

              const msgLargo = `🌿 *RECORDATORIO MOSS STREAMING*\n\n¡Hola *${s.nombre_cliente}*! Te recordamos que tu suscripción de *${s.plataforma}* está próxima a vencer:\n\n📧 *Cuenta:* ${s.correo_cuenta}${lineaPerfil}\n📅 *Fecha de corte:* ${fechaCorteDMA} (${textoDias})\n💰 *Valor renovación:* Bs ${s.precio_venta}\n\n¿Deseas renovar para mantener tu acceso activo? ¡Quedamos atentos!`;

              const msgResumido = `*Recordatorio ${s.plataforma} (MOSS)*\n📧 Correo: ${s.correo_cuenta}${
                s.password_cuenta ? `\n🔑 Clave: ${s.password_cuenta}` : ""
              }${lineaPerfil}\n📅 Corte: ${fechaCorteDMA} (${textoDias})\n¿Deseas renovar?`;

              return (
                <div key={s.id} className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div>
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-[#66FF00]/20 text-[#66FF00]">
                        {s.plataforma}
                      </span>
                      <span className="ml-2 text-xs font-bold text-orange-400">{textoDias}</span>
                      {s.nombre_proveedor && (
                        <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                          Prov: {s.nombre_proveedor}
                        </span>
                      )}
                      <h3 className="font-bold text-base mt-1">
                        {s.nombre_cliente} — <span className="text-[#66FF00] font-mono">{s.telefono_cliente}</span>
                      </h3>
                      <p className="text-xs text-gray-400">
                        Cuenta: {s.correo_cuenta} · Corte: <b className="text-white">{fechaCorteDMA}</b> · Bs {s.precio_venta}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(s.telefono_cliente);
                          notificar(`Número ${s.telefono_cliente} copiado`);
                        }}
                        className="px-2.5 py-1.5 bg-[#1A2B18] hover:bg-[#253D22] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#66FF00]" /> Copiar Número
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msgLargo);
                          notificar("Recordatorio copiado al portapapeles");
                        }}
                        className="px-2.5 py-1.5 bg-[#1A2B18] hover:bg-[#253D22] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#66FF00]" /> Copiar Mensaje (PC)
                      </button>

                      <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({ text: msgResumido });
                          } else {
                            navigator.clipboard.writeText(msgResumido);
                            notificar("Recordatorio resumido copiado");
                          }
                        }}
                        className="px-2.5 py-1.5 bg-[#66FF00] text-black rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Compartir Resumido (Celular)
                      </button>

                      <a
                        href={`https://wa.me/${s.telefono_cliente.replace(/\D/g, "")}?text=${encodeURIComponent(msgLargo)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-xl text-xs font-bold"
                      >
                        WhatsApp Directo
                      </a>
                    </div>
                  </div>

                  {/* ACCIONES */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1E331A]">
                    <button
                      onClick={() => marcarComoAvisado(s, !s.avisado_renovacion)}
                      className="px-3 py-1.5 bg-[#162614] border border-[#66FF00]/40 text-[#66FF00] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {s.avisado_renovacion ? "Mover a Por Avisar" : "Ya le avisé"}
                    </button>

                    <button
                      onClick={() => abrirModalRenovar(s)}
                      className="px-3 py-1.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Renovar Suscripción
                    </button>

                    {confirmandoNoRenuevaId === s.id ? (
                      <div className="ml-auto flex items-center gap-1.5 bg-red-950/90 border border-red-500 px-3 py-1 rounded-xl">
                        <span className="text-[11px] text-red-200 font-bold">¿Liberar perfil?</span>
                        <button
                          onClick={() => ejecutarNoVaARenovar(s)}
                          className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-extrabold cursor-pointer"
                        >
                          Sí, liberar
                        </button>
                        <button
                          onClick={() => setConfirmandoNoRenuevaId(null)}
                          className="px-2 py-1 bg-gray-800 text-gray-300 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoNoRenuevaId(s.id)}
                        className="px-3 py-1.5 bg-red-950/70 text-red-300 border border-red-800/50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ml-auto"
                      >
                        <XCircle className="w-3.5 h-3.5" /> No va a renovar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VENTANA EMERGENTE: RENOVAR SUSCRIPCIÓN */}
      {subRenovar && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={confirmarRenovacion}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-[0_0_50px_rgba(102,255,0,0.3)] animate-modal"
          >
            <div className="flex justify-between items-center border-b border-[#233820] pb-2.5">
              <h3 className="font-black text-[#66FF00] text-base">
                Renovar a {subRenovar.nombre_cliente} ({subRenovar.plataforma})
              </h3>
              <button
                type="button"
                onClick={() => setSubRenovar(null)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Precio Renovación (Bs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={precioRenovacion}
                  onChange={(e) => setPrecioRenovacion(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-white font-bold"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Meses (+30d c/u)</label>
                <input
                  type="number"
                  min="1"
                  value={mesesRenovacion}
                  onChange={(e) => setMesesRenovacion(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400">¿Dónde renovará?</label>
              <select
                value={origenRenovacion}
                onChange={(e) => setOrigenRenovacion(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
              >
                <option value="misma">Mantener en la misma cuenta / matriz actual</option>
                <option value="otra_matriz">Cambiar a otra Matriz de mi Stock</option>
                <option value="proveedor">Asignar cuenta nueva de Proveedor</option>
              </select>
            </div>

            {origenRenovacion === "otra_matriz" && (
              <div>
                <label className="text-xs text-gray-400">Seleccionar Matriz de Stock</label>
                <select
                  value={nuevaMatrizId}
                  onChange={(e) => setNuevaMatrizId(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="">-- Elige matriz --</option>
                  {matrices
                    .filter((m) => !m.en_papelera && m.estado === "Activa")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.plataforma} - {m.correo} ({(m.perfiles_matriz || []).filter((p) => !p.ocupado).length} libres)
                      </option>
                    ))}
                </select>
              </div>
            )}

            {origenRenovacion === "proveedor" && (
              <div className="space-y-3 bg-[#0B120A] border border-[#233820] rounded-2xl p-3">
                <div>
                  <label className="text-[11px] text-[#66FF00] font-bold flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Proveedor
                  </label>
                  <select
                    value={proveedorRenovId}
                    onChange={(e) => setProveedorRenovId(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                  >
                    <option value="">-- Sin proveedor --</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — 📞 {p.telefono}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-[#66FF00] font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Pegar Mensaje Proveedor
                    </span>
                    <button
                      type="button"
                      onClick={pegarPortapapelesRenovacion}
                      className="px-2 py-0.5 bg-[#66FF00] text-black rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ClipboardPaste className="w-3 h-3" /> Pegar
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Pega el mensaje del proveedor aquí..."
                    value={textoProveedorCrudo}
                    onChange={(e) => procesarTextoRenovacion(e.target.value)}
                    className="w-full bg-[#070B06] border border-[#233820] rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Correo *"
                    value={provCorreo}
                    onChange={(e) => setProvCorreo(e.target.value)}
                    className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Contraseña (Opc.)"
                    value={provPass}
                    onChange={(e) => setProvPass(e.target.value)}
                    className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Perfil (Opc.)"
                    value={provPerfil}
                    onChange={(e) => setProvPerfil(e.target.value)}
                    className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Costo Proveedor (Bs)"
                    value={costoProv}
                    onChange={(e) => setCostoProv(e.target.value)}
                    className="bg-[#070B06] border border-orange-500/40 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubRenovar(null)}
                className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer"
              >
                Confirmar Renovación
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}