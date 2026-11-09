"use client";
import React, { useState, useEffect } from "react";
import {
  supabase,
  PLATAFORMAS,
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  sumarDiasBoliviaISO
} from "@/config";
import { extraerDatosProveedor } from "@/utils/extractorProveedor";
import { generarMensajeEntrega } from "@/utils/mensajesMoss";
import {
  ShoppingBag,
  Copy,
  Share2,
  CheckCircle2,
  UserCheck,
  Sparkles,
  UserPlus,
  Truck,
  PlusCircle,
  X,
  Zap,
  Calendar,
  MessageSquare,
  Trash2,
  Users
} from "lucide-react";

export default function ModuloVentas({
  matrices = [],
  clientes = [],
  proveedores = [],
  revendedores = [],
  suscripciones = [],
  linkWhatsappMoss = "",
  plataformasList = PLATAFORMAS,
  recargarTodo,
  notificar
}) {
  const [modalVentaAbierto, setModalVentaAbierto] = useState(false);
  const [modalNuevoProv, setModalNuevoProv] = useState(false);
  const [modalNuevoRev, setModalNuevoRev] = useState(false);

  const [tipoComprador, setTipoComprador] = useState("cliente");
  const [revendedorId, setRevendedorId] = useState("");
  const [nuevoRevNombre, setNuevoRevNombre] = useState("");
  const [nuevoRevTelefono, setNuevoRevTelefono] = useState("");

  const [telefono, setTelefono] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [clienteExistente, setClienteExistente] = useState(false);

  const [carritoCombo, setCarritoCombo] = useState([]);

  const [plataforma, setPlataforma] = useState("Netflix");
  const [tipoCuenta, setTipoCuenta] = useState("1 Dispositivo");
  const [origen, setOrigen] = useState("stock");
  const [matrizSeleccionadaId, setMatrizSeleccionadaId] = useState("");

  const [proveedorSeleccionadoId, setProveedorSeleccionadoId] = useState("");
  const [nuevoProvNombre, setNuevoProvNombre] = useState("");
  const [nuevoProvTelefono, setNuevoProvTelefono] = useState("");

  const [textoProveedorCrudo, setTextoProveedorCrudo] = useState("");
  const [provCorreo, setProvCorreo] = useState("");
  const [provPassword, setProvPassword] = useState("");
  const [provPerfil, setProvPerfil] = useState("");
  const [provPin, setProvPin] = useState("");
  const [costoProveedor, setCostoProveedor] = useState("");

  const [precioVenta, setPrecioVenta] = useState("");
  const [meses, setMeses] = useState(1);
  const [diasPersonalizados, setDiasPersonalizados] = useState(30);
  const [mesesPagadosProv, setMesesPagadosProv] = useState(3);

  const [modoFecha, setModoFecha] = useState("hoy");
  const [fechaVenta, setFechaVenta] = useState("");

  const [mensajeGenerado, setMensajeGenerado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setFechaVenta(obtenerFechaBoliviaISO());
  }, []);

  const configPlatActual =
    plataformasList.find((p) => p.nombre === plataforma) || {
      nombre: plataforma,
      pidePass: true,
      pidePerfil: true,
      pidePin: true,
      precioCliente: 20,
      precioRevendedor: 10
    };

  const perfilesEnCarritoIds = carritoCombo.map((item) => item.perfilIdUsado).filter(Boolean);

  const contarCuposLibresPlataforma = (nombrePlat) => {
    return matrices
      .filter((m) => !m.en_papelera && m.estado === "Activa" && m.plataforma === nombrePlat)
      .reduce(
        (acc, m) =>
          acc +
          (m.perfiles_matriz || []).filter(
            (pf) => !pf.ocupado && !pf.caido && !perfilesEnCarritoIds.includes(pf.id)
          ).length,
        0
      );
  };

  const aplicarAtajoPrecio = (nombrePlat, rolComprador, cantMeses = 1) => {
    const cfg = plataformasList.find((p) => p.nombre === nombrePlat);
    if (!cfg) return;
    const base =
      rolComprador === "revendedor"
        ? Number(cfg.precioRevendedor ?? 10)
        : Number(cfg.precioCliente ?? 20);
    setPrecioVenta(String(base * Number(cantMeses || 1)));
  };

  // Cambiar meses actualiza automáticamente los días (ej: 3M -> 90 días, 4M -> 120 días, 12M -> 365 días)
  const cambiarDuracionMeses = (cantMeses) => {
    const m = Math.max(1, Number(cantMeses || 1));
    const d = m === 12 ? 365 : m * 30;
    setMeses(m);
    setDiasPersonalizados(d);
    if (m <= 3) setMesesPagadosProv(m);
    else setMesesPagadosProv(3);
    aplicarAtajoPrecio(plataforma, tipoComprador, m);
  };

  // Cambiar días directamente (ej: escribir 90 días, 45 días, 120 días)
  const cambiarDuracionDias = (cantDias) => {
    const d = Math.max(1, Number(cantDias || 30));
    setDiasPersonalizados(d);
    const mAprox = Math.max(1, Math.round(d / 30));
    setMeses(mAprox);
  };

  const cambiarTipoComprador = (nuevoTipo) => {
    setTipoComprador(nuevoTipo);
    aplicarAtajoPrecio(plataforma, nuevoTipo, meses);
    if (nuevoTipo === "revendedor") {
      const primerRev = revendedores[0];
      if (primerRev) {
        setRevendedorId(primerRev.id);
        setNombreCliente(primerRev.nombre);
        setTelefono(primerRev.telefono);
      } else {
        setRevendedorId("");
        setNombreCliente("");
        setTelefono("");
      }
    } else {
      setRevendedorId("");
      setNombreCliente("");
      setTelefono("");
    }
  };

  const handleSelectRevendedor = (id) => {
    setRevendedorId(id);
    const found = revendedores.find((r) => r.id === id);
    if (found) {
      setNombreCliente(found.nombre);
      setTelefono(found.telefono);
    }
  };

  const guardarNuevoRevendedor = async (e) => {
    e.preventDefault();
    if (!nuevoRevNombre.trim() || !nuevoRevTelefono.trim()) {
      return notificar("Ingresa nombre y teléfono del revendedor", "error");
    }
    const { data, error } = await supabase
      .from("revendedores")
      .insert([{ nombre: nuevoRevNombre.trim(), telefono: nuevoRevTelefono.trim() }])
      .select()
      .single();

    if (error) return notificar("Error: " + error.message, "error");

    setNuevoRevNombre("");
    setNuevoRevTelefono("");
    setModalNuevoRev(false);
    await recargarTodo();
    if (data) {
      setRevendedorId(data.id);
      setNombreCliente(data.nombre);
      setTelefono(data.telefono);
    }
    notificar("Revendedor registrado y seleccionado");
  };

  const guardarNuevoProveedor = async (e) => {
    e.preventDefault();
    if (!nuevoProvNombre.trim() || !nuevoProvTelefono.trim()) {
      return notificar("Ingresa nombre y teléfono del proveedor", "error");
    }
    const { data, error } = await supabase
      .from("proveedores")
      .insert([{ nombre: nuevoProvNombre.trim(), telefono: nuevoProvTelefono.trim() }])
      .select()
      .single();

    if (error) return notificar("Error: " + error.message, "error");

    setNuevoProvNombre("");
    setNuevoProvTelefono("");
    setModalNuevoProv(false);
    await recargarTodo();
    if (data) setProveedorSeleccionadoId(data.id);
    notificar("Proveedor guardado en Supabase");
  };

  const seleccionarPlataforma = (nombrePlat, libresPlat = null) => {
    setPlataforma(nombrePlat);
    setMatrizSeleccionadaId("");
    aplicarAtajoPrecio(nombrePlat, tipoComprador, meses);
    const cupos = libresPlat !== null ? libresPlat : contarCuposLibresPlataforma(nombrePlat);
    const cfg = plataformasList.find((p) => p.nombre === nombrePlat);
    if (cfg && cfg.pidePass === false) {
      setTipoCuenta("Por Invitación");
      setOrigen("proveedor");
    } else {
      if (tipoCuenta === "Por Invitación") setTipoCuenta("1 Dispositivo");
      setOrigen(cupos > 0 ? "stock" : "proveedor");
    }
  };

  // IMPORTANTE: Al pegar el mensaje del proveedor NO cambia la plataforma que ya tienes seleccionada
  const procesarTextoProveedor = (texto) => {
    setTextoProveedorCrudo(texto);
    const extraido = extraerDatosProveedor(texto, plataformasList);
    if (extraido.correo) setProvCorreo(extraido.correo);
    if (extraido.password) setProvPassword(extraido.password);
    if (extraido.perfil) setProvPerfil(extraido.perfil);
    if (extraido.pin) setProvPin(extraido.pin);
    if (texto.toUpperCase().includes("COMPLETA")) setTipoCuenta("Cuenta Completa");
    notificar(`Datos extraídos para ${plataforma}`);
  };

  const pegarDesdePortapapeles = async () => {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) procesarTextoProveedor(texto);
    } catch {
      notificar("Pega el mensaje directamente en el recuadro", "error");
    }
  };

  const handleTelefonoChange = (valor) => {
    setTelefono(valor);
    const limpio = valor.trim();
    const encontrado = clientes.find((c) => c.telefono === limpio);
    if (encontrado) {
      setNombreCliente(encontrado.nombre);
      setClienteExistente(true);
    } else {
      setClienteExistente(false);
    }
  };

  const seleccionarModoFecha = (modo) => {
    setModoFecha(modo);
    if (modo === "hoy") {
      setFechaVenta(obtenerFechaBoliviaISO());
    } else if (modo === "ayer") {
      setFechaVenta(sumarDiasBoliviaISO(-1));
    }
  };

  const obtenerPerfilesLibresDeMatriz = (matriz) => {
    if (!matriz || !matriz.perfiles_matriz) return [];
    const libres = matriz.perfiles_matriz.filter(
      (p) => !p.ocupado && !p.caido && !perfilesEnCarritoIds.includes(p.id)
    );
    libres.sort((a, b) => (a.es_extra_final !== b.es_extra_final ? (a.es_extra_final ? 1 : -1) : a.numero_slot - b.numero_slot));
    return libres;
  };

  const matricesDisponibles = matrices.filter((m) => {
    if (m.en_papelera || m.estado !== "Activa") return false;
    if (m.plataforma !== plataforma) return false;
    return obtenerPerfilesLibresDeMatriz(m).length > 0;
  });

  const obtenerSiguientePerfilLibre = (matriz) => obtenerPerfilesLibresDeMatriz(matriz)[0] || null;

  const armarItemActualFormulario = () => {
    if (precioVenta === "" || Number(precioVenta) < 0) {
      notificar("Ingresa el precio de venta", "error");
      return null;
    }

    let correoFinal = "", passFinal = "", perfilFinal = "", pinFinal = "";
    let perfilIdUsado = null, matrizIdUsada = null, costoFinal = 0;
    let provIdFinal = null, provNombreFinal = null, provTelFinal = null;

    const esModoInvitacion = tipoCuenta === "Por Invitación" || configPlatActual.pidePass === false;

    if (origen === "stock" && !esModoInvitacion) {
      const matrizObj = matricesDisponibles.find((m) => m.id === matrizSeleccionadaId) || matricesDisponibles[0];
      if (!matrizObj) {
        notificar("No tienes stock libre en esta plataforma", "error");
        return null;
      }
      const slotLibre = obtenerSiguientePerfilLibre(matrizObj);
      if (!slotLibre) {
        notificar("Esta matriz no tiene perfiles libres", "error");
        return null;
      }
      correoFinal = matrizObj.correo;
      passFinal = matrizObj.password;
      perfilFinal = tipoCuenta === "Cuenta Completa" ? "Cuenta Completa" : slotLibre.nombre_perfil;
      pinFinal = tipoCuenta === "Cuenta Completa" ? "" : slotLibre.pin;
      perfilIdUsado = slotLibre.id;
      matrizIdUsada = matrizObj.id;
      provIdFinal = matrizObj.proveedor_id || null;
      provNombreFinal = matrizObj.nombre_proveedor || null;
      provTelFinal = matrizObj.telefono_proveedor || null;
    } else {
      if (!provCorreo.trim()) {
        notificar("Ingresa el Correo o Usuario", "error");
        return null;
      }
      const provObj = proveedores.find((p) => p.id === proveedorSeleccionadoId) || proveedores[0] || null;
      correoFinal = provCorreo.trim();
      passFinal = esModoInvitacion ? "" : provPassword.trim();
      perfilFinal =
        tipoCuenta === "Cuenta Completa"
          ? "Cuenta Completa"
          : esModoInvitacion
          ? "Por Invitación"
          : provPerfil.trim() || "1 Dispositivo";
      pinFinal = tipoCuenta === "Cuenta Completa" || esModoInvitacion ? "" : provPin.trim();
      costoFinal = Number(costoProveedor || 0);
      provIdFinal = provObj ? provObj.id : null;
      provNombreFinal = provObj ? provObj.nombre : "Proveedor Externo";
      provTelFinal = provObj ? provObj.telefono : "";
    }

    const diasTotales = Math.max(1, Number(diasPersonalizados || 30));
    const fechaBaseStr = fechaVenta || obtenerFechaBoliviaISO();
    const fechaCorte = sumarDiasBoliviaISO(diasTotales, fechaBaseStr);

    // Si pagó más de 3 meses (> 90 días), calcular cuándo debes renovar tú con el proveedor
    const mesesPagProv = diasTotales > 90 ? Number(mesesPagadosProv || 3) : Number(meses || 1);
    const fechaRenovProv =
      diasTotales > 90
        ? sumarDiasBoliviaISO(mesesPagProv * 30, fechaBaseStr)
        : fechaCorte;

    return {
      tempId: Date.now() + Math.random(),
      plataforma,
      tipoCuenta: esModoInvitacion ? "Por Invitación" : tipoCuenta,
      origen: esModoInvitacion ? "proveedor" : origen,
      matrizIdUsada,
      perfilIdUsado,
      provIdFinal,
      provNombreFinal,
      provTelFinal,
      correoFinal,
      passFinal,
      perfilFinal,
      pinFinal,
      costoFinal,
      precioVenta: Number(precioVenta),
      meses: Number(meses),
      diasTotales,
      mesesPagadosProv,
      fechaRenovProv,
      fechaVenta: fechaBaseStr,
      fechaCorte
    };
  };

  const limpiarCamposCuentaActual = () => {
    setTextoProveedorCrudo("");
    setProvCorreo("");
    setProvPassword("");
    setProvPerfil("");
    setProvPin("");
    setCostoProveedor("");
    setMatrizSeleccionadaId("");
  };

  const agregarCuentaAlCombo = () => {
    const nuevoItem = armarItemActualFormulario();
    if (!nuevoItem) return;
    setCarritoCombo((prev) => [...prev, nuevoItem]);
    limpiarCamposCuentaActual();
    notificar(`${nuevoItem.plataforma} añadida al Combo`);
  };

  const registrarVenta = async (e) => {
    e.preventDefault();
    if (!telefono.trim() || !nombreCliente.trim()) {
      return notificar("Completa teléfono y nombre del comprador", "error");
    }

    let itemsParaGuardar = [...carritoCombo];
    const hayDatosEnFormularioActual = precioVenta !== "" && (origen === "stock" || provCorreo.trim() !== "");

    if (itemsParaGuardar.length === 0 || hayDatosEnFormularioActual) {
      const itemActual = armarItemActualFormulario();
      if (!itemActual) return;
      itemsParaGuardar.push(itemActual);
    }

    setGuardando(true);
    try {
      let clienteId = null;
      if (tipoComprador === "cliente") {
        const { data: cliData } = await supabase
          .from("clientes")
          .upsert([{ telefono: telefono.trim(), nombre: nombreCliente.trim() }], { onConflict: "telefono" })
          .select()
          .single();
        if (cliData) clienteId = cliData.id;
      }

      for (const item of itemsParaGuardar) {
        const { data: nuevaSub, error: errSub } = await supabase
          .from("suscripciones")
          .insert([{
            cliente_id: clienteId,
            tipo_comprador: tipoComprador,
            revendedor_id: tipoComprador === "revendedor" ? (revendedorId || revendedores[0]?.id || null) : null,
            telefono_cliente: telefono.trim(),
            nombre_cliente: nombreCliente.trim(),
            plataforma: item.plataforma,
            tipo_cuenta: item.tipoCuenta,
            origen: item.origen,
            matriz_id: item.matrizIdUsada,
            perfil_id: item.perfilIdUsado,
            proveedor_id: item.provIdFinal,
            nombre_proveedor: item.provNombreFinal,
            telefono_proveedor: item.provTelFinal,
            correo_cuenta: item.correoFinal,
            password_cuenta: item.passFinal || "",
            nombre_perfil: item.perfilFinal || item.tipoCuenta,
            pin_perfil: item.pinFinal || "",
            costo_proveedor: item.costoFinal,
            precio_venta: item.precioVenta,
            meses_contratados: item.meses,
            dias_totales: item.diasTotales,
            meses_pagados_proveedor: item.mesesPagadosProv,
            fecha_renovacion_proveedor: item.fechaRenovProv,
            fecha_venta: item.fechaVenta,
            fecha_corte: item.fechaCorte,
            estado: "Activa"
          }])
          .select()
          .single();

        if (errSub) throw errSub;

        if (item.origen === "stock" && item.matrizIdUsada) {
          if (item.tipoCuenta === "Cuenta Completa") {
            await supabase.from("perfiles_matriz").update({ ocupado: true }).eq("matriz_id", item.matrizIdUsada);
          } else if (item.perfilIdUsado) {
            await supabase.from("perfiles_matriz").update({ ocupado: true }).eq("id", item.perfilIdUsado);
          }
        }

        const tagRol = tipoComprador === "revendedor" ? " [Revendedor]" : "";
        await supabase.from("movimientos_yolo").insert([{
          tipo: "Ingreso Venta",
          monto: Math.abs(Number(item.precioVenta)),
          afecta_ganancia_neta: true,
          descripcion: `Venta${tagRol} ${item.plataforma} (${item.diasTotales}d) a ${nombreCliente.trim()}`,
          referencia_id: nuevaSub.id
        }]);

        if (item.origen === "proveedor" && item.costoFinal > 0) {
          await supabase.from("movimientos_yolo").insert([{
            tipo: "Costo Proveedor",
            monto: -Math.abs(item.costoFinal),
            afecta_ganancia_neta: true,
            descripcion: `Pago a proveedor ${item.provNombreFinal} por ${item.plataforma} (${item.mesesPagadosProv}M)`,
            referencia_id: nuevaSub.id
          }]);
        }
      }

      const msgObj = generarMensajeEntrega(
        nombreCliente.trim(),
        telefono.trim(),
        itemsParaGuardar,
        linkWhatsappMoss,
        null,
        tipoComprador === "revendedor"
      );
      setModalVentaAbierto(false);
      setMensajeGenerado(msgObj);

      setTelefono("");
      setNombreCliente("");
      setCarritoCombo([]);
      limpiarCamposCuentaActual();
      await recargarTodo();
      notificar("¡Venta registrada con éxito!");
    } catch (err) {
      notificar("Error: " + err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const hoyBolivia = obtenerFechaBoliviaISO();
  const ventasActivas = suscripciones.filter((s) => !s.en_papelera);
  const ventasDeHoy = ventasActivas.filter((s) => s.fecha_venta === hoyBolivia);
  const ingresoDeHoy = ventasDeHoy.reduce((acc, s) => acc + Number(s.precio_venta || 0), 0);
  const cuposLibresTotales = matrices
    .filter((m) => !m.en_papelera && m.estado === "Activa")
    .reduce((acc, m) => acc + (m.perfiles_matriz || []).filter((p) => !p.ocupado && !p.caido).length, 0);

  const totalAcumuladoCombo =
    carritoCombo.reduce((acc, item) => acc + Number(item.precioVenta || 0), 0) +
    (precioVenta !== "" ? Number(precioVenta) : 0);

  const esModoInvitacionActual = tipoCuenta === "Por Invitación" || configPlatActual.pidePass === false;

  return (
    <div className="space-y-6">
      {/* BANNER HERO */}
      <div className="bg-gradient-to-r from-[#162914] via-[#101D0E] to-[#0B140A] border-2 border-[#66FF00]/60 rounded-3xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2.5 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#66FF00]/20 text-[#66FF00] border border-[#66FF00]/40">
              <Zap className="w-3.5 h-3.5" /> Ventas a Clientes & Revendedores ({formatearFechaDMA(hoyBolivia)})
            </span>
            <span className="text-[11px] text-gray-400">
              🟢 Verde = Con cupos en tu Stock · ⚫ Apagado = Sin stock (Comprar a Proveedor)
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white">¿Nueva venta o Combo para entregar?</h2>

          <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
            {plataformasList.map((p) => {
              const libresPlat = contarCuposLibresPlataforma(p.nombre);
              const tieneStock = libresPlat > 0;
              const esInvitacion = p.pidePass === false;

              return (
                <button
                  key={p.nombre}
                  type="button"
                  onClick={() => {
                    seleccionarPlataforma(p.nombre, libresPlat);
                    setFechaVenta(obtenerFechaBoliviaISO());
                    setModoFecha("hoy");
                    setModalVentaAbierto(true);
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    tieneStock
                      ? "bg-[#11240F] hover:bg-[#66FF00] text-white hover:text-black border-[#66FF00] shadow-[0_0_15px_rgba(102,255,0,0.2)]"
                      : esInvitacion
                      ? "bg-[#09131C] hover:bg-blue-500 hover:text-black text-blue-200 border-blue-500/40"
                      : "bg-[#070A07]/70 hover:bg-gray-800 text-gray-500 hover:text-gray-200 border-gray-800 opacity-65 hover:opacity-100"
                  }`}
                >
                  <span>{p.nombre}</span>

                  {tieneStock ? (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#66FF00] text-black">
                      ● {libresPlat} {libresPlat === 1 ? "libre" : "libres"}
                    </span>
                  ) : esInvitacion ? (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-500/30">
                      📩 Inv. (Prov.)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-900 text-gray-500 border border-gray-800">
                      0 stock (Prov.)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFechaVenta(obtenerFechaBoliviaISO());
            setModoFecha("hoy");
            aplicarAtajoPrecio(plataforma, tipoComprador, meses);
            setModalVentaAbierto(true);
          }}
          className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black font-black text-base rounded-2xl shadow-[0_0_30px_rgba(102,255,0,0.5)] flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-6 h-6" /> + REGISTRAR VENTA / COMBO
        </button>
      </div>

      {/* RESUMEN RÁPIDO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Ventas Hoy ({formatearFechaDMA(hoyBolivia).slice(0, 5)})</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">{ventasDeHoy.length}</p>
        </div>
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Cobrado Hoy</p>
          <p className="text-2xl font-black text-white mt-1">Bs {ingresoDeHoy.toFixed(2)}</p>
        </div>
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Perfiles Libres Stock</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">{cuposLibresTotales}</p>
        </div>
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Revendedores Activos</p>
          <p className="text-2xl font-black text-white mt-1">{revendedores.length}</p>
        </div>
      </div>

      {/* ÚLTIMAS VENTAS */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
        <h3 className="font-extrabold text-sm text-[#66FF00] uppercase flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Ventas Recientes
        </h3>

        {ventasActivas.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs">Aún no hay ventas registradas.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ventasActivas.slice(0, 6).map((v) => (
              <div key={v.id} className="bg-[#070B06] border border-[#1E331A] rounded-2xl p-3.5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                      {v.plataforma}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      v.tipo_comprador === "revendedor" ? "bg-purple-950 text-purple-300 border border-purple-600/40" : "bg-gray-800 text-gray-300"
                    }`}>
                      {v.tipo_comprador === "revendedor" ? "🤝 Revendedor" : "👤 Cliente"}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{v.nombre_cliente}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-1">{v.correo_cuenta}</p>
                  <p className="text-[11px] text-gray-500">
                    Bs {v.precio_venta} · Plan: {v.dias_totales || 30} días · Vence: {formatearFechaDMA(v.fecha_corte)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMensajeGenerado(
                      generarMensajeEntrega(
                        v.nombre_cliente,
                        v.telefono_cliente,
                        [{
                          plataforma: v.plataforma,
                          tipoCuenta: v.tipo_cuenta || "1 Dispositivo",
                          correoFinal: v.correo_cuenta,
                          passFinal: v.password_cuenta,
                          perfilFinal: v.nombre_perfil,
                          pinFinal: v.pin_perfil,
                          meses: v.meses_contratados || 1,
                          diasTotales: v.dias_totales || 30,
                          fechaCorte: v.fecha_corte,
                          precioVenta: v.precio_venta
                        }],
                        linkWhatsappMoss,
                        null,
                        v.tipo_comprador === "revendedor"
                      )
                    )
                  }
                  className="px-3 py-2 bg-[#162614] hover:bg-[#66FF00] text-[#66FF00] hover:text-black border border-[#66FF00]/40 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Mensaje
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR VENTA */}
      {modalVentaAbierto && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <form
            onSubmit={registrarVenta}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-5 sm:p-6 max-w-2xl w-full space-y-4 max-h-[94vh] overflow-y-auto animate-modal"
          >
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <h2 className="text-lg font-black text-[#66FF00] flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" /> Registrar Venta o Armar Combo
              </h2>
              <button type="button" onClick={() => setModalVentaAbierto(false)} className="p-1.5 rounded-xl bg-[#070B06] text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0B120A] border border-[#233820] rounded-2xl p-3.5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cambiarTipoComprador("cliente")}
                  className={`py-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 cursor-pointer ${
                    tipoComprador === "cliente"
                      ? "bg-[#66FF00] text-black border-[#66FF00]"
                      : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                  }`}
                >
                  <UserCheck className="w-4 h-4" /> Venta a Cliente (Catálogo Bs {configPlatActual.precioCliente ?? 20})
                </button>
                <button
                  type="button"
                  onClick={() => cambiarTipoComprador("revendedor")}
                  className={`py-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 cursor-pointer ${
                    tipoComprador === "revendedor"
                      ? "bg-[#66FF00] text-black border-[#66FF00]"
                      : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                  }`}
                >
                  <Users className="w-4 h-4" /> Venta a Revendedor (Atajo Bs {configPlatActual.precioRevendedor ?? 10})
                </button>
              </div>

              {tipoComprador === "revendedor" && (
                <div className="bg-[#111A10] border border-[#66FF00]/40 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#66FF00] flex items-center gap-1">
                      <Users className="w-4 h-4" /> Seleccionar Revendedor
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalNuevoRev(true)}
                      className="px-3 py-1 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/40 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      + Nuevo Revendedor
                    </button>
                  </div>
                  <select
                    value={revendedorId || revendedores[0]?.id || ""}
                    onChange={(e) => handleSelectRevendedor(e.target.value)}
                    className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs"
                  >
                    {revendedores.length === 0 && <option value="">-- Sin revendedores aún (Agrega uno arriba) --</option>}
                    {revendedores.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} — 📞 {r.telefono}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">
                    Teléfono del {tipoComprador === "revendedor" ? "Revendedor" : "Cliente"} *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 77012345"
                    value={telefono}
                    onChange={(e) => handleTelefonoChange(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>Nombre del {tipoComprador === "revendedor" ? "Revendedor" : "Cliente"} *</span>
                    {clienteExistente && tipoComprador === "cliente" && (
                      <span className="text-[#66FF00] text-[10px] font-bold">✓ Reconocido</span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs"
                  />
                </div>
              </div>
            </div>

            {carritoCombo.length > 0 && (
              <div className="bg-[#091208] border-2 border-[#66FF00]/60 rounded-2xl p-3 space-y-2">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-[#66FF00]">Cuentas en Combo ({carritoCombo.length}):</span>
                  <span className="text-white">
                    Subtotal: Bs {carritoCombo.reduce((a, b) => a + Number(b.precioVenta), 0).toFixed(2)}
                  </span>
                </div>
                {carritoCombo.map((item, idx) => (
                  <div key={item.tempId} className="flex justify-between items-center bg-[#111A10] rounded-xl px-3 py-1.5 text-xs">
                    <span className="truncate">
                      <b className="text-[#66FF00]">#{idx + 1} {item.plataforma} ({item.diasTotales}d)</b> — {item.correoFinal}
                    </span>
                    <div className="flex items-center gap-2">
                      <b>Bs {item.precioVenta}</b>
                      <button type="button" onClick={() => setCarritoCombo((p) => p.filter((x) => x.tempId !== item.tempId))} className="text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-[#1E331A]">
              <div className="sm:col-span-4">
                <label className="text-xs text-gray-400">Plataforma (Stock / Prov.)</label>
                <select
                  value={plataforma}
                  onChange={(e) => seleccionarPlataforma(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs font-bold"
                >
                  {plataformasList.map((p) => {
                    const cLibres = contarCuposLibresPlataforma(p.nombre);
                    const infoStock =
                      cLibres > 0
                        ? `🟢 ${cLibres} libre(s)`
                        : p.pidePass === false
                        ? `📩 Invitación`
                        : `⚫ 0 stock (Prov.)`;
                    return (
                      <option key={p.nombre} value={p.nombre}>
                        {p.nombre} — {infoStock}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="sm:col-span-5">
                <label className="text-xs text-[#66FF00] font-bold">Modalidad</label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setTipoCuenta("1 Dispositivo")}
                    className={`py-2.5 px-1 rounded-xl font-bold text-[11px] border cursor-pointer ${
                      tipoCuenta === "1 Dispositivo" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    1 Disp.
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoCuenta("Cuenta Completa")}
                    className={`py-2.5 px-1 rounded-xl font-bold text-[11px] border cursor-pointer ${
                      tipoCuenta === "Cuenta Completa" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Completa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoCuenta("Por Invitación");
                      setOrigen("proveedor");
                    }}
                    className={`py-2.5 px-1 rounded-xl font-bold text-[11px] border cursor-pointer ${
                      tipoCuenta === "Por Invitación" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Invitación
                  </button>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs text-gray-400">Origen</label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <button
                    type="button"
                    disabled={esModoInvitacionActual}
                    onClick={() => setOrigen("stock")}
                    className={`py-2.5 px-1 rounded-xl font-bold text-[11px] border cursor-pointer disabled:opacity-40 ${
                      origen === "stock" && !esModoInvitacionActual ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Stock ({contarCuposLibresPlataforma(plataforma)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrigen("proveedor")}
                    className={`py-2.5 px-1 rounded-xl font-bold text-[11px] border cursor-pointer ${
                      origen === "proveedor" || esModoInvitacionActual ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Proveedor
                  </button>
                </div>
              </div>
            </div>

            {origen === "stock" && !esModoInvitacionActual ? (
              <div className="bg-[#0B120A] border border-[#233820] rounded-xl p-3.5">
                <label className="text-xs text-[#66FF00] font-semibold">Selecciona Matriz Disponible:</label>
                {matricesDisponibles.length === 0 ? (
                  <p className="text-xs text-orange-400 mt-1">Sin stock libre para {plataforma}. Cambia a "Proveedor".</p>
                ) : (
                  <select
                    value={matrizSeleccionadaId || matricesDisponibles[0]?.id || ""}
                    onChange={(e) => setMatrizSeleccionadaId(e.target.value)}
                    className="w-full mt-1.5 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs"
                  >
                    {matricesDisponibles.map((m) => {
                      const sig = obtenerSiguientePerfilLibre(m);
                      const libresCount = obtenerPerfilesLibresDeMatriz(m).length;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.correo} ({libresCount} libres) 👉 {tipoCuenta === "Cuenta Completa" ? "Toda la cuenta" : `${sig?.nombre_perfil} (PIN: ${sig?.pin})`}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            ) : (
              <div className="bg-[#0B120A] border border-[#66FF00]/40 rounded-xl p-3.5 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#66FF00] flex items-center gap-1">
                    <Truck className="w-4 h-4" /> Proveedor
                  </label>
                  <button
                    type="button"
                    onClick={() => setModalNuevoProv(true)}
                    className="px-2.5 py-1 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/40 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    + Nuevo Proveedor
                  </button>
                </div>

                <select
                  value={proveedorSeleccionadoId || proveedores[0]?.id || ""}
                  onChange={(e) => setProveedorSeleccionadoId(e.target.value)}
                  className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs"
                >
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} — 📞 {p.telefono}</option>
                  ))}
                </select>

                {!esModoInvitacionActual && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#66FF00] font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Pegar Mensaje Proveedor (No cambia tu plataforma {plataforma})
                      </span>
                      <button type="button" onClick={pegarDesdePortapapeles} className="px-2.5 py-1 bg-[#66FF00] text-black font-bold rounded-lg text-[11px] cursor-pointer">
                        Pegar Portapapeles
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Pega aquí el mensaje del proveedor..."
                      value={textoProveedorCrudo}
                      onChange={(e) => procesarTextoProveedor(e.target.value)}
                      className="w-full bg-[#070B06] border border-[#233820] rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                )}

                {esModoInvitacionActual ? (
                  <div>
                    <label className="text-xs text-[#66FF00] font-bold">Correo a activar por Invitación *</label>
                    <input
                      type="text"
                      placeholder="cliente@gmail.com"
                      value={provCorreo}
                      onChange={(e) => setProvCorreo(e.target.value)}
                      className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Correo *"
                      value={provCorreo}
                      onChange={(e) => setProvCorreo(e.target.value)}
                      className="bg-[#070B06] border border-[#66FF00] rounded-lg p-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Contraseña"
                      value={provPassword}
                      onChange={(e) => setProvPassword(e.target.value)}
                      className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                    />
                    {configPlatActual.pidePerfil !== false && tipoCuenta !== "Cuenta Completa" && (
                      <input
                        type="text"
                        placeholder="Perfil"
                        value={provPerfil}
                        onChange={(e) => setProvPerfil(e.target.value)}
                        className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                      />
                    )}
                    {configPlatActual.pidePin !== false && tipoCuenta !== "Cuenta Completa" && (
                      <input
                        type="text"
                        placeholder="PIN"
                        value={provPin}
                        onChange={(e) => setProvPin(e.target.value)}
                        className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-orange-300">Costo Pagado hoy al Proveedor (Bs) - Opcional</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 12"
                    value={costoProveedor}
                    onChange={(e) => setCostoProveedor(e.target.value)}
                    className="w-40 mt-1 bg-[#070B06] border border-orange-500/40 rounded-lg p-2 text-xs text-white block"
                  />
                </div>
              </div>
            )}

            {/* PRECIO, PLAN EN MESES O DÍAS Y FECHA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#1E331A]">
              <div>
                <label className="text-xs text-[#66FF00] font-bold">
                  Precio a Cobrar (Bs) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 25"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-white font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-[#66FF00] font-bold">
                  Plan: {diasPersonalizados} días ({meses}M)
                </label>
                <div className="flex gap-1 mt-1">
                  {[
                    { valor: 1, texto: "1M" },
                    { valor: 2, texto: "2M" },
                    { valor: 3, texto: "3M" },
                    { valor: 6, texto: "6M" },
                    { valor: 12, texto: "1A" }
                  ].map((op) => (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => cambiarDuracionMeses(op.valor)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-extrabold border cursor-pointer ${
                        Number(meses) === op.valor ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                      }`}
                    >
                      {op.texto}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <div>
                    <span className="text-[10px] text-gray-400">O escribe Meses:</span>
                    <input
                      type="number"
                      min="1"
                      value={meses}
                      onChange={(e) => cambiarDuracionMeses(e.target.value)}
                      className="w-full bg-[#070B06] border border-[#2A4226] rounded-lg px-2 py-1 text-xs text-white text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#66FF00]">O escribe Días:</span>
                    <input
                      type="number"
                      min="1"
                      value={diasPersonalizados}
                      onChange={(e) => cambiarDuracionDias(e.target.value)}
                      className="w-full bg-[#070B06] border border-[#66FF00] rounded-lg px-2 py-1 text-xs text-white font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#66FF00] font-bold">Fecha Bolivia ({formatearFechaDMA(fechaVenta)})</label>
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => seleccionarModoFecha("hoy")}
                    className={`px-2 py-2 rounded-xl text-xs font-bold border ${
                      modoFecha === "hoy" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => seleccionarModoFecha("ayer")}
                    className={`px-2 py-2 rounded-xl text-xs font-bold border ${
                      modoFecha === "ayer" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Ayer
                  </button>
                  <input
                    type="date"
                    value={fechaVenta}
                    onChange={(e) => {
                      setModoFecha("otra");
                      setFechaVenta(e.target.value);
                    }}
                    className="flex-1 bg-[#070B06] border border-[#2A4226] rounded-xl px-1 text-[11px] text-white"
                  />
                </div>
              </div>
            </div>

            {/* BLOQUE ESPECIAL SI PAGÓ MÁS DE 3 MESES (> 90 DÍAS): CONTROL DE ADELANTO AL PROVEEDOR */}
            {Number(diasPersonalizados) > 90 && (
              <div className="bg-amber-950/30 border-2 border-amber-500/60 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-amber-300">
                    📦 Plan largo ({diasPersonalizados} días): ¿Cuántos meses le cancelaste hoy al proveedor?
                  </p>
                  <p className="text-[11px] text-gray-300">
                    El sistema te agendará renovar con el proveedor el{" "}
                    <b className="text-white">
                      {formatearFechaDMA(sumarDiasBoliviaISO(Number(mesesPagadosProv || 3) * 30, fechaVenta || obtenerFechaBoliviaISO()))}
                    </b>{" "}
                    para completar los {diasPersonalizados} días del cliente.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-300 font-bold">Meses pagados a Prov:</span>
                  <input
                    type="number"
                    min="1"
                    value={mesesPagadosProv}
                    onChange={(e) => setMesesPagadosProv(e.target.value)}
                    className="w-16 bg-[#070B06] border border-amber-400 rounded-xl p-2 text-center text-white font-black text-xs"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={agregarCuentaAlCombo}
              className="w-full py-2 bg-[#162614] text-[#66FF00] border border-dashed border-[#66FF00]/60 rounded-xl text-xs font-extrabold cursor-pointer"
            >
              + Añadir al Combo y elegir otra cuenta
            </button>

            <div className="flex gap-3 pt-2 border-t border-[#1E331A]">
              <button
                type="button"
                onClick={() => {
                  setModalVentaAbierto(false);
                  setCarritoCombo([]);
                }}
                className="px-5 py-2.5 bg-gray-800 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 py-2.5 bg-[#66FF00] text-black font-black rounded-xl text-xs sm:text-sm cursor-pointer"
              >
                {guardando
                  ? "Registrando..."
                  : carritoCombo.length > 0
                  ? `Confirmar Combo (Bs ${totalAcumuladoCombo.toFixed(2)})`
                  : "Confirmar Venta y Obtener Mensaje"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NUEVO REVENDEDOR */}
      {modalNuevoRev && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[60]">
          <form onSubmit={guardarNuevoRevendedor} className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-black text-[#66FF00] flex items-center gap-2">
              <Users className="w-5 h-5" /> Registrar Nuevo Revendedor
            </h3>
            <input
              type="text"
              placeholder="Nombre del Revendedor"
              value={nuevoRevNombre}
              onChange={(e) => setNuevoRevNombre(e.target.value)}
              className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Teléfono / WhatsApp"
              value={nuevoRevTelefono}
              onChange={(e) => setNuevoRevTelefono(e.target.value)}
              className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-xs text-white"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalNuevoRev(false)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                Guardar Revendedor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NUEVO PROVEEDOR */}
      {modalNuevoProv && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[60]">
          <form onSubmit={guardarNuevoProveedor} className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-black text-[#66FF00] flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Registrar Proveedor
            </h3>
            <input
              type="text"
              placeholder="Nombre del Proveedor"
              value={nuevoProvNombre}
              onChange={(e) => setNuevoProvNombre(e.target.value)}
              className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Teléfono / WhatsApp"
              value={nuevoProvTelefono}
              onChange={(e) => setNuevoProvTelefono(e.target.value)}
              className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-xs text-white"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalNuevoProv(false)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                Guardar Proveedor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL MENSAJE DE ENTREGA */}
      {mensajeGenerado && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#66FF00] font-black text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> ¡Mensaje Lista para {mensajeGenerado.cliente}!
              </h3>
              <button onClick={() => setMensajeGenerado(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              readOnly
              rows={10}
              value={mensajeGenerado.completo}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-2xl p-3 text-xs text-gray-200 font-mono"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mensajeGenerado.completo);
                  notificar("¡Mensaje copiado!");
                }}
                className="py-3 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/50 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Copiar Mensaje
              </button>
              <button
                onClick={() => {
                  if (navigator.share) navigator.share({ text: mensajeGenerado.resumido });
                  else {
                    navigator.clipboard.writeText(mensajeGenerado.resumido);
                    notificar("Resumen copiado");
                  }
                }}
                className="py-3 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" /> Compartir (Celular)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}