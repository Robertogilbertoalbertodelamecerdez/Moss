import { formatearFechaDMA } from "@/config";

export function enviarWhatsappDirecto(telefono, textoMensaje) {
  if (typeof window === "undefined") return;
  let num = String(telefono || "").replace(/\D/g, "");
  if (num.length === 8 && (num.startsWith("6") || num.startsWith("7"))) {
    num = "591" + num;
  }
  const url = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(textoMensaje || "")}`
    : `https://wa.me/?text=${encodeURIComponent(textoMensaje || "")}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function obtenerTextoPlanDias(item) {
  const dias =
    Number(item.diasTotales) > 0
      ? Number(item.diasTotales)
      : Number(item.meses) === 12
      ? 365
      : Number(item.meses || 1) * 30;
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

// Construye las Reglas y Garantía adaptadas según la plataforma y modalidad (Spotify Invitación, ChatGPT Plus, Cuenta Completa o 1 Dispositivo)
function construirBloqueReglasGarantia(listaItems) {
  const hayUnDispositivo = listaItems.some(
    (i) =>
      i.tipoCuenta !== "Cuenta Completa" &&
      i.tipoCuenta !== "Por Invitación" &&
      !String(i.plataforma || "").toLowerCase().includes("invitaci")
  );

  const todasSonInvitacion = listaItems.every(
    (i) =>
      i.tipoCuenta === "Por Invitación" ||
      String(i.plataforma || "").toLowerCase().includes("invitaci")
  );

  const hayChatGPT = listaItems.some((i) =>
    String(i.plataforma || "").toLowerCase().includes("chat")
  );

  const lineas = ["📋 *REGLAS Y GARANTÍA:*"];

  if (hayUnDispositivo) {
    lineas.push("- ❌ Solo 1 dispositivo.");
  }
  if (!todasSonInvitacion) {
    lineas.push("- ❌ No cambiar correo o clave.");
  }
  if (todasSonInvitacion) {
    lineas.push("- ✅ Renovar 1 día antes del corte.");
  }
  if (hayChatGPT) {
    lineas.push("- ✅ Guardar tus proyectos en una carpeta y cuidar tu almacenamiento.");
  }

  lineas.push("- 🛠️ Soporte de caídas en 24 horas.");
  lineas.push("- 💵 Te damos reembolso si la caída supera 24 h.");

  return "\n\n" + lineas.join("\n");
}

// Formatea las líneas de cada cuenta (detectando si es Spotify Invitación con Link + Calle + Correo + Nombre de Perfil)
function armarDetalleCuentaTexto(item, esCombo, idx, paraRevendedor = false) {
  const textoPlan = obtenerTextoPlanDias(item);
  const vence = formatearFechaDMA(item.fechaCorte);
  const platLower = String(item.plataforma || "").toLowerCase();
  const esInv =
    item.tipoCuenta === "Por Invitación" || platLower.includes("invitaci");
  const esSpotifyInv = platLower.includes("spotify") && esInv;

  const head = esCombo
    ? `🔹 *${paraRevendedor ? `CUENTA #${idx + 1}: ` : `#${idx + 1} `}${item.plataforma.toUpperCase()}*`
    : `📺 *Plataforma:* ${item.plataforma}`;

  // Caso especial: Spotify por Invitación (Correo cliente, Nombre del perfil de Spotify, Link de invitación y Calle/Dirección)
  if (esSpotifyInv) {
    const correoCli = item.correoFinal ? `\n📧 *Correo:* ${item.correoFinal}` : "";
    const nomSpotify =
      item.perfilFinal &&
      !["Por Invitación", "1 Dispositivo", "Cuenta / Invitación"].includes(item.perfilFinal)
        ? `\n👤 *Nombre en Spotify:* ${item.perfilFinal}`
        : "";
    const linkInv = item.linkInvitacion || (String(item.passFinal || "").startsWith("http") ? item.passFinal : "");
    const calleDir =
      item.direccion ||
      (item.pinFinal ? item.pinFinal : !String(item.passFinal || "").startsWith("http") ? item.passFinal : "");

    const lineaLink = linkInv ? `\n🔗 *Link de Invitación:* ${linkInv}` : "";
    const lineaCalle = calleDir ? `\n📍 *Dirección / Calle:* ${calleDir}` : "";

    return `${head}${correoCli}${nomSpotify}${lineaLink}${lineaCalle}\n⏳ *Plan:* ${textoPlan} | 📅 *Vence:* ${vence}`;
  }

  const pass = item.passFinal && !esInv ? `\n🔑 *${paraRevendedor ? "Contraseña" : "Clave"}:* ${item.passFinal}` : "";
  const perfil =
    item.tipoCuenta === "Cuenta Completa"
      ? `\n👑 *Modalidad:* Cuenta Completa`
      : esInv
      ? `\n📩 *Modalidad:* Activación por Invitación`
      : item.perfilFinal &&
        !["1 Dispositivo", "Por Invitación", "Cuenta / Invitación", "Cuenta Completa"].includes(
          item.perfilFinal
        )
      ? `\n👤 *Perfil:* ${item.perfilFinal}`
      : "";
  const pin =
    item.pinFinal && item.tipoCuenta === "1 Dispositivo" && !esInv
      ? paraRevendedor
        ? `\n📌 *PIN:* ${item.pinFinal}`
        : ` | 📌 *PIN:* ${item.pinFinal}`
      : "";

  return `${head}\n📧 *Correo:* ${item.correoFinal}${pass}${perfil}${pin}\n⏳ *Plan:* ${textoPlan} | 📅 *Vence:* ${vence}`;
}

// 1. Mensaje de Entrega / Reemplazo / Edición
export function generarMensajeEntrega(
  nombre,
  tel,
  listaItems,
  linkWhatsappMoss = "",
  tituloPersonalizado = null,
  esRevendedor = false
) {
  const esCombo = listaItems.length > 1;
  const totalCobrado = listaItems.reduce((acc, i) => acc + Number(i.precioVenta || 0), 0);

  const esReemplazoORenovacion = Boolean(tituloPersonalizado);
  const textoReglas = esReemplazoORenovacion ? "" : construirBloqueReglasGarantia(listaItems);

  if (esRevendedor) {
    const bloquesRev = listaItems
      .map((item, idx) => armarDetalleCuentaTexto(item, esCombo, idx, true))
      .join("\n\n━━━━━━━━━━━━━━━━━━\n\n");

    const encabezadoRev = tituloPersonalizado
      ? `✅ *${tituloPersonalizado.toUpperCase()}*`
      : esCombo
      ? `✅ *DATOS DE ACCESO (${listaItems.length} CUENTAS)*`
      : `✅ *DATOS DE ACCESO*`;

    const numRevendedor = tel?.trim() ? tel.trim() : "";
    const lineaSoporte =
      numRevendedor && numRevendedor !== "78953018"
        ? `\n\n🛠️ *Soporte:* ${numRevendedor} / 78953018`
        : `\n\n🛠️ *Soporte:* 78953018`;

    const msgRevendedor = `${encabezadoRev}\n\n${bloquesRev}${textoReglas}${lineaSoporte}`;
    return { completo: msgRevendedor, resumido: msgRevendedor, telefono: tel, cliente: nombre };
  }

  const bloqueOfertas =
    !esReemplazoORenovacion && linkWhatsappMoss?.trim()
      ? `\n\n🎁 *Comunidad MOSS:*\n${linkWhatsappMoss.trim()}`
      : "";

  const bloques = listaItems
    .map((item, idx) => armarDetalleCuentaTexto(item, esCombo, idx, false))
    .join("\n\n━━━━━━━━━━━━━━━━━━\n\n");

  const encabezado = tituloPersonalizado
    ? `🌿 *MOSS - ${tituloPersonalizado.toUpperCase()}*`
    : esCombo
    ? `🌿 *MOSS - ENTREGA DE COMBO (${listaItems.length} CUENTAS)*`
    : `🌿 *MOSS - ENTREGA DE CUENTA*`;

  const lineaTotal = esCombo ? `\n\n💰 *Total Combo:* Bs ${totalCobrado.toFixed(2)}` : "";
  const completo = `${encabezado}\n\n¡Hola *${nombre}*!\n\n${bloques}${lineaTotal}${textoReglas}\n\n🛠️ *Soporte:* 78953018${bloqueOfertas}`;

  return { completo, resumido: completo, telefono: tel, cliente: nombre };
}

// 2. Mensaje Corto Individual de Renovación
export function generarMensajeRenovacionCorto(s, textoDias) {
  const corteDMA = formatearFechaDMA(s.fecha_corte);
  const esRev = s.tipo_comprador === "revendedor";
  const lineaPerfil =
    s.nombre_perfil && !["Cuenta / Invitación", "Por Invitación", "1 Dispositivo", "Cuenta Completa"].includes(s.nombre_perfil)
      ? `\n👤 *Perfil:* ${s.nombre_perfil}${s.pin_perfil ? ` | *PIN:* ${s.pin_perfil}` : ""}`
      : "";

  const encabezado = esRev
    ? `🔔 *AVISO DE RENOVACIÓN - ${s.plataforma.toUpperCase()}*`
    : `🌿 *AVISO DE RENOVACIÓN - ${s.plataforma.toUpperCase()}*`;

  return `${encabezado}\n📧 *Correo:* ${s.correo_cuenta}${lineaPerfil}\n📅 *Vence:* ${corteDMA} (${textoDias})\n\n¿Deseas renovar tu cuenta para mantenerla activa?`;
}

// 3. Mensaje Consolidado en LOTE para Revendedor
export function generarMensajeLoteRenovacionRevendedor(nombreRevendedor, listaSubs) {
  const items = listaSubs
    .map((s, idx) => {
      const cliNombre = s.nombre_cliente_final || "Cliente sin anotar";
      const cliTel = s.telefono_cliente_final || s.telefono_cliente || "S/N";
      const dias = Number(s.dias_totales || Number(s.meses_contratados || 1) * 30);
      const montoCliente =
        Number(s.precio_venta_revendedor) > 0
          ? `Bs ${Number(s.precio_venta_revendedor).toFixed(2)} (Tu costo: Bs ${s.precio_venta})`
          : `Costo revendedor: Bs ${s.precio_venta}`;
      const perfil =
        s.nombre_perfil && !["1 Dispositivo", "Cuenta / Invitación"].includes(s.nombre_perfil)
          ? ` | 👤 ${s.nombre_perfil}`
          : "";

      return `*${idx + 1}. ${s.plataforma}*${perfil}\n👤 *Cliente:* ${cliNombre} | 📞 *Tel:* ${cliTel}\n📧 *Cuenta:* ${s.correo_cuenta}\n⏳ *Plan:* ${dias} días | 💰 *Último pago:* ${montoCliente}\n📅 *Corte:* ${formatearFechaDMA(s.fecha_corte)}`;
    })
    .join("\n\n──────────────────\n\n");

  return `📋 *LISTA DE RENOVACIONES PENDIENTES (${listaSubs.length} CUENTAS)*\n🤝 *Revendedor:* ${nombreRevendedor}\n\n${items}\n\n_Confírmame cuáles de tus clientes van a renovar para mantenerles el cupo activo._`;
}

// 4. Mensaje Corto Morado de Cambio de Contraseña o PIN
export function generarMensajeCambioCredencial(
  tipoCambio,
  plataforma,
  correo,
  password,
  perfil,
  pin,
  telefonoRevendedor = ""
) {
  const lineaPass = password ? `\n🔑 *Contraseña:* ${password}` : "";
  const lineaPerfil = perfil ? `\n👤 *Perfil:* ${perfil}` : "";
  const lineaPin = pin ? ` | 📌 *PIN:* ${pin}` : "";
  const telRevLimpio = String(telefonoRevendedor || "").trim();
  const lineaSoporte =
    telRevLimpio && telRevLimpio !== "78953018"
      ? `\n🛠️ *Soporte:* ${telRevLimpio} / 78953018`
      : `\n🛠️ *Soporte:* 78953018`;

  return `🔄 *Se realizó un cambio de ${tipoCambio}*\n📺 *Plataforma:* ${plataforma}\n📧 *Correo:* ${correo}${lineaPass}${lineaPerfil}${lineaPin}${lineaSoporte}`;
}