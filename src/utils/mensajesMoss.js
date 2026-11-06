import { formatearFechaDMA } from "@/config";

// 1. Mensaje de Entrega / Reemplazo / Edición (Distingue Cliente Final vs Revendedor)
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

  // ==========================================================
  // FORMATO GENÉRICO PARA REVENDEDOR (Sin nombre, sin MOSS y sin link de grupo)
  // ==========================================================
  if (esRevendedor) {
    const bloquesRev = listaItems
      .map((item, idx) => {
        const m = Number(item.meses || 1);
        const textoMeses = m === 12 ? "1 año" : m === 1 ? "1 mes" : `${m} meses`;
        const vence = formatearFechaDMA(item.fechaCorte);
        const esInv = item.tipoCuenta === "Por Invitación" || !item.passFinal;

        const head = esCombo
          ? `🔹 *CUENTA #${idx + 1}: ${item.plataforma.toUpperCase()}*`
          : `📺 *Plataforma:* ${item.plataforma}`;
        const pass = item.passFinal && !esInv ? `\n🔑 *Contraseña:* ${item.passFinal}` : "";
        const perfil =
          item.tipoCuenta === "Cuenta Completa"
            ? `\n👑 *Modalidad:* Cuenta Completa`
            : esInv
            ? `\n📩 *Modalidad:* Activación por Invitación`
            : item.perfilFinal &&
              !["1 Dispositivo", "Por Invitación", "Cuenta / Invitación"].includes(item.perfilFinal)
            ? `\n👤 *Perfil:* ${item.perfilFinal}`
            : "";
        const pin =
          item.pinFinal && item.tipoCuenta === "1 Dispositivo" && !esInv
            ? `\n📌 *PIN:* ${item.pinFinal}`
            : "";

        return `${head}\n📧 *Correo / Usuario:* ${item.correoFinal}${pass}${perfil}${pin}\n⏳ *Plan:* ${textoMeses}\n📅 *Vence:* ${vence}`;
      })
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

    const msgRevendedor = `${encabezadoRev}\n\n${bloquesRev}${lineaSoporte}`;

    return {
      completo: msgRevendedor,
      resumido: msgRevendedor,
      telefono: tel,
      cliente: nombre
    };
  }

  // ==========================================================
  // FORMATO NORMAL PARA CLIENTE FINAL (Con saludo, MOSS y link de grupo)
  // ==========================================================
  const bloqueOfertas = linkWhatsappMoss?.trim()
    ? `\n\n🎁 *Comunidad MOSS:*\n${linkWhatsappMoss.trim()}`
    : "";

  const bloques = listaItems
    .map((item, idx) => {
      const m = Number(item.meses || 1);
      const textoMeses = m === 12 ? "1 año" : m === 1 ? "1 mes" : `${m} meses`;
      const vence = formatearFechaDMA(item.fechaCorte);
      const esInv = item.tipoCuenta === "Por Invitación" || !item.passFinal;

      const head = esCombo
        ? `🔹 *#${idx + 1} ${item.plataforma.toUpperCase()}*`
        : `📺 *Plataforma:* ${item.plataforma}`;
      const pass = item.passFinal && !esInv ? `\n🔑 *Clave:* ${item.passFinal}` : "";
      const perfil =
        item.tipoCuenta === "Cuenta Completa"
          ? `\n👑 *Modalidad:* Cuenta Completa`
          : esInv
          ? `\n📩 *Modalidad:* Activación por Invitación`
          : item.perfilFinal &&
            !["1 Dispositivo", "Por Invitación", "Cuenta / Invitación"].includes(item.perfilFinal)
          ? `\n👤 *Perfil:* ${item.perfilFinal}`
          : "";
      const pin =
        item.pinFinal && item.tipoCuenta === "1 Dispositivo" && !esInv
          ? ` | 📌 *PIN:* ${item.pinFinal}`
          : "";

      return `${head}\n📧 *Correo:* ${item.correoFinal}${pass}${perfil}${pin}\n⏳ *Plan:* ${textoMeses} | 📅 *Vence:* ${vence}`;
    })
    .join("\n\n━━━━━━━━━━━━━━━━━━\n\n");

  const encabezado = tituloPersonalizado
    ? `🌿 *MOSS - ${tituloPersonalizado.toUpperCase()}*`
    : esCombo
    ? `🌿 *MOSS - ENTREGA DE COMBO (${listaItems.length} CUENTAS)*`
    : `🌿 *MOSS - ENTREGA DE CUENTA*`;

  const lineaTotal = esCombo ? `\n\n💰 *Total Combo:* Bs ${totalCobrado.toFixed(2)}` : "";
  const completo = `${encabezado}\n\n¡Hola *${nombre}*!\n\n${bloques}${lineaTotal}\n\n🛠️ *Soporte:* 78953018${bloqueOfertas}`;

  const resumido = listaItems
    .map((item) => {
      const vence = formatearFechaDMA(item.fechaCorte);
      const esInv = item.tipoCuenta === "Por Invitación" || !item.passFinal;
      const pass = item.passFinal && !esInv ? `\n🔑 Clave: ${item.passFinal}` : "";
      const perfil =
        item.perfilFinal && !esInv
          ? `\n👤 Perfil: ${item.perfilFinal}${item.pinFinal ? ` | PIN: ${item.pinFinal}` : ""}`
          : "";
      return `*${item.plataforma} (MOSS)*\n📧 Correo: ${item.correoFinal}${pass}${perfil}\n📅 Vence: ${vence}\n🛠️ Soporte: 78953018`;
    })
    .join("\n\n");

  return { completo, resumido, telefono: tel, cliente: nombre };
}

// 2. Mensaje Corto de Renovación (SIN mostrar cuánto pagó la última vez)
export function generarMensajeRenovacionCorto(s, textoDias) {
  const corteDMA = formatearFechaDMA(s.fecha_corte);
  const esRev = s.tipo_comprador === "revendedor";
  const lineaPerfil =
    s.nombre_perfil && !["Cuenta / Invitación", "Por Invitación", "1 Dispositivo"].includes(s.nombre_perfil)
      ? `\n👤 *Perfil:* ${s.nombre_perfil}${s.pin_perfil ? ` | *PIN:* ${s.pin_perfil}` : ""}`
      : "";

  const encabezado = esRev
    ? `🔔 *AVISO DE RENOVACIÓN - ${s.plataforma.toUpperCase()}*`
    : `🌿 *AVISO DE RENOVACIÓN - ${s.plataforma.toUpperCase()}*`;

  return `${encabezado}\n📧 *Correo:* ${s.correo_cuenta}${lineaPerfil}\n📅 *Vence:* ${corteDMA} (${textoDias})\n\n¿Deseas renovar tu cuenta para mantenerla activa?`;
}

// 3. Mensaje Corto Morado de Cambio de Contraseña o PIN
export function generarMensajeCambioCredencial(tipoCambio, plataforma, correo, password, perfil, pin) {
  const lineaPass = password ? `\n🔑 *Contraseña:* ${password}` : "";
  const lineaPerfil = perfil ? `\n👤 *Perfil:* ${perfil}` : "";
  const lineaPin = pin ? ` | 📌 *PIN:* ${pin}` : "";
  return `🔄 *Se realizó un cambio de ${tipoCambio}*\n📺 *Plataforma:* ${plataforma}\n📧 *Correo:* ${correo}${lineaPass}${lineaPerfil}${lineaPin}\n🛠️ *Soporte:* 78953018`;
}