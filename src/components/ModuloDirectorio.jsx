"use client";
import React, { useState } from "react";
import {
  supabase,
  PLATAFORMAS,
  formatearFechaDMA,
  sumarDiasBoliviaISO
} from "@/config";
import { extraerDatosProveedor } from "@/utils/extractorProveedor";
import { generarMensajeEntrega, enviarWhatsappDirecto } from "@/utils/mensajesMoss";
import {
  Search,
  AlertTriangle,
  RefreshCcw,
  DollarSign,
  Trash2,
  RotateCcw,
  Edit3,
  Truck,
  Layers,
  X,
  MessageSquare,
  Copy,
  CheckCircle2,
  Send,
  Sparkles
} from "lucide-react";

export default function ModuloDirectorio({
  suscripciones = [],
  matrices = [],
  clientes = [],
  proveedores = [],
  revendedores = [],
  linkWhatsappMoss = "",
  plataformasList = PLATAFORMAS,
  recargarTodo,
  notificar
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState("Todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroRevendedorId, setFiltroRevendedorId] = useState("todos");

  const [mensajeActivo, setMensajeActivo] = useState(null);

  const [subReemplazo, setSubReemplazo] = useState(null);
  const [origenReemp, setOrigenReemp] = useState("proveedor");
  const [matrizReempId, setMatrizReempId] = useState("");
  const [provReempId, setProvReempId] = useState("");
  const [textoCrudoReemp, setTextoCrudoReemp] = useState("");
  const [correoReemp, setCorreoReemp] = useState("");
  const [passReemp, setPassReemp] = useState("");
  const [perfilReemp, setPerfilReemp] = useState("");
  const [pinReemp, setPinReemp] = useState("");
  const [costoReemp, setCostoReemp] = useState(0);

  const [subReembolso, setSubReembolso] = useState(null);
  const [montoReembolsoCalc, setMontoReembolsoCalc] = useState(0);

  const [subEditar, setSubEditar] = useState(null);
  const [matrizNuevaEdicionId, setMatrizNuevaEdicionId] = useState("");

  const calcularDiasRestantes = (fechaCorte) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const corte = new Date(fechaCorte + "T00:00:00");
    return Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
  };

  // Si la cuenta tiene fue_reemplazada === true, abre siempre con el título "REEMPLAZO DE CUENTA"
  const abrirMensajeDeSuscripcion = (s, tituloForzado = null) => {
    const tituloUsar =
      tituloForzado !== null
        ? tituloForzado
        : s.fue_reemplazada
        ? "REEMPLAZO DE CUENTA"
        : null;

    const msg = generarMensajeEntrega(
      s.nombre_cliente,
      s.telefono_cliente,
      [
        {
          plataforma: s.plataforma,
          tipoCuenta: s.tipo_cuenta || "1 Dispositivo",
          correoFinal: s.correo_cuenta,
          passFinal: s.password_cuenta,
          perfilFinal: s.nombre_perfil,
          pinFinal: s.pin_perfil,
          meses: s.meses_contratados || 1,
          diasTotales: s.dias_totales || Number(s.meses_contratados || 1) * 30,
          fechaCorte: s.fecha_corte,
          precioVenta: s.precio_venta
        }
      ],
      linkWhatsappMoss,
      tituloUsar,
      s.tipo_comprador === "revendedor"
    );
    setMensajeActivo(msg);
  };

  const abrirModalReemplazo = (s) => {
    const matricesMismaPlat = matrices.filter(
      (m) =>
        !m.en_papelera &&
        m.estado === "Activa" &&
        m.plataforma === s.plataforma &&
        (m.perfiles_matriz || []).some((p) => !p.ocupado && !p.caido)
    );
    const tieneStock = matricesMismaPlat.length > 0;

    setSubReemplazo(s);
    setOrigenReemp(tieneStock ? "stock" : "proveedor");
    setMatrizReempId(matricesMismaPlat[0]?.id || "");
    setProvReempId(s.proveedor_id || proveedores[0]?.id || "");
    setTextoCrudoReemp("");
    setCorreoReemp("");
    setPassReemp("");
    setPerfilReemp(s.nombre_perfil || "1 Dispositivo");
    setPinReemp("");
    setCostoReemp(0);
  };

  const procesarTextoProveedorReemplazo = (texto) => {
    setTextoCrudoReemp(texto);
    const ext = extraerDatosProveedor(texto, plataformasList);
    if (ext.correo) setCorreoReemp(ext.correo);
    if (ext.password) setPassReemp(ext.password);
    if (ext.perfil) setPerfilReemp(ext.perfil);
    if (ext.pin) setPinReemp(ext.pin);
    notificar("Datos extraídos para el reemplazo");
  };

  const ejecutarReemplazo = async (e) => {
    e.preventDefault();
    if (!subReemplazo) return;

    const estabaCaida = subReemplazo.estado === "Caida";
    let nuevosDatos = {
      estado: "Activa",
      fue_reemplazada: true,
      fecha_corte: subReemplazo.fecha_corte,
      fecha_venta: subReemplazo.fecha_venta,
      dias_totales: subReemplazo.dias_totales,
      meses_contratados: subReemplazo.meses_contratados,
      precio_venta: subReemplazo.precio_venta,
      nombre_cliente: subReemplazo.nombre_cliente,
      telefono_cliente: subReemplazo.telefono_cliente,
      nombre_cliente_final: subReemplazo.nombre_cliente_final,
      telefono_cliente_final: subReemplazo.telefono_cliente_final
    };

    if (origenReemp === "stock") {
      const mat = matrices.find((m) => m.id === matrizReempId);
      if (!mat) return notificar("Selecciona una matriz con espacio libre", "error");
      const libres = (mat.perfiles_matriz || [])
        .filter((p) => !p.ocupado && !p.caido)
        .sort((a, b) => (a.es_extra_final !== b.es_extra_final ? (a.es_extra_final ? 1 : -1) : a.numero_slot - b.numero_slot));

      const slot = libres[0];
      if (!slot) return notificar("Esa matriz no tiene perfiles libres", "error");

      if (subReemplazo.perfil_id) {
        await supabase
          .from("perfiles_matriz")
          .update({ ocupado: false, caido: estabaCaida ? true : false })
          .eq("id", subReemplazo.perfil_id);
      }
      await supabase.from("perfiles_matriz").update({ ocupado: true, caido: false }).eq("id", slot.id);

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
      if (!correoReemp.trim()) return notificar("Ingresa el nuevo correo de reemplazo", "error");

      if (subReemplazo.perfil_id) {
        await supabase
          .from("perfiles_matriz")
          .update({ ocupado: false, caido: estabaCaida ? true : false })
          .eq("id", subReemplazo.perfil_id);
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
        correo_cuenta: correoReemp.trim(),
        password_cuenta: passReemp.trim(),
        nombre_perfil: perfilReemp.trim() || subReemplazo.nombre_perfil || "1 Dispositivo",
        pin_perfil: pinReemp.trim()
      };
    }

    const { data: actualizada, error } = await supabase
      .from("suscripciones")
      .update(nuevosDatos)
      .eq("id", subReemplazo.id)
      .select()
      .single();

    if (error) return notificar("Error al reemplazar: " + error.message, "error");

    if (Number(costoReemp) > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          tipo: "Costo Proveedor",
          monto: -Math.abs(Number(costoReemp)),
          afecta_ganancia_neta: true,
          descripcion: `Costo reemplazo ${subReemplazo.plataforma} a ${subReemplazo.nombre_cliente}`,
          referencia_id: subReemplazo.id
        }
      ]);
    }

    setSubReemplazo(null);
    await recargarTodo();
    notificar("¡Reemplazo guardado! Siempre que consultes esta cuenta saldrá como Reemplazo.");
    if (actualizada) abrirMensajeDeSuscripcion(actualizada, "REEMPLAZO DE CUENTA");
  };

  const abrirModalReembolso = (s) => {
    const diasRest = Math.max(0, calcularDiasRestantes(s.fecha_corte));
    const diasContratados = Number(s.dias_totales || 30);
    setSubReembolso(s);
    setMontoReembolsoCalc(((Number(s.precio_venta) / diasContratados) * diasRest).toFixed(2));
  };

  const ejecutarReembolsoConfirmado = async () => {
    if (!subReembolso) return;
    if (subReembolso.perfil_id) {
      await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", subReembolso.perfil_id);
    }
    await supabase.from("suscripciones").update({ estado: "Reembolsada", perfil_id: null }).eq("id", subReembolso.id);
    await supabase.from("movimientos_yolo").insert([
      {
        tipo: "Reembolso",
        monto: -Math.abs(Number(montoReembolsoCalc)),
        afecta_ganancia_neta: true,
        descripcion: `Reembolso a ${subReembolso.nombre_cliente}`,
        referencia_id: subReembolso.id
      }
    ]);
    setSubReembolso(null);
    await recargarTodo();
    notificar(`Reembolso de Bs ${montoReembolsoCalc} aplicado`);
  };

  const cancelarReembolso = async (s) => {
    await supabase.from("movimientos_yolo").delete().eq("referencia_id", s.id).eq("tipo", "Reembolso");
    await supabase.from("suscripciones").update({ estado: "Activa" }).eq("id", s.id);
    await recargarTodo();
    notificar("Reembolso cancelado");
  };

  const handleCambiarPlataformaEnEdicion = (nuevaPlatNombre) => {
    const cfg = plataformasList.find((p) => p.nombre === nuevaPlatNombre);
    const esInvitacion =
      (cfg && cfg.pidePass === false) ||
      nuevaPlatNombre.toLowerCase().includes("invitaci");

    if (esInvitacion) {
      setSubEditar({
        ...subEditar,
        plataforma: nuevaPlatNombre,
        tipo_cuenta: "Por Invitación",
        origen: "proveedor",
        password_cuenta: "",
        nombre_perfil: "Por Invitación",
        pin_perfil: ""
      });
    } else {
      setSubEditar({
        ...subEditar,
        plataforma: nuevaPlatNombre,
        tipo_cuenta:
          subEditar.tipo_cuenta === "Por Invitación"
            ? "1 Dispositivo"
            : subEditar.tipo_cuenta || "1 Dispositivo"
      });
    }
  };

  const actualizarMesesEnEdicion = (cantMeses) => {
    const m = Math.max(1, Number(cantMeses || 1));
    const d = m === 12 ? 365 : m * 30;
    const baseVenta = subEditar.fecha_venta || new Date().toISOString().split("T")[0];
    const nuevaCorte = sumarDiasBoliviaISO(d, baseVenta);
    const mesesProv = m > 1 ? Number(subEditar.meses_pagados_proveedor || 1) : 1;
    const nuevaRenovProv = sumarDiasBoliviaISO(mesesProv * 30, baseVenta);

    setSubEditar({
      ...subEditar,
      meses_contratados: m,
      dias_totales: d,
      fecha_corte: nuevaCorte,
      meses_pagados_proveedor: mesesProv,
      fecha_renovacion_proveedor: nuevaRenovProv
    });
  };

  const actualizarDiasEnEdicion = (cantDias) => {
    const d = Math.max(1, Number(cantDias || 30));
    const mAprox = Math.max(1, Math.round(d / 30));
    const baseVenta = subEditar.fecha_venta || new Date().toISOString().split("T")[0];
    const nuevaCorte = sumarDiasBoliviaISO(d, baseVenta);

    setSubEditar({
      ...subEditar,
      dias_totales: d,
      meses_contratados: mAprox,
      fecha_corte: nuevaCorte
    });
  };

  const suscripcionesFiltradas = suscripciones
    .filter((s) => {
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
      if (filtroEstado === "revendedores" && s.tipo_comprador !== "revendedor") return false;
      if (filtroEstado === "reembolsados" && s.estado !== "Reembolsada") return false;

      if (filtroRevendedorId !== "todos") {
        const revObj = revendedores.find((r) => r.id === filtroRevendedorId);
        const coincide =
          s.revendedor_id === filtroRevendedorId || (revObj && s.telefono_cliente === revObj.telefono);
        if (!coincide) return false;
      }

      if (busqueda.trim() !== "") {
        const q = busqueda.toLowerCase();
        const coincide =
          (s.nombre_cliente || "").toLowerCase().includes(q) ||
          (s.telefono_cliente || "").toLowerCase().includes(q) ||
          (s.nombre_cliente_final || "").toLowerCase().includes(q) ||
          (s.telefono_cliente_final || "").toLowerCase().includes(q) ||
          (s.correo_cuenta || "").toLowerCase().includes(q) ||
          (s.nombre_perfil || "").toLowerCase().includes(q) ||
          (s.pin_perfil || "").toLowerCase().includes(q) ||
          (s.nombre_proveedor || "").toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    })
    .sort((a, b) => String(b.creado_en || "").localeCompare(String(a.creado_en || "")));

  const toggleCaido = async (s) => {
    const nuevo = s.estado === "Caida" ? "Activa" : "Caida";
    await supabase.from("suscripciones").update({ estado: nuevo }).eq("id", s.id);
    if (s.perfil_id) {
      await supabase.from("perfiles_matriz").update({ caido: nuevo === "Caida" }).eq("id", s.perfil_id);
    }
    await recargarTodo();
    notificar(
      nuevo === "Caida"
        ? "Cuenta marcada como Caída. Usa el botón amarillo 'Dar Reemplazo' para reemplazarla."
        : "Cuenta reactivada"
    );
  };

  const guardarEdicionManual = async (e) => {
    e.preventDefault();

    const estabaCaida = subEditar.estado === "Caida";
    const diasFinal = Number(subEditar.dias_totales || 30);
    const mesesFinal = Number(subEditar.meses_contratados || Math.max(1, Math.round(diasFinal / 30)));
    const mesesPagProv = diasFinal > 30 ? Number(subEditar.meses_pagados_proveedor || 1) : mesesFinal;
    const cadaCuantosAvisar = diasFinal > 30 ? Number(subEditar.cada_cuantos_meses_avisar_prov || 1) : 1;
    const fechaRenovProv =
      diasFinal > 30
        ? subEditar.fecha_renovacion_proveedor ||
          sumarDiasBoliviaISO(mesesPagProv * 30, subEditar.fecha_venta)
        : subEditar.fecha_corte;

    const nuevoPrecioCobrado = Number(subEditar.precio_venta ?? 0);

    let payload = {
      plataforma: subEditar.plataforma,
      tipo_comprador: subEditar.tipo_comprador || "cliente",
      revendedor_id: subEditar.tipo_comprador === "revendedor" ? subEditar.revendedor_id : null,
      tipo_cuenta: subEditar.tipo_cuenta || "1 Dispositivo",
      nombre_cliente: subEditar.nombre_cliente,
      telefono_cliente: subEditar.telefono_cliente,
      nombre_cliente_final: subEditar.nombre_cliente_final || null,
      telefono_cliente_final: subEditar.telefono_cliente_final || null,
      precio_venta_revendedor: Number(subEditar.precio_venta_revendedor || 0),
      correo_cuenta: subEditar.correo_cuenta,
      password_cuenta: subEditar.tipo_cuenta === "Por Invitación" ? "" : subEditar.password_cuenta,
      nombre_perfil: subEditar.nombre_perfil,
      pin_perfil: subEditar.pin_perfil,
      precio_venta: nuevoPrecioCobrado,
      costo_proveedor: Number(subEditar.costo_proveedor || 0),
      meses_contratados: mesesFinal,
      dias_totales: diasFinal,
      meses_pagados_proveedor: mesesPagProv,
      cada_cuantos_meses_avisar_prov: cadaCuantosAvisar,
      fecha_renovacion_proveedor: fechaRenovProv,
      fecha_venta: subEditar.fecha_venta,
      fecha_corte: subEditar.fecha_corte,
      origen: subEditar.origen,
      proveedor_id: subEditar.proveedor_id || null,
      nombre_proveedor: subEditar.nombre_proveedor || null,
      telefono_proveedor: subEditar.telefono_proveedor || null
    };

    if (subEditar.origen === "stock" && matrizNuevaEdicionId) {
      const mat = matrices.find((m) => m.id === matrizNuevaEdicionId);
      if (!mat) return notificar("Selecciona una matriz válida", "error");
      const libres = (mat.perfiles_matriz || []).filter((p) => !p.ocupado && !p.caido);
      const slot = libres[0];
      if (!slot) return notificar("Esa matriz no tiene cupos libres", "error");

      if (subEditar.perfil_id) {
        await supabase
          .from("perfiles_matriz")
          .update({ ocupado: false, caido: estabaCaida ? true : false })
          .eq("id", subEditar.perfil_id);
      }
      await supabase.from("perfiles_matriz").update({ ocupado: true, caido: false }).eq("id", slot.id);

      payload = {
        ...payload,
        plataforma: mat.plataforma,
        matriz_id: mat.id,
        perfil_id: slot.id,
        correo_cuenta: mat.correo,
        password_cuenta: mat.password,
        nombre_perfil: slot.nombre_perfil,
        pin_perfil: slot.pin
      };
    } else if (subEditar.perfil_id) {
      await supabase
        .from("perfiles_matriz")
        .update({
          nombre_perfil: subEditar.nombre_perfil || "Perfil 1",
          pin: subEditar.pin_perfil || ""
        })
        .eq("id", subEditar.perfil_id);
    }

    const { data: editada } = await supabase
      .from("suscripciones")
      .update(payload)
      .eq("id", subEditar.id)
      .select()
      .single();

    await supabase
      .from("movimientos_yolo")
      .update({
        monto: Math.abs(nuevoPrecioCobrado),
        descripcion: `Venta ${payload.plataforma} (${diasFinal}d) a ${payload.nombre_cliente}`
      })
      .eq("referencia_id", subEditar.id)
      .eq("tipo", "Ingreso Venta");

    await supabase
      .from("notificaciones_sistema")
      .update({
        monto_cobrar: nuevoPrecioCobrado
      })
      .eq("suscripcion_id", subEditar.id);

    setSubEditar(null);
    setMatrizNuevaEdicionId("");
    await recargarTodo();
    notificar("¡Precio, PIN y datos actualizados con éxito!");
    if (editada) abrirMensajeDeSuscripcion(editada);
  };

  const enviarAPapelera = async (s) => {
    if (s.perfil_id) {
      await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", s.perfil_id);
    }
    await supabase.from("suscripciones").update({ en_papelera: true, perfil_id: null }).eq("id", s.id);
    await supabase.from("movimientos_yolo").delete().eq("referencia_id", s.id);
    await recargarTodo();
    notificar("Enviado a papelera");
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#66FF00] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por teléfono, cliente, correo, perfil, PIN o proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl pl-10 pr-4 py-2 text-sm text-white"
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

          <select
            value={filtroRevendedorId}
            onChange={(e) => setFiltroRevendedorId(e.target.value)}
            className="bg-[#070B06] border border-purple-500/50 rounded-xl px-3 py-2 text-xs text-purple-200 font-bold"
          >
            <option value="todos">-- Filtrar por Revendedor (Todos) --</option>
            {revendedores.map((r) => (
              <option key={r.id} value={r.id}>
                🤝 {r.nombre} ({r.telefono})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "todos", label: `Todos por Hora (${suscripciones.filter((s) => !s.en_papelera).length})` },
            { id: "revendedores", label: "🤝 Solo Revendedores" },
            { id: "vence_3", label: "Por Vencer (≤ 3 días)" },
            { id: "caidos", label: "⚠️ Caídos" },
            { id: "reembolsados", label: "Reembolsados" },
            { id: "papelera", label: "🗑️ Papelera" }
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setFiltroEstado(b.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                filtroEstado === b.id ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {suscripcionesFiltradas.map((s) => {
          const dias = calcularDiasRestantes(s.fecha_corte);
          const diasPlan = s.dias_totales || Number(s.meses_contratados || 1) * 30;
          const tieneRenovIntermediaProv =
            diasPlan > 30 &&
            s.fecha_renovacion_proveedor &&
            s.fecha_renovacion_proveedor < s.fecha_corte;

          return (
            <div
              key={s.id}
              className={`bg-[#111A10] border rounded-2xl p-4 space-y-3 ${
                s.estado === "Caida" ? "border-2 border-red-500 bg-red-950/15" : "border-[#233820]"
              }`}
            >
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                      {s.plataforma}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-800 text-gray-300">
                      ⏳ Plan: {diasPlan} días
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-[#182916] text-[#66FF00] border border-[#66FF00]/40">
                      💰 Te pagó: Bs {s.precio_venta}
                    </span>
                    {s.fue_reemplazada && (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-400 text-black">
                        🔄 Reemplazada
                      </span>
                    )}
                    {s.estado === "Caida" && (
                      <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-red-600 text-white animate-pulse">
                        ⚠️ CUENTA CAÍDA
                      </span>
                    )}
                    {tieneRenovIntermediaProv && (
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-black">
                        📦 Pagado a Prov: {s.meses_pagados_proveedor || 1}M · Avisar el:{" "}
                        {formatearFechaDMA(s.fecha_renovacion_proveedor)}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base pt-0.5">
                    {s.nombre_cliente} · <span className="text-[#66FF00] font-mono">{s.telefono_cliente}</span>
                    {s.tipo_comprador === "revendedor" && s.nombre_cliente_final && (
                      <span className="text-xs text-purple-300 ml-2">
                        👉 Cliente Final: <b>{s.nombre_cliente_final}</b> ({s.telefono_cliente_final || "S/N"})
                      </span>
                    )}
                  </h3>

                  <p className="text-xs text-gray-300">
                    Correo: <span className="font-mono text-white">{s.correo_cuenta}</span>
                    {s.password_cuenta ? (
                      <> | Clave: <span className="font-mono text-[#66FF00]">{s.password_cuenta}</span></>
                    ) : null}
                    {s.nombre_perfil ? (
                      <> | 👤 <b className="text-white">{s.nombre_perfil}</b></>
                    ) : null}
                    {s.pin_perfil ? (
                      <> | 📌 PIN: <b className="text-[#66FF00] font-mono">{s.pin_perfil}</b></>
                    ) : null}
                  </p>
                </div>

                <div className="text-right space-y-0.5">
                  <p className="text-xs font-bold text-gray-300">
                    {dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `Quedan ${dias} día(s)`}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Corte: <b className="text-gray-200">{formatearFechaDMA(s.fecha_corte)}</b>
                  </p>
                </div>
              </div>

              {!s.en_papelera && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1E331A]">
                  <button
                    onClick={() => abrirMensajeDeSuscripcion(s)}
                    className="px-3 py-1.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />{" "}
                    {s.fue_reemplazada ? "Ver Reemplazo / WhatsApp" : "Entregar / WhatsApp"}
                  </button>

                  <button
                    onClick={() => {
                      setSubEditar({
                        ...s,
                        meses_contratados: s.meses_contratados || 1,
                        dias_totales: s.dias_totales || Number(s.meses_contratados || 1) * 30,
                        meses_pagados_proveedor: s.meses_pagados_proveedor || 1,
                        cada_cuantos_meses_avisar_prov: s.cada_cuantos_meses_avisar_prov || 1
                      });
                      setMatrizNuevaEdicionId("");
                    }}
                    className="px-3 py-1.5 bg-[#1A2B18] text-white border border-[#66FF00]/40 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#66FF00]" /> Editar Todo (Precio / PIN / Plan)
                  </button>

                  <button
                    onClick={() => toggleCaido(s)}
                    className="px-2.5 py-1.5 bg-red-950/70 text-red-300 border border-red-800/50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {s.estado === "Caida" ? "Quitar Caído" : "Marcar Caído"}
                  </button>

                  <button
                    onClick={() => abrirModalReemplazo(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer ${
                      s.estado === "Caida"
                        ? "bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.5)] ring-2 ring-amber-300"
                        : "bg-amber-500 hover:bg-amber-400 text-black"
                    }`}
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> 🔄 Dar Reemplazo
                  </button>

                  {s.estado !== "Reembolsada" ? (
                    <button
                      onClick={() => abrirModalReembolso(s)}
                      className="px-2.5 py-1.5 bg-purple-950/80 text-purple-300 border border-purple-700/50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Reembolsar
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
                    className="ml-auto p-1.5 bg-gray-900 text-gray-400 hover:text-red-400 rounded-xl cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL DAR REEMPLAZO */}
      {subReemplazo && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={ejecutarReemplazo}
            className="bg-[#111A10] border-2 border-amber-400 rounded-3xl p-6 max-w-lg w-full space-y-4 animate-modal"
          >
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h3 className="font-black text-amber-400 text-base flex items-center gap-2">
                  <RefreshCcw className="w-5 h-5" /> Dar Reemplazo de {subReemplazo.plataforma}
                </h3>
                <p className="text-[11px] text-gray-300 mt-0.5">
                  Comprador: <b className="text-white">{subReemplazo.nombre_cliente}</b> ({subReemplazo.telefono_cliente})
                </p>
              </div>
              <button type="button" onClick={() => setSubReemplazo(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#070B06] border border-[#66FF00]/50 rounded-2xl p-3 text-xs space-y-1">
              <p className="text-[#66FF00] font-extrabold">
                ✓ Se mantienen intactos su fecha de corte y todos sus datos:
              </p>
              <p className="text-gray-300">
                📅 Fecha de Corte que se conserva: <b className="text-white">{formatearFechaDMA(subReemplazo.fecha_corte)}</b> · Plan:{" "}
                <b>{subReemplazo.dias_totales || 30} días</b> · Pagó: <b>Bs {subReemplazo.precio_venta}</b>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrigenReemp("stock")}
                className={`py-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 cursor-pointer ${
                  origenReemp === "stock"
                    ? "bg-[#66FF00] text-black border-[#66FF00]"
                    : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                }`}
              >
                <Layers className="w-4 h-4" /> Seleccionar Matriz (Stock)
              </button>
              <button
                type="button"
                onClick={() => setOrigenReemp("proveedor")}
                className={`py-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 cursor-pointer ${
                  origenReemp === "proveedor"
                    ? "bg-amber-400 text-black border-amber-400"
                    : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                }`}
              >
                <Truck className="w-4 h-4" /> De Proveedor (A Mano)
              </button>
            </div>

            {origenReemp === "stock" ? (
              <div className="bg-[#0B120A] border border-[#233820] rounded-2xl p-3.5 space-y-2">
                <label className="text-xs font-bold text-[#66FF00]">
                  Elige la Matriz de donde saldrá el perfil de reemplazo:
                </label>
                <select
                  value={matrizReempId}
                  onChange={(e) => setMatrizReempId(e.target.value)}
                  className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-xs text-white font-bold"
                >
                  <option value="">-- Selecciona Matriz con cupos libres --</option>
                  {matrices
                    .filter(
                      (m) =>
                        !m.en_papelera &&
                        m.estado === "Activa" &&
                        (m.perfiles_matriz || []).some((p) => !p.ocupado && !p.caido)
                    )
                    .map((m) => {
                      const libres = (m.perfiles_matriz || []).filter((p) => !p.ocupado && !p.caido);
                      return (
                        <option key={m.id} value={m.id}>
                          {m.plataforma} — {m.correo} ({libres.length} libres 👉 asignará {libres[0]?.nombre_perfil})
                        </option>
                      );
                    })}
                </select>
              </div>
            ) : (
              <div className="bg-[#0B120A] border border-amber-400/50 rounded-2xl p-3.5 space-y-3">
                <div>
                  <label className="text-[11px] text-gray-400">Proveedor que dio el reemplazo</label>
                  <select
                    value={provReempId}
                    onChange={(e) => setProvReempId(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                  >
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.telefono})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#66FF00] font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Pegar mensaje del proveedor (o llena a mano abajo):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Pega aquí correo y clave del reemplazo para extraer automático..."
                    value={textoCrudoReemp}
                    onChange={(e) => procesarTextoProveedorReemplazo(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#233820] rounded-xl p-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-amber-300 font-bold">Nuevo Correo *</label>
                    <input
                      type="text"
                      placeholder="correo@gmail.com"
                      value={correoReemp}
                      onChange={(e) => setCorreoReemp(e.target.value)}
                      className="w-full mt-1 bg-[#070B06] border border-amber-400 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-amber-300 font-bold">Nueva Contraseña</label>
                    <input
                      type="text"
                      placeholder="Contraseña"
                      value={passReemp}
                      onChange={(e) => setPassReemp(e.target.value)}
                      className="w-full mt-1 bg-[#070B06] border border-amber-400 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400">Perfil / Modalidad</label>
                    <input
                      type="text"
                      placeholder="Ej: 1 Dispositivo o Perfil 1"
                      value={perfilReemp}
                      onChange={(e) => setPerfilReemp(e.target.value)}
                      className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400">PIN (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: 1234"
                      value={pinReemp}
                      onChange={(e) => setPinReemp(e.target.value)}
                      className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400">
                    Costo extra pagado al proveedor por este reemplazo (Bs)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={costoReemp}
                    onChange={(e) => setCostoReemp(e.target.value)}
                    className="w-36 mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white block"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubReemplazo(null)}
                className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-black rounded-xl text-xs font-black cursor-pointer"
              >
                Confirmar Reemplazo y Generar Mensaje
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL REEMBOLSO */}
      {subReembolso && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-purple-500 rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-purple-300">Calcular Reembolso ({subReembolso.nombre_cliente})</h3>
            <input
              type="number"
              step="0.01"
              value={montoReembolsoCalc}
              onChange={(e) => setMontoReembolsoCalc(e.target.value)}
              className="w-full bg-[#070B06] border border-purple-500 rounded-xl p-2.5 text-white font-bold"
            />
            <div className="flex gap-2">
              <button onClick={() => setSubReembolso(null)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button onClick={ejecutarReembolsoConfirmado} className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer">
                Confirmar Reembolso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN TOTAL */}
      {subEditar && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={guardarEdicionManual}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-xl w-full space-y-4 max-h-[94vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <h3 className="font-black text-[#66FF00] text-base">Edición Total de Suscripción</h3>
              <button type="button" onClick={() => setSubEditar(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-gray-400">Plataforma</label>
                <select
                  value={subEditar.plataforma}
                  onChange={(e) => handleCambiarPlataformaEnEdicion(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white font-bold"
                >
                  {plataformasList.map((p) => (
                    <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-400">Modalidad</label>
                <select
                  value={subEditar.tipo_cuenta || "1 Dispositivo"}
                  onChange={(e) => setSubEditar({ ...subEditar, tipo_cuenta: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white font-bold"
                >
                  <option value="1 Dispositivo">1 Dispositivo</option>
                  <option value="Cuenta Completa">Cuenta Completa</option>
                  <option value="Por Invitación">Por Invitación</option>
                </select>
              </div>
            </div>

            <div className="bg-[#0B120A] border border-[#66FF00]/60 rounded-2xl p-3.5 space-y-3">
              <label className="text-xs font-extrabold text-[#66FF00]">
                Plan Contratado ({subEditar.dias_totales || 30} días):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => actualizarMesesEnEdicion(m)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border cursor-pointer ${
                      Number(subEditar.meses_contratados) === m
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    {m}M ({m === 12 ? 365 : m * 30}d)
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400">Cantidad de Meses:</label>
                  <input
                    type="number"
                    min="1"
                    value={subEditar.meses_contratados || 1}
                    onChange={(e) => actualizarMesesEnEdicion(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#66FF00] font-bold">Cantidad de Días:</label>
                  <input
                    type="number"
                    min="1"
                    value={subEditar.dias_totales || 30}
                    onChange={(e) => actualizarDiasEnEdicion(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-lg p-2 text-xs text-white font-black"
                  />
                </div>
              </div>

              {Number(subEditar.dias_totales) > 30 && (
                <div className="bg-amber-950/40 border border-amber-500/60 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-amber-300 block">Meses pagados hoy al Prov:</span>
                    <input
                      type="number"
                      min="1"
                      value={subEditar.meses_pagados_proveedor || 1}
                      onChange={(e) => {
                        const mp = Number(e.target.value || 1);
                        setSubEditar({
                          ...subEditar,
                          meses_pagados_proveedor: mp,
                          fecha_renovacion_proveedor: sumarDiasBoliviaISO(mp * 30, subEditar.fecha_venta)
                        });
                      }}
                      className="w-full mt-1 bg-[#070B06] border border-amber-400 rounded-lg p-1.5 text-center text-white font-black"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-300 block">Avisar cada (meses):</span>
                    <input
                      type="number"
                      min="1"
                      value={subEditar.cada_cuantos_meses_avisar_prov || 1}
                      onChange={(e) =>
                        setSubEditar({ ...subEditar, cada_cuantos_meses_avisar_prov: e.target.value })
                      }
                      className="w-full mt-1 bg-[#070B06] border border-amber-400 rounded-lg p-1.5 text-center text-white font-black"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-[#66FF00] font-black">
                  💰 Precio Cobrado por Ti (Bs):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={subEditar.precio_venta ?? 0}
                  onChange={(e) => setSubEditar({ ...subEditar, precio_venta: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border-2 border-[#66FF00] rounded-lg p-2 text-xs text-white font-black"
                />
              </div>

              <div>
                <label className="text-[11px] text-orange-300 font-bold">
                  Costo Pagado al Proveedor (Bs):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={subEditar.costo_proveedor ?? 0}
                  onChange={(e) => setSubEditar({ ...subEditar, costo_proveedor: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-orange-500/50 rounded-lg p-2 text-xs text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400">Nombre Comprador</label>
                <input
                  type="text"
                  value={subEditar.nombre_cliente}
                  onChange={(e) => setSubEditar({ ...subEditar, nombre_cliente: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400">Teléfono Comprador</label>
                <input
                  type="text"
                  value={subEditar.telefono_cliente}
                  onChange={(e) => setSubEditar({ ...subEditar, telefono_cliente: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400">Correo de la Cuenta</label>
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
                <label className="text-[11px] text-gray-400">👤 Nombre del Perfil</label>
                <input
                  type="text"
                  value={subEditar.nombre_perfil || ""}
                  onChange={(e) => setSubEditar({ ...subEditar, nombre_perfil: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#66FF00] font-bold">📌 PIN del Perfil</label>
                <input
                  type="text"
                  value={subEditar.pin_perfil || ""}
                  onChange={(e) => setSubEditar({ ...subEditar, pin_perfil: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-lg p-2 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400">Fecha Venta</label>
                <input
                  type="date"
                  value={subEditar.fecha_venta || ""}
                  onChange={(e) => {
                    const nv = e.target.value;
                    const d = Number(subEditar.dias_totales || 30);
                    setSubEditar({
                      ...subEditar,
                      fecha_venta: nv,
                      fecha_corte: sumarDiasBoliviaISO(d, nv)
                    });
                  }}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-lg p-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400">Fecha Corte</label>
                <input
                  type="date"
                  value={subEditar.fecha_corte || ""}
                  onChange={(e) => setSubEditar({ ...subEditar, fecha_corte: e.target.value })}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-lg p-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setSubEditar(null)} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                Guardar Cambios (Bs {subEditar.precio_venta})
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE MENSAJE */}
      {mensajeActivo && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#66FF00] font-black text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Pedido para {mensajeActivo.cliente}
              </h3>
              <button onClick={() => setMensajeActivo(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea readOnly rows={11} value={mensajeActivo.completo} className="w-full bg-[#070B06] border border-[#2A4226] rounded-2xl p-3 text-xs text-gray-200 font-mono" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mensajeActivo.completo);
                  notificar("¡Mensaje copiado!");
                }}
                className="py-3 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/50 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Copiar Mensaje
              </button>
              <button
                onClick={() => enviarWhatsappDirecto(mensajeActivo.telefono, mensajeActivo.completo)}
                className="py-3 bg-[#66FF00] text-black rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(102,255,0,0.4)]"
              >
                <Send className="w-4 h-4" /> 📲 Enviar Pedido a WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}