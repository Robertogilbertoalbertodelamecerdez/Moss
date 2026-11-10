"use client";
import React, { useState } from "react";
import {
  supabase,
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  sumarDiasBoliviaISO
} from "@/config";
import {
  generarMensajeRenovacionCorto,
  generarMensajeLoteRenovacionRevendedor,
  enviarWhatsappDirecto
} from "@/utils/mensajesMoss";
import {
  Copy,
  Share2,
  Check,
  RefreshCw,
  XCircle,
  X,
  Users,
  Truck,
  Send
} from "lucide-react";

export default function ModuloRenovaciones({
  suscripciones = [],
  matrices = [],
  proveedores = [],
  revendedores = [],
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
  const [provCorreo, setProvCorreo] = useState("");
  const [provPass, setProvPass] = useState("");
  const [provPerfil, setProvPerfil] = useState("");
  const [costoProv, setCostoProv] = useState("");

  const hoyISO = obtenerFechaBoliviaISO();

  const calcularDias = (fechaCorte) => {
    if (!fechaCorte) return 999;
    const hoy = new Date(hoyISO + "T00:00:00-04:00");
    const corte = new Date(fechaCorte + "T00:00:00-04:00");
    return Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
  };

  const subsPorVencer = suscripciones.filter((s) => {
    if (s.en_papelera || s.estado !== "Activa") return false;
    return calcularDias(s.fecha_corte) <= 3;
  });

  // =========================================================================
  // ALERTAS DE PAGO A PROVEEDOR (PLANES LARGOS DONDE PAGASTE MENOS MESES)
  // =========================================================================
  const subsProveedorPorRenovar = suscripciones.filter((s) => {
    if (s.en_papelera || s.estado !== "Activa") return false;
    if (!s.fecha_renovacion_proveedor) return false;
    // Solo si el plan del cliente sigue vigente más allá del pago actual al proveedor
    if (s.fecha_renovacion_proveedor >= s.fecha_corte) return false;
    return calcularDias(s.fecha_renovacion_proveedor) <= 3;
  });

  const listaPorAvisar = subsPorVencer.filter((s) => !s.avisado_renovacion);
  const listaAvisados = subsPorVencer.filter((s) => s.avisado_renovacion);
  const matricesPorVencer = matrices.filter(
    (m) => !m.en_papelera && m.estado === "Activa" && calcularDias(m.fecha_corte_matriz) <= 3
  );

  const lotesPorRevendedor = revendedores
    .map((r) => {
      const cuentasDeEsteRev = subsPorVencer.filter(
        (s) =>
          s.tipo_comprador === "revendedor" &&
          (s.revendedor_id === r.id || s.telefono_cliente === r.telefono)
      );
      return { revendedor: r, cuentas: cuentasDeEsteRev };
    })
    .filter((grupo) => grupo.cuentas.length > 0);

  // Cuando ya le pagaste el siguiente mes (o X meses) al proveedor para que el cliente siga con su plan largo
  const avanzarCicloProveedor = async (sub, mesesAgregar = null) => {
    const intervalo = Number(mesesAgregar || sub.cada_cuantos_meses_avisar_prov || 1);
    const baseFecha =
      sub.fecha_renovacion_proveedor > hoyISO ? sub.fecha_renovacion_proveedor : hoyISO;
    const nuevaFechaProv = sumarDiasBoliviaISO(intervalo * 30, baseFecha);
    const nuevosMesesPagados = Number(sub.meses_pagados_proveedor || 1) + intervalo;

    await supabase
      .from("suscripciones")
      .update({
        meses_pagados_proveedor: nuevosMesesPagados,
        fecha_renovacion_proveedor:
          nuevaFechaProv > sub.fecha_corte ? sub.fecha_corte : nuevaFechaProv
      })
      .eq("id", sub.id);

    await recargarTodo();
    notificar(
      `¡Ciclo de proveedor avanzado +${intervalo}M! Próximo aviso: ${formatearFechaDMA(nuevaFechaProv)}`
    );
  };

  const marcarComoAvisado = async (sub, estadoBool) => {
    await supabase.from("suscripciones").update({ avisado_renovacion: estadoBool }).eq("id", sub.id);
    await recargarTodo();
    notificar(estadoBool ? "Movido a Ya Avisados" : "Devuelto a Por Avisar");
  };

  const ejecutarNoVaARenovar = async (sub) => {
    if (sub.perfil_id) {
      await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", sub.perfil_id);
    }
    await supabase.from("suscripciones").update({ estado: "No Renovo", perfil_id: null }).eq("id", sub.id);
    setConfirmandoNoRenuevaId(null);
    await recargarTodo();
    notificar("Perfil liberado del stock");
  };

  const ejecutarRenovarMatriz30Dias = async (m) => {
    const nuevaFecha = sumarDiasBoliviaISO(30, m.fecha_corte_matriz);
    await supabase
      .from("matrices_stock")
      .update({ fecha_corte_matriz: nuevaFecha })
      .eq("id", m.id);
    if (Number(m.costo_total) > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          tipo: "Costo Matriz",
          monto: -Math.abs(Number(m.costo_total)),
          afecta_ganancia_neta: true,
          descripcion: `Renovación matriz ${m.plataforma} (${m.correo})`,
          referencia_id: m.id
        }
      ]);
    }
    setConfirmandoRenovarMatrizId(null);
    await recargarTodo();
    notificar("Matriz renovada +30 días");
  };

  const abrirModalRenovar = (sub) => {
    setSubRenovar(sub);
    setPrecioRenovacion(sub.precio_venta);
    setMesesRenovacion(1);
    setOrigenRenovacion("misma");
    setProvCorreo(sub.correo_cuenta);
    setProvPass(sub.password_cuenta || "");
    setProvPerfil(sub.nombre_perfil || "");
    setCostoProv("0");
  };

  const confirmarRenovacion = async (e) => {
    e.preventDefault();
    const diasSumar = Number(mesesRenovacion) === 12 ? 365 : Number(mesesRenovacion) * 30;
    const baseFecha =
      subRenovar.fecha_corte > hoyISO ? subRenovar.fecha_corte : hoyISO;
    const nuevaFechaCorte = sumarDiasBoliviaISO(diasSumar, baseFecha);

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
      if (!mat) return notificar("Selecciona matriz", "error");
      const libres = (mat.perfiles_matriz || []).filter((p) => !p.ocupado && !p.caido);
      const slot = libres[0];
      if (!slot) return notificar("Sin cupos libres", "error");
      if (subRenovar.perfil_id) await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subRenovar.perfil_id);
      await supabase.from("perfiles_matriz").update({ ocupado: true }).eq("id", slot.id);
      datosUpdate = {
        ...datosUpdate,
        origen: "stock",
        matriz_id: mat.id,
        perfil_id: slot.id,
        correo_cuenta: mat.correo,
        password_cuenta: mat.password,
        nombre_perfil: slot.nombre_perfil,
        pin_perfil: slot.pin
      };
    } else if (origenRenovacion === "proveedor") {
      if (subRenovar.perfil_id) await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subRenovar.perfil_id);
      datosUpdate = {
        ...datosUpdate,
        origen: "proveedor",
        matriz_id: null,
        perfil_id: null,
        correo_cuenta: provCorreo.trim(),
        password_cuenta: provPass.trim(),
        nombre_perfil: provPerfil.trim() || "1 Dispositivo",
        costo_proveedor: Number(costoProv || 0)
      };
    }

    await supabase.from("suscripciones").update(datosUpdate).eq("id", subRenovar.id);
    await supabase.from("movimientos_yolo").insert([
      {
        tipo: "Renovacion",
        monto: Math.abs(Number(precioRenovacion)),
        afecta_ganancia_neta: true,
        descripcion: `Renovación ${subRenovar.plataforma} - ${subRenovar.nombre_cliente}`,
        referencia_id: subRenovar.id
      }
    ]);

    setSubRenovar(null);
    await recargarTodo();
    notificar(`Renovado hasta ${formatearFechaDMA(nuevaFechaCorte)}`);
  };

  const listaMostrar = subTab === "por_avisar" ? listaPorAvisar : listaAvisados;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSubTab("por_avisar")}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
            subTab === "por_avisar" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#111A10] text-gray-300 border-[#233820]"
          }`}
        >
          Por Avisar ({listaPorAvisar.length})
        </button>

        <button
          onClick={() => setSubTab("lote_revendedores")}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 cursor-pointer ${
            subTab === "lote_revendedores"
              ? "bg-purple-500 text-white border-purple-400"
              : "bg-[#111A10] text-purple-300 border-purple-600/40"
          }`}
        >
          <Users className="w-4 h-4" /> Lote por Revendedor ({lotesPorRevendedor.length})
        </button>

        <button
          onClick={() => setSubTab("proveedores_largos")}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 cursor-pointer ${
            subTab === "proveedores_largos"
              ? "bg-amber-400 text-black border-amber-400"
              : "bg-[#111A10] text-amber-300 border-amber-500/50"
          }`}
        >
          <Truck className="w-4 h-4" /> Pagos a Proveedor Planes Largos ({subsProveedorPorRenovar.length})
        </button>

        <button
          onClick={() => setSubTab("avisados")}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
            subTab === "avisados" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#111A10] text-gray-300 border-[#233820]"
          }`}
        >
          Ya Avisados ({listaAvisados.length})
        </button>

        <button
          onClick={() => setSubTab("matrices")}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
            subTab === "matrices" ? "bg-yellow-400 text-black border-yellow-400" : "bg-[#111A10] text-yellow-400 border-yellow-600/40"
          }`}
        >
          Matrices por Vencer ({matricesPorVencer.length})
        </button>
      </div>

      {/* PESTAÑA DE ALERTAS DE PROVEEDOR (PLANES DE 3M / 6M / 1 AÑO PAGADOS MES A MES) */}
      {subTab === "proveedores_largos" ? (
        <div className="space-y-3">
          {subsProveedorPorRenovar.length === 0 ? (
            <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-8 text-center text-gray-400 text-xs">
              No tienes pagos intermedios a proveedores que venzan en los próximos 3 días.
            </div>
          ) : (
            subsProveedorPorRenovar.map((s) => {
              const diasProv = calcularDias(s.fecha_renovacion_proveedor);
              const diasTot = s.dias_totales || Number(s.meses_contratados || 1) * 30;
              return (
                <div
                  key={s.id}
                  className="bg-[#111A10] border-2 border-amber-400/70 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-amber-400 text-black">
                        📦 {s.plataforma} · Prov: {s.nombre_proveedor || "Proveedor"}
                      </span>
                      <span className="text-xs font-bold text-red-400">
                        {diasProv < 0
                          ? `Venció con proveedor hace ${Math.abs(diasProv)}d`
                          : diasProv === 0
                          ? "¡Toca pagar hoy al proveedor!"
                          : `Faltan ${diasProv}d para pagar al proveedor`}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white">
                      Cliente: {s.nombre_cliente} (📞 {s.telefono_cliente}) · Correo:{" "}
                      <span className="text-[#66FF00] font-mono">{s.correo_cuenta}</span>
                    </p>
                    <p className="text-xs text-gray-300">
                      El cliente pagó <b>{diasTot} días</b> (Vence el {formatearFechaDMA(s.fecha_corte)}), pero al proveedor le pagaste{" "}
                      <b className="text-amber-300">{s.meses_pagados_proveedor || 1} mes(es)</b> (Vence el{" "}
                      <b>{formatearFechaDMA(s.fecha_renovacion_proveedor)}</b>).
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => avanzarCicloProveedor(s, 1)}
                      className="px-3.5 py-2 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer"
                    >
                      ✅ Ya pagué +1 Mes al Proveedor (+30d)
                    </button>
                    <button
                      onClick={() => avanzarCicloProveedor(s, 3)}
                      className="px-3.5 py-2 bg-amber-400 text-black font-black rounded-xl text-xs cursor-pointer"
                    >
                      ✅ Ya pagué +3 Meses (+90d)
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : subTab === "lote_revendedores" ? (
        <div className="space-y-4">
          {lotesPorRevendedor.length === 0 ? (
            <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-8 text-center text-gray-400 text-xs">
              Ningún revendedor tiene cuentas próximas a vencer en los siguientes 3 días.
            </div>
          ) : (
            lotesPorRevendedor.map(({ revendedor: rev, cuentas }) => {
              const msgLote = generarMensajeLoteRenovacionRevendedor(rev.nombre, cuentas);
              return (
                <div key={rev.id} className="bg-[#111A10] border-2 border-purple-500/60 rounded-3xl p-5 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-purple-950 text-purple-300 border border-purple-500/40">
                        🤝 Revendedor: {rev.nombre} (📞 {rev.telefono})
                      </span>
                      <h3 className="text-base font-black text-white mt-1">
                        Tiene {cuentas.length} cuenta(s) por vencer
                      </h3>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msgLote);
                          notificar(`¡Lista de ${cuentas.length} cuentas copiada!`);
                        }}
                        className="px-4 py-2.5 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/50 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-4 h-4" /> Copiar Lote
                      </button>

                      <button
                        onClick={() => enviarWhatsappDirecto(rev.telefono, msgLote)}
                        className="px-4 py-2.5 bg-[#66FF00] text-black font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-4 h-4" /> 📲 Enviar Lote a su WhatsApp
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#1E331A]">
                    {cuentas.map((c, i) => (
                      <div key={c.id} className="bg-[#070B06] border border-[#1E331A] rounded-xl p-2.5 text-xs">
                        <p className="font-bold text-[#66FF00]">
                          #{i + 1} {c.plataforma} — Cliente: {c.nombre_cliente_final || "Sin anotar"} (📞 {c.telefono_cliente_final || "S/N"})
                        </p>
                        <p className="text-gray-300 font-mono text-[11px]">{c.correo_cuenta} ({c.nombre_perfil})</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : subTab === "matrices" ? (
        <div className="space-y-3">
          {matricesPorVencer.map((m) => (
            <div key={m.id} className="bg-[#111A10] border border-yellow-500/70 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">{m.plataforma}</span>
                <p className="font-bold mt-1">{m.correo}</p>
                <p className="text-xs text-gray-400">Corte: {formatearFechaDMA(m.fecha_corte_matriz)}</p>
              </div>
              {confirmandoRenovarMatrizId === m.id ? (
                <div className="flex gap-1.5">
                  <button onClick={() => ejecutarRenovarMatriz30Dias(m)} className="px-3 py-1 bg-[#66FF00] text-black text-xs font-black rounded-lg">Confirmar</button>
                  <button onClick={() => setConfirmandoRenovarMatrizId(null)} className="px-2 py-1 bg-gray-800 text-xs rounded-lg">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmandoRenovarMatrizId(m.id)} className="px-3 py-2 bg-[#66FF00] text-black text-xs font-extrabold rounded-xl cursor-pointer">
                  Renovar Matriz (+30d)
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {listaMostrar.length === 0 ? (
            <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-8 text-center text-gray-400 text-sm">
              No hay clientes pendientes en esta bandeja.
            </div>
          ) : (
            listaMostrar.map((s) => {
              const dias = calcularDias(s.fecha_corte);
              const textoDias = dias < 0 ? `Venció hace ${Math.abs(dias)}d` : dias === 0 ? "¡Vence HOY!" : `Vence en ${dias}d`;
              const msgCorto = generarMensajeRenovacionCorto(s, textoDias);

              return (
                <div key={s.id} className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div>
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-[#66FF00]/20 text-[#66FF00]">{s.plataforma}</span>
                      <span className="ml-2 text-xs font-bold text-orange-400">{textoDias}</span>
                      <h3 className="font-bold text-base mt-1">
                        {s.nombre_cliente} — <span className="text-[#66FF00] font-mono">{s.telefono_cliente}</span>
                      </h3>
                      <p className="text-xs text-gray-300">
                        Cuenta: <b className="text-white">{s.correo_cuenta}</b> ({s.nombre_perfil}) · Corte: {formatearFechaDMA(s.fecha_corte)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msgCorto);
                          notificar("Aviso corto de renovación copiado");
                        }}
                        className="px-3 py-1.5 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/40 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copiar Aviso
                      </button>

                      <button
                        onClick={() => enviarWhatsappDirecto(s.telefono_cliente, msgCorto)}
                        className="px-3 py-1.5 bg-[#66FF00] text-black rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> 📲 Enviar a WhatsApp
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1E331A]">
                    <button
                      onClick={() => marcarComoAvisado(s, !s.avisado_renovacion)}
                      className="px-3 py-1.5 bg-[#162614] border border-[#66FF00]/40 text-[#66FF00] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> {s.avisado_renovacion ? "Mover a Por Avisar" : "Ya le avisé"}
                    </button>

                    <button
                      onClick={() => abrirModalRenovar(s)}
                      className="px-3 py-1.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Renovar
                    </button>

                    {confirmandoNoRenuevaId === s.id ? (
                      <div className="ml-auto flex gap-1.5">
                        <button onClick={() => ejecutarNoVaARenovar(s)} className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold">Sí, liberar</button>
                        <button onClick={() => setConfirmandoNoRenuevaId(null)} className="px-2 py-1 bg-gray-800 text-xs rounded-lg">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoNoRenuevaId(s.id)}
                        className="ml-auto px-3 py-1.5 bg-red-950/70 text-red-300 border border-red-800/50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
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

      {subRenovar && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <form onSubmit={confirmarRenovacion} className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00]">Renovar a {subRenovar.nombre_cliente}</h3>
              <button type="button" onClick={() => setSubRenovar(null)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.01" value={precioRenovacion} onChange={(e) => setPrecioRenovacion(e.target.value)} className="bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-white font-bold text-xs" placeholder="Precio Bs" />
              <select value={mesesRenovacion} onChange={(e) => setMesesRenovacion(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs">
                <option value={1}>1 Mes (+30d)</option>
                <option value={2}>2 Meses (+60d)</option>
                <option value={3}>3 Meses (+90d)</option>
                <option value={12}>1 Año (+365d)</option>
              </select>
            </div>
            <select value={origenRenovacion} onChange={(e) => setOrigenRenovacion(e.target.value)} className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white">
              <option value="misma">Mantener en la cuenta actual ({subRenovar.correo_cuenta})</option>
              <option value="otra_matriz">Cambiar a otra Matriz de mi Stock</option>
              <option value="proveedor">Asignar cuenta nueva de Proveedor</option>
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSubRenovar(null)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="submit" className="flex-1 py-2 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">Confirmar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}