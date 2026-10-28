"use client";
import React, { useState, useEffect } from "react";
import { supabase, PLATAFORMAS, formatearFechaDMA } from "@/config";
import { extraerDatosProveedor } from "@/utils/extractorProveedor";
import {
  ShoppingBag,
  Copy,
  Share2,
  CheckCircle2,
  UserCheck,
  Sparkles,
  ClipboardPaste,
  UserPlus,
  Truck,
  PlusCircle,
  X,
  Zap,
  Calendar,
  MessageSquare,
  Layers,
  Trash2,
  Monitor,
  Crown,
  MailCheck
} from "lucide-react";

export default function ModuloVentas({
  matrices = [],
  clientes = [],
  proveedores = [],
  suscripciones = [],
  linkWhatsappMoss = "",
  plataformasList = PLATAFORMAS,
  recargarTodo,
  notificar
}) {
  const [modalVentaAbierto, setModalVentaAbierto] = useState(false);
  const [modalNuevoProv, setModalNuevoProv] = useState(false);

  const [telefono, setTelefono] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [clienteExistente, setClienteExistente] = useState(false);

  const [carritoCombo, setCarritoCombo] = useState([]);

  const [plataforma, setPlataforma] = useState("Netflix");
  const [tipoCuenta, setTipoCuenta] = useState("1 Dispositivo"); // '1 Dispositivo' | 'Cuenta Completa' | 'Por Invitación'
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
  const [modoFecha, setModoFecha] = useState("hoy");
  const [fechaVenta, setFechaVenta] = useState("");

  const [mensajeGenerado, setMensajeGenerado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setFechaVenta(new Date().toISOString().split("T")[0]);
  }, []);

  const configPlatActual =
    plataformasList.find((p) => p.nombre === plataforma) || {
      nombre: plataforma,
      pidePass: true,
      pidePerfil: true,
      pidePin: true
    };

  // Al elegir plataforma, si la app está configurada como "Sin Clave / Invitación" (ej: Gemini Pro), se pone automático en "Por Invitación"
  const seleccionarPlataforma = (nombrePlat, libresPlat = 0) => {
    setPlataforma(nombrePlat);
    setMatrizSeleccionadaId("");
    const cfg = plataformasList.find((p) => p.nombre === nombrePlat);
    if (cfg && cfg.pidePass === false) {
      setTipoCuenta("Por Invitación");
      setOrigen("proveedor");
    } else {
      if (tipoCuenta === "Por Invitación") setTipoCuenta("1 Dispositivo");
      setOrigen(libresPlat > 0 ? "stock" : "proveedor");
    }
  };

  const armarMensajesMultiples = (nombre, tel, listaItems) => {
    const bloqueOfertas = linkWhatsappMoss?.trim()
      ? `\n\n🎁 *Únete a nuestra comunidad de ofertas y sorteos MOSS:*\n${linkWhatsappMoss.trim()}`
      : "";

    const esCombo = listaItems.length > 1;
    const totalCobrado = listaItems.reduce((acc, item) => acc + Number(item.precioVenta || 0), 0);

    const bloquesCompletos = listaItems
      .map((item, idx) => {
        const textoMeses =
          Number(item.meses) === 12
            ? "1 año (12 meses)"
            : Number(item.meses) === 1
            ? "1 mes"
            : `${item.meses} meses`;

        const fechaFormateada = formatearFechaDMA(item.fechaCorte);
        const esInv = item.tipoCuenta === "Por Invitación" || !item.passFinal;

        const modalidadTexto =
          item.tipoCuenta === "Cuenta Completa"
            ? "👑 Cuenta Completa"
            : esInv
            ? "📩 Activación por Invitación"
            : "👤 1 Dispositivo / Perfil";

        const titulo = esCombo
          ? `🔹 *CUENTA #${idx + 1}: ${item.plataforma.toUpperCase()} (${modalidadTexto})*`
          : `📺 *Plataforma:* ${item.plataforma} (${modalidadTexto})`;

        const etiquetaCorreo = esInv ? "📧 *Correo del cliente activado:*" : "📧 *Correo / Usuario:*";
        const lineaPass = item.passFinal && !esInv ? `\n🔑 *Contraseña:* ${item.passFinal}` : "";
        const lineaPerfil =
          item.tipoCuenta === "Cuenta Completa"
            ? `\n👑 *Acceso:* Cuenta Completa`
            : esInv
            ? `\n✅ *Estado:* Invitación enviada / activada en tu correo personal`
            : item.perfilFinal &&
              item.perfilFinal !== "1 Dispositivo" &&
              item.perfilFinal !== "Por Invitación" &&
              item.perfilFinal !== "Cuenta / Invitación"
            ? `\n👤 *Perfil asignado:* ${item.perfilFinal}`
            : "";
        const lineaPin =
          item.pinFinal && item.tipoCuenta === "1 Dispositivo" ? `\n📌 *PIN del perfil:* ${item.pinFinal}` : "";

        return `${titulo}\n${etiquetaCorreo} ${item.correoFinal}${lineaPass}${lineaPerfil}${lineaPin}\n⏳ *Plan contratado:* ${textoMeses}\n📅 *Fecha de vencimiento:* ${fechaFormateada}`;
      })
      .join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

    const encabezado = esCombo
      ? `🌿 *MOSS STREAMING - ENTREGA DE COMBO (${listaItems.length} CUENTAS)*`
      : `🌿 *MOSS STREAMING - ENTREGA DE SUSCRIPCIÓN*`;

    const lineaTotalCombo = esCombo ? `\n\n💰 *Total Combo Pagado:* Bs ${totalCobrado.toFixed(2)}` : "";

    const msgCompleto = `${encabezado}\n\n¡Hola *${nombre}*! Aquí tienes los datos de tu suscripción:\n\n${bloquesCompletos}${lineaTotalCombo}\n\n_¡Gracias por tu preferencia!_${bloqueOfertas}`;

    const bloquesResumidos = listaItems
      .map((item, idx) => {
        const textoMeses =
          Number(item.meses) === 12
            ? "1 año"
            : Number(item.meses) === 1
            ? "1 mes"
            : `${item.meses} meses`;
        const fechaFormateada = formatearFechaDMA(item.fechaCorte);
        const esInv = item.tipoCuenta === "Por Invitación" || !item.passFinal;
        const lineaPass = item.passFinal && !esInv ? `\n🔑 Clave: ${item.passFinal}` : "";
        const lineaPerfil =
          item.tipoCuenta === "Cuenta Completa"
            ? `\n👑 Modalidad: Cuenta Completa`
            : esInv
            ? `\n📩 Modalidad: Activación por Invitación`
            : item.perfilFinal &&
              item.perfilFinal !== "1 Dispositivo" &&
              item.perfilFinal !== "Por Invitación"
            ? `\n👤 Perfil: ${item.perfilFinal}${item.pinFinal ? ` | PIN: ${item.pinFinal}` : ""}`
            : `\n👤 Modalidad: 1 Dispositivo`;

        return `*${esCombo ? `${idx + 1}. ` : ""}${item.plataforma} (MOSS)*\n📧 Correo: ${item.correoFinal}${lineaPass}${lineaPerfil}\n📅 Vence (${textoMeses}): ${fechaFormateada}`;
      })
      .join("\n\n");

    const msgResumido = `${bloquesResumidos}${
      linkWhatsappMoss?.trim() ? `\n\n🎁 Ofertas MOSS: ${linkWhatsappMoss.trim()}` : ""
    }`;

    return {
      completo: msgCompleto,
      resumido: msgResumido,
      telefono: tel,
      cliente: nombre
    };
  };

  const guardarNuevoProveedor = async (e) => {
    e.preventDefault();
    if (!nuevoProvNombre.trim() || !nuevoProvTelefono.trim()) {
      return notificar("Ingresa el nombre y el número del proveedor", "error");
    }
    const { data, error } = await supabase
      .from("proveedores")
      .insert([{
        nombre: nuevoProvNombre.trim(),
        telefono: nuevoProvTelefono.trim()
      }])
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

  const procesarTextoProveedor = (texto) => {
    setTextoProveedorCrudo(texto);
    const extraido = extraerDatosProveedor(texto, plataformasList);
    if (extraido.plataforma) seleccionarPlataforma(extraido.plataforma);
    if (extraido.correo) setProvCorreo(extraido.correo);
    if (extraido.password) setProvPassword(extraido.password);
    if (extraido.perfil) setProvPerfil(extraido.perfil);
    if (extraido.pin) setProvPin(extraido.pin);

    if (texto.toUpperCase().includes("COMPLETA")) {
      setTipoCuenta("Cuenta Completa");
    }
    notificar("Datos extraídos automáticamente");
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
    const d = new Date();
    if (modo === "hoy") {
      setFechaVenta(d.toISOString().split("T")[0]);
    } else if (modo === "ayer") {
      d.setDate(d.getDate() - 1);
      setFechaVenta(d.toISOString().split("T")[0]);
    }
  };

  const perfilesEnCarritoIds = carritoCombo
    .map((item) => item.perfilIdUsado)
    .filter(Boolean);

  const obtenerPerfilesLibresDeMatriz = (matriz) => {
    if (!matriz || !matriz.perfiles_matriz) return [];
    const libres = matriz.perfiles_matriz.filter(
      (p) => !p.ocupado && !perfilesEnCarritoIds.includes(p.id)
    );
    libres.sort((a, b) => {
      if (a.es_extra_final !== b.es_extra_final) return a.es_extra_final ? 1 : -1;
      return a.numero_slot - b.numero_slot;
    });
    return libres;
  };

  const matricesDisponibles = matrices.filter((m) => {
    if (m.en_papelera || m.estado !== "Activa") return false;
    if (m.plataforma !== plataforma) return false;
    const libres = obtenerPerfilesLibresDeMatriz(m);
    return libres.length > 0;
  });

  const obtenerSiguientePerfilLibre = (matriz) => {
    const libres = obtenerPerfilesLibresDeMatriz(matriz);
    return libres[0] || null;
  };

  const calcularDiasPorMeses = (cantMeses) => {
    const m = Number(cantMeses);
    return m === 12 ? 365 : m * 30;
  };

  const armarItemActualFormulario = () => {
    if (precioVenta === "" || Number(precioVenta) < 0) {
      notificar("Ingresa el precio de venta de esta cuenta", "error");
      return null;
    }

    let correoFinal = "";
    let passFinal = "";
    let perfilFinal = "";
    let pinFinal = "";
    let perfilIdUsado = null;
    let matrizIdUsada = null;
    let costoFinal = 0;
    let provIdFinal = null;
    let provNombreFinal = null;
    let provTelFinal = null;

    const esModoInvitacion = tipoCuenta === "Por Invitación" || configPlatActual.pidePass === false;

    if (origen === "stock" && !esModoInvitacion) {
      const matrizObj =
        matricesDisponibles.find((m) => m.id === matrizSeleccionadaId) ||
        matricesDisponibles[0];
      if (!matrizObj) {
        notificar("No tienes stock libre en esta plataforma", "error");
        return null;
      }
      const slotLibre = obtenerSiguientePerfilLibre(matrizObj);
      if (!slotLibre) {
        notificar("Esta matriz ya no tiene perfiles libres", "error");
        return null;
      }

      correoFinal = matrizObj.correo;
      passFinal = matrizObj.password;
      perfilFinal = tipoCuenta === "Cuenta Completa" ? "Cuenta Completa" : slotLibre.nombre_perfil;
      pinFinal = tipoCuenta === "Cuenta Completa" ? "" : slotLibre.pin;
      perfilIdUsado = slotLibre.id;
      matrizIdUsada = matrizObj.id;
      costoFinal = 0;
      provIdFinal = matrizObj.proveedor_id || null;
      provNombreFinal = matrizObj.nombre_proveedor || null;
      provTelFinal = matrizObj.telefono_proveedor || null;
    } else {
      if (!provCorreo.trim()) {
        notificar(
          esModoInvitacion
            ? "Ingresa el correo del cliente para la invitación"
            : "Ingresa al menos el Correo o Usuario",
          "error"
        );
        return null;
      }
      const provObj =
        proveedores.find((p) => p.id === proveedorSeleccionadoId) ||
        proveedores[0] ||
        null;

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

    const diasTotales = calcularDiasPorMeses(meses);
    const fechaBaseStr = fechaVenta || new Date().toISOString().split("T")[0];
    const fechaObj = new Date(fechaBaseStr + "T12:00:00");
    fechaObj.setDate(fechaObj.getDate() + diasTotales);
    const fechaCorte = fechaObj.toISOString().split("T")[0];

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
      fechaVenta: fechaBaseStr,
      fechaCorte
    };
  };

  const limpiarCamposCuentaActual = () => {
    setPrecioVenta("");
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
    notificar(`${nuevoItem.plataforma} (${nuevoItem.tipoCuenta}) añadida al Combo`);
  };

  const quitarDelCombo = (tempId) => {
    setCarritoCombo((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const registrarVenta = async (e) => {
    e.preventDefault();
    if (!telefono.trim() || !nombreCliente.trim()) {
      return notificar("Completa teléfono y nombre del cliente", "error");
    }

    let itemsParaGuardar = [...carritoCombo];

    const hayDatosEnFormularioActual =
      precioVenta !== "" && (origen === "stock" || provCorreo.trim() !== "");

    if (itemsParaGuardar.length === 0 || hayDatosEnFormularioActual) {
      const itemActual = armarItemActualFormulario();
      if (!itemActual) return;
      itemsParaGuardar.push(itemActual);
    }

    if (itemsParaGuardar.length === 0) {
      return notificar("Agrega al menos una cuenta para vender", "error");
    }

    setGuardando(true);
    try {
      let clienteId = null;
      const { data: cliData } = await supabase
        .from("clientes")
        .upsert([{ telefono: telefono.trim(), nombre: nombreCliente.trim() }], { onConflict: "telefono" })
        .select()
        .single();
      if (cliData) clienteId = cliData.id;

      for (const item of itemsParaGuardar) {
        const { data: nuevaSub, error: errSub } = await supabase
          .from("suscripciones")
          .insert([{
            cliente_id: clienteId,
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
            fecha_venta: item.fechaVenta,
            fecha_corte: item.fechaCorte,
            estado: "Activa"
          }])
          .select()
          .single();

        if (errSub) throw errSub;

        if (item.origen === "stock" && item.matrizIdUsada) {
          if (item.tipoCuenta === "Cuenta Completa") {
            await supabase
              .from("perfiles_matriz")
              .update({ ocupado: true })
              .eq("matriz_id", item.matrizIdUsada);
          } else if (item.perfilIdUsado) {
            await supabase
              .from("perfiles_matriz")
              .update({ ocupado: true })
              .eq("id", item.perfilIdUsado);
          }
        }

        const etiquetaCombo = itemsParaGuardar.length > 1 ? " [Combo]" : "";
        const etiquetaDuracion = Number(item.meses) === 12 ? "1 Año" : `${item.meses}M`;

        await supabase.from("movimientos_yolo").insert([{
          tipo: "Ingreso Venta",
          monto: Math.abs(Number(item.precioVenta)),
          afecta_ganancia_neta: true,
          descripcion: `Venta${etiquetaCombo} ${item.plataforma} (${item.tipoCuenta}) a ${nombreCliente.trim()} (${etiquetaDuracion})`,
          referencia_id: nuevaSub.id
        }]);

        if (item.origen === "proveedor" && item.costoFinal > 0) {
          await supabase.from("movimientos_yolo").insert([{
            tipo: "Costo Proveedor",
            monto: -Math.abs(item.costoFinal),
            afecta_ganancia_neta: true,
            descripcion: `Pago a proveedor ${item.provNombreFinal} por ${item.plataforma} (${nombreCliente.trim()})`,
            referencia_id: nuevaSub.id
          }]);
        }
      }

      const objetoMensajes = armarMensajesMultiples(
        nombreCliente.trim(),
        telefono.trim(),
        itemsParaGuardar
      );

      setModalVentaAbierto(false);
      setMensajeGenerado(objetoMensajes);

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

  const ventasActivas = suscripciones.filter((s) => !s.en_papelera);
  const ventasDeHoy = fechaVenta ? ventasActivas.filter((s) => s.fecha_venta === fechaVenta) : [];
  const ingresoDeHoy = ventasDeHoy.reduce((acc, s) => acc + Number(s.precio_venta || 0), 0);

  const cuposLibresTotales = matrices
    .filter((m) => !m.en_papelera && m.estado === "Activa")
    .reduce((acc, m) => acc + (m.perfiles_matriz || []).filter((p) => !p.ocupado).length, 0);

  const totalAcumuladoCombo =
    carritoCombo.reduce((acc, item) => acc + Number(item.precioVenta || 0), 0) +
    (precioVenta !== "" ? Number(precioVenta) : 0);

  const esModoInvitacionActual =
    tipoCuenta === "Por Invitación" || configPlatActual.pidePass === false;

  return (
    <div className="space-y-6">
      {/* BANNER PRINCIPAL HERO */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#162914] via-[#101D0E] to-[#0B140A] border-2 border-[#66FF00]/60 rounded-3xl p-6 shadow-[0_0_35px_rgba(102,255,0,0.15)] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#66FF00]/20 text-[#66FF00] border border-[#66FF00]/40">
            <Zap className="w-3.5 h-3.5" /> Centro Rápido de Ventas & Combos MOSS
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            ¿Nueva venta o Combo para entregar?
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 max-w-xl">
            Toca cualquier plataforma abajo para abrir la ventana emergente. Puedes vender <b>1 Dispositivo</b>, <b>Cuenta Completa</b> o <b>Por Invitación</b> (1M, 2M, 3M o 1 Año).
          </p>

          <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
            {plataformasList.map((p) => {
              const libresPlat = matrices
                .filter((m) => !m.en_papelera && m.estado === "Activa" && m.plataforma === p.nombre)
                .reduce((acc, m) => acc + (m.perfiles_matriz || []).filter((pf) => !pf.ocupado).length, 0);

              return (
                <button
                  key={p.nombre}
                  type="button"
                  onClick={() => {
                    seleccionarPlataforma(p.nombre, libresPlat);
                    setModalVentaAbierto(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#070B06]/90 hover:bg-[#66FF00] hover:text-black border border-[#2A4226] hover:border-[#66FF00] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{p.nombre}</span>
                  {p.pidePass === false ? (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-950/80 text-blue-300">
                      Invitación
                    </span>
                  ) : (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] ${libresPlat > 0 ? "bg-[#66FF00]/20 text-[#66FF00]" : "bg-gray-800 text-gray-400"}`}>
                      {libresPlat} stock
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalVentaAbierto(true)}
          className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-[#66FF00] to-[#4CE600] hover:brightness-110 text-black font-black text-base rounded-2xl shadow-[0_0_30px_rgba(102,255,0,0.5)] flex items-center justify-center gap-2.5 shrink-0 transition transform hover:scale-105 cursor-pointer"
        >
          <PlusCircle className="w-6 h-6" /> + REGISTRAR VENTA / COMBO
        </button>
      </div>

      {/* MINI TARJETAS DE ACTIVIDAD DEL DÍA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111A10]/90 border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Ventas de Hoy</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">{ventasDeHoy.length}</p>
        </div>
        <div className="bg-[#111A10]/90 border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Cobrado Hoy</p>
          <p className="text-2xl font-black text-white mt-1">Bs {ingresoDeHoy.toFixed(2)}</p>
        </div>
        <div className="bg-[#111A10]/90 border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Perfiles Libres Stock</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">{cuposLibresTotales}</p>
        </div>
        <div className="bg-[#111A10]/90 border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Clientes Registrados</p>
          <p className="text-2xl font-black text-white mt-1">{clientes.length}</p>
        </div>
      </div>

      {/* ÚLTIMAS VENTAS RECIENTES */}
      <div className="bg-[#111A10]/90 border border-[#233820] rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-sm text-[#66FF00] uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Últimas Ventas Registradas
          </h3>
          <span className="text-xs text-gray-400">Mostrando las 6 más recientes</span>
        </div>

        {ventasActivas.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aún no hay ventas registradas. Pulsa el botón verde <b>+ REGISTRAR VENTA / COMBO</b> arriba para empezar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ventasActivas.slice(0, 6).map((v) => (
              <div
                key={v.id}
                className="bg-[#070B06] border border-[#1E331A] hover:border-[#66FF00]/50 transition rounded-2xl p-3.5 flex justify-between items-center gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                      {v.plataforma}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-800 text-gray-300">
                      {v.tipo_cuenta || "1 Dispositivo"}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{v.nombre_cliente}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-1">
                    {v.correo_cuenta} {v.nombre_proveedor ? `· Prov: ${v.nombre_proveedor}` : ""}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Bs {v.precio_venta} · Vence: {formatearFechaDMA(v.fecha_corte)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMensajeGenerado(
                      armarMensajesMultiples(v.nombre_cliente, v.telefono_cliente, [
                        {
                          plataforma: v.plataforma,
                          tipoCuenta: v.tipo_cuenta || "1 Dispositivo",
                          correoFinal: v.correo_cuenta,
                          passFinal: v.password_cuenta,
                          perfilFinal: v.nombre_perfil,
                          pinFinal: v.pin_perfil,
                          meses: v.meses_contratados || 1,
                          fechaCorte: v.fecha_corte,
                          precioVenta: v.precio_venta
                        }
                      ])
                    )
                  }
                  className="px-3 py-2 bg-[#162614] hover:bg-[#66FF00] text-[#66FF00] hover:text-black border border-[#66FF00]/40 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Ver Mensaje
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* VENTANA EMERGENTE 1: FORMULARIO DE VENTA INDIVIDUAL O COMBO       */}
      {/* ================================================================= */}
      {modalVentaAbierto && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <form
            onSubmit={registrarVenta}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-5 sm:p-6 max-w-2xl w-full space-y-5 shadow-[0_0_60px_rgba(102,255,0,0.25)] max-h-[94vh] overflow-y-auto animate-modal"
          >
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h2 className="text-lg font-black text-[#66FF00] flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" /> Registrar Venta o Armar Combo
                </h2>
                <p className="text-[11px] text-gray-400">
                  Elige 1 Dispositivo, Cuenta Completa o Por Invitación (1M, 2M, 3M o 1 Año).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalVentaAbierto(false)}
                className="p-1.5 rounded-xl bg-[#070B06] text-gray-400 hover:text-white border border-[#233820] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DATOS DEL CLIENTE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400">Teléfono del Cliente *</label>
                <input
                  type="text"
                  placeholder="Ej: 77012345"
                  value={telefono}
                  onChange={(e) => handleTelefonoChange(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white focus:border-[#66FF00] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 flex items-center justify-between">
                  <span>Nombre del Cliente *</span>
                  {clienteExistente && (
                    <span className="text-[#66FF00] flex items-center gap-1 text-[11px] font-bold">
                      <UserCheck className="w-3.5 h-3.5" /> Reconocido
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="Nombre y Apellido"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white focus:border-[#66FF00] outline-none"
                />
              </div>
            </div>

            {carritoCombo.length > 0 && (
              <div className="bg-[#091208] border-2 border-[#66FF00]/60 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold text-[#66FF00] flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> Cuentas en este Combo ({carritoCombo.length}):
                  </span>
                  <span className="text-xs font-black text-white">
                    Subtotal Combo: Bs {carritoCombo.reduce((a, b) => a + Number(b.precioVenta), 0).toFixed(2)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {carritoCombo.map((item, idx) => (
                    <div
                      key={item.tempId}
                      className="flex items-center justify-between bg-[#111A10] border border-[#233820] rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="truncate pr-2">
                        <span className="font-black text-[#66FF00]">
                          #{idx + 1} {item.plataforma} ({item.tipoCuenta})
                        </span>{" "}
                        <span className="text-gray-300">
                          — {item.correoFinal} · Vence: {formatearFechaDMA(item.fechaCorte)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-white">Bs {item.precioVenta}</span>
                        <button
                          type="button"
                          onClick={() => quitarDelCombo(item.tempId)}
                          className="text-gray-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PLATAFORMA, MODALIDAD (1 DISPOSITIVO / COMPLETA / INVITACIÓN) Y ORIGEN */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-[#1E331A]">
              <div className="sm:col-span-4">
                <label className="text-xs text-gray-400">Plataforma</label>
                <select
                  value={plataforma}
                  onChange={(e) => seleccionarPlataforma(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-xs font-bold"
                >
                  {plataformasList.map((p) => (
                    <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5">
                <label className="text-xs text-[#66FF00] font-bold">Modalidad de Entrega</label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setTipoCuenta("1 Dispositivo")}
                    className={`py-2.5 px-1.5 rounded-xl font-bold text-[11px] border flex items-center justify-center gap-1 cursor-pointer ${
                      tipoCuenta === "1 Dispositivo"
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    <Monitor className="w-3 h-3" /> 1 Disp.
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoCuenta("Cuenta Completa")}
                    className={`py-2.5 px-1.5 rounded-xl font-bold text-[11px] border flex items-center justify-center gap-1 cursor-pointer ${
                      tipoCuenta === "Cuenta Completa"
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    <Crown className="w-3 h-3" /> Completa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoCuenta("Por Invitación");
                      setOrigen("proveedor");
                    }}
                    className={`py-2.5 px-1.5 rounded-xl font-bold text-[11px] border flex items-center justify-center gap-1 cursor-pointer ${
                      tipoCuenta === "Por Invitación"
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    <MailCheck className="w-3 h-3" /> Invitación
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
                    className={`py-2.5 px-1.5 rounded-xl font-bold text-[11px] border cursor-pointer disabled:opacity-40 ${
                      origen === "stock" && !esModoInvitacionActual
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Stock ({matricesDisponibles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrigen("proveedor")}
                    className={`py-2.5 px-1.5 rounded-xl font-bold text-[11px] border cursor-pointer ${
                      origen === "proveedor" || esModoInvitacionActual
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    {esModoInvitacionActual ? "Invitación" : "Proveedor"}
                  </button>
                </div>
              </div>
            </div>

            {origen === "stock" && !esModoInvitacionActual ? (
              <div className="bg-[#0B120A] border border-[#233820] rounded-xl p-4">
                <label className="text-xs text-[#66FF00] font-semibold">
                  Selecciona Matriz con Espacio Disponible ({tipoCuenta}):
                </label>
                {matricesDisponibles.length === 0 ? (
                  <p className="text-xs text-orange-400 mt-1">
                    No tienes matrices con perfiles libres para {plataforma}. Cambia el botón a "Proveedor" o añade una matriz en Stock.
                  </p>
                ) : (
                  <select
                    value={matrizSeleccionadaId || matricesDisponibles[0]?.id || ""}
                    onChange={(e) => setMatrizSeleccionadaId(e.target.value)}
                    className="w-full mt-2 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-sm"
                  >
                    {matricesDisponibles.map((m) => {
                      const sig = obtenerSiguientePerfilLibre(m);
                      const libresCount = obtenerPerfilesLibresDeMatriz(m).length;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.correo} — ({libresCount} libres) 👉{" "}
                          {tipoCuenta === "Cuenta Completa"
                            ? "Ocupará toda la cuenta"
                            : `Asignará: ${sig?.nombre_perfil} (PIN: ${sig?.pin})`}{" "}
                          | Vence: {formatearFechaDMA(m.fecha_corte_matriz)}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            ) : (
              <div className="bg-[#0B120A] border border-[#66FF00]/40 rounded-xl p-4 space-y-4">
                <div className="bg-[#111A10] border border-[#233820] rounded-xl p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#66FF00] flex items-center gap-1.5">
                      <Truck className="w-4 h-4" /> Seleccionar Proveedor
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalNuevoProv(true)}
                      className="px-3 py-1 bg-[#1A2B18] hover:bg-[#253D22] text-[#66FF00] border border-[#66FF00]/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> + Nuevo Proveedor
                    </button>
                  </div>

                  <select
                    value={proveedorSeleccionadoId || proveedores[0]?.id || ""}
                    onChange={(e) => setProveedorSeleccionadoId(e.target.value)}
                    className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white text-sm"
                  >
                    {proveedores.length === 0 && <option value="">-- Sin proveedor --</option>}
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — 📞 {p.telefono}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SOLO MOSTRAR EXTRACTOR SI NO ES POR INVITACIÓN */}
                {!esModoInvitacionActual && (
                  <div className="bg-[#111A10] border border-[#2A4226] rounded-xl p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-[#66FF00] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> Pegar Mensaje del Proveedor (Autocompleta)
                      </label>
                      <button
                        type="button"
                        onClick={pegarDesdePortapapeles}
                        className="px-3 py-1 bg-[#66FF00] text-black font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" /> Pegar Portapapeles
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Pega aquí el mensaje que te mandó el proveedor..."
                      value={textoProveedorCrudo}
                      onChange={(e) => procesarTextoProveedor(e.target.value)}
                      className="w-full bg-[#070B06] border border-[#233820] rounded-lg p-2 text-xs text-gray-200 focus:border-[#66FF00] outline-none"
                    />
                  </div>
                )}

                {/* SI ES POR INVITACIÓN (EJ. GEMINI PRO): SOLO PIDE EL CORREO DEL CLIENTE */}
                {esModoInvitacionActual ? (
                  <div className="bg-[#111A10] border-2 border-[#66FF00]/60 rounded-xl p-3.5 space-y-1.5">
                    <label className="text-xs text-[#66FF00] font-extrabold flex items-center gap-1.5">
                      <MailCheck className="w-4 h-4" /> Correo del Cliente (donde se activó la invitación de {plataforma}) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: cliente@gmail.com"
                      value={provCorreo}
                      onChange={(e) => setProvCorreo(e.target.value)}
                      className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                ) : (
                  /* SI ES CUENTA CON CREDENCIALES: MUESTRA LOS CAMPOS QUE CORRESPONDA */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[11px] text-[#66FF00] font-bold">
                        1. Correo / Usuario *
                      </label>
                      <input
                        type="text"
                        placeholder="correo@cuenta.com"
                        value={provCorreo}
                        onChange={(e) => setProvCorreo(e.target.value)}
                        className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-lg p-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-400">2. Contraseña (Opc.)</label>
                      <input
                        type="text"
                        placeholder="Contraseña"
                        value={provPassword}
                        onChange={(e) => setProvPassword(e.target.value)}
                        className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                      />
                    </div>

                    {configPlatActual.pidePerfil !== false && tipoCuenta !== "Cuenta Completa" && (
                      <div>
                        <label className="text-[11px] text-gray-400">3. Perfil (Opc.)</label>
                        <input
                          type="text"
                          placeholder="Ej: Perfil 5"
                          value={provPerfil}
                          onChange={(e) => setProvPerfil(e.target.value)}
                          className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    )}

                    {configPlatActual.pidePin !== false && tipoCuenta !== "Cuenta Completa" && (
                      <div>
                        <label className="text-[11px] text-gray-400">4. PIN (Opc.)</label>
                        <input
                          type="text"
                          placeholder="Ej: 9472"
                          value={provPin}
                          onChange={(e) => setProvPin(e.target.value)}
                          className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs text-orange-300">Costo del Proveedor (Bs) - Opcional</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 12"
                    value={costoProveedor}
                    onChange={(e) => setCostoProveedor(e.target.value)}
                    className="w-full sm:w-44 mt-1 bg-[#070B06] border border-orange-500/40 rounded-lg p-2 text-xs text-white block"
                  />
                </div>
              </div>
            )}

            {/* PRECIO, MESES (CON BOTÓN 1 AÑO) Y FECHA DE VENTA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#1E331A]">
              <div>
                <label className="text-xs text-gray-400">Precio de esta Cuenta (Bs) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 25"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">
                  Duración ({calcularDiasPorMeses(meses)} días)
                </label>
                <div className="flex gap-1 mt-1">
                  {[
                    { valor: 1, texto: "1M" },
                    { valor: 2, texto: "2M" },
                    { valor: 3, texto: "3M" },
                    { valor: 12, texto: "1 Año" }
                  ].map((op) => (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => setMeses(op.valor)}
                      className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-extrabold border cursor-pointer ${
                        Number(meses) === op.valor
                          ? "bg-[#66FF00] text-black border-[#66FF00]"
                          : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                      }`}
                    >
                      {op.texto}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    value={meses}
                    onChange={(e) => setMeses(e.target.value)}
                    className="w-11 bg-[#070B06] border border-[#2A4226] rounded-xl text-center text-xs text-white"
                    title="Cantidad de meses personalizada"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">
                  Fecha de Venta ({formatearFechaDMA(fechaVenta)})
                </label>
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => seleccionarModoFecha("hoy")}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      modoFecha === "hoy" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => seleccionarModoFecha("ayer")}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
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
                    className="flex-1 bg-[#070B06] border border-[#2A4226] rounded-xl px-1.5 text-[11px] text-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={agregarCuentaAlCombo}
                className="w-full py-2.5 bg-[#162614] hover:bg-[#1E351B] text-[#66FF00] border border-dashed border-[#66FF00]/60 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> + Añadir esta cuenta al Combo y elegir otra plataforma
              </button>
            </div>

            <div className="flex gap-3 pt-2 border-t border-[#1E331A]">
              <button
                type="button"
                onClick={() => {
                  setModalVentaAbierto(false);
                  setCarritoCombo([]);
                }}
                className="px-5 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 py-3 bg-gradient-to-r from-[#66FF00] to-[#4CE600] text-black font-black rounded-xl shadow-[0_0_20px_rgba(102,255,0,0.4)] text-sm cursor-pointer"
              >
                {guardando
                  ? "Registrando..."
                  : carritoCombo.length > 0
                  ? `Confirmar Combo Completo (Bs ${totalAcumuladoCombo.toFixed(2)})`
                  : "Confirmar Venta y Obtener Mensaje"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VENTANA EMERGENTE: REGISTRAR NUEVO PROVEEDOR */}
      {modalNuevoProv && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <form
            onSubmit={guardarNuevoProveedor}
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
                placeholder="Ej: Destre"
                value={nuevoProvNombre}
                onChange={(e) => setNuevoProvNombre(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Teléfono / WhatsApp</label>
              <input
                type="text"
                placeholder="Ej: 69490298"
                value={nuevoProvTelefono}
                onChange={(e) => setNuevoProvTelefono(e.target.value)}
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

      {/* VENTANA EMERGENTE: MENSAJE DE ENTREGA */}
      {mensajeGenerado && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-[0_0_60px_rgba(102,255,0,0.3)] animate-modal">
            <div className="flex items-center justify-between">
              <h3 className="text-[#66FF00] font-black text-base flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" /> ¡Entrega Lista para {mensajeGenerado.cliente}!
              </h3>
              <button
                onClick={() => setMensajeGenerado(null)}
                className="p-1.5 rounded-xl bg-[#070B06] text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              readOnly
              rows={12}
              value={mensajeGenerado.completo}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-2xl p-3.5 text-xs text-gray-200 font-mono"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mensajeGenerado.completo);
                  notificar("¡Mensaje completo copiado!");
                }}
                className="py-3 px-4 bg-[#1A2B18] hover:bg-[#253D22] text-[#66FF00] border border-[#66FF00]/50 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Copiar Mensaje (PC)
              </button>

              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ text: mensajeGenerado.resumido });
                  } else {
                    navigator.clipboard.writeText(mensajeGenerado.resumido);
                    notificar("Mensaje resumido copiado");
                  }
                }}
                className="py-3 px-4 bg-[#66FF00] hover:bg-[#52cc00] text-black rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" /> Compartir (2 WhatsApps Cell)
              </button>

              <a
                href={`https://wa.me/${mensajeGenerado.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(mensajeGenerado.completo)}`}
                target="_blank"
                rel="noreferrer"
                className="sm:col-span-2 py-3 px-4 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 text-center"
              >
                Enviar Directo al WhatsApp del Cliente ({mensajeGenerado.telefono})
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}