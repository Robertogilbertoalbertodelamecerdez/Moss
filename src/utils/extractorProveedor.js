export function extraerDatosProveedor(textoCrudo = "") {
  if (!textoCrudo || typeof textoCrudo !== "string") {
    return {
      correo: "",
      password: "",
      perfil: "",
      pin: "",
      codigo2fa: "",
      linkInvitacion: "",
      direccion: "",
      notas: ""
    };
  }

  // Quitamos asteriscos de formato WhatsApp (*Correo:* -> Correo:) sin alterar los valores reales
  const lineas = textoCrudo
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\*/g, "").trim())
    .filter(Boolean);

  let correo = "";
  let password = "";
  let perfil = "";
  let pin = "";
  let codigo2fa = "";
  let linkInvitacion = "";
  let direccion = "";

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const urlRegex = /https?:\/\/[^\s]+/i;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const sigLinea = lineas[i + 1] || "";

    // 1. Detectar Link de Invitación (Ej: Spotify Family Invite)
    const matchUrl = linea.match(urlRegex);
    if (matchUrl && !linkInvitacion) {
      linkInvitacion = matchUrl[0].trim();
    }

    // 2. Detectar Etiqueta de Correo / Email / Usuario
    const matchEtiquetaCorreo = linea.match(
      /^(?:[^\w\s]*\s*)?(?:correo|email|usuario|user|cuenta|mail)\s*[:=-]\s*(.*)$/i
    );
    if (matchEtiquetaCorreo) {
      const valorMismoRenglon = matchEtiquetaCorreo[1].trim();
      if (valorMismoRenglon) {
        if (urlRegex.test(valorMismoRenglon)) {
          linkInvitacion = valorMismoRenglon.match(urlRegex)[0];
        } else {
          const mailEnValor = valorMismoRenglon.match(emailRegex);
          correo = mailEnValor ? mailEnValor[0] : valorMismoRenglon;
        }
      } else if (sigLinea) {
        // Cuando el correo viene en el renglón de abajo ("Correo:\neibellolympia+1@gmail.com")
        if (urlRegex.test(sigLinea)) {
          linkInvitacion = sigLinea.match(urlRegex)[0];
          i++;
        } else if (emailRegex.test(sigLinea)) {
          correo = sigLinea.match(emailRegex)[0];
          i++;
        }
      }
      continue;
    }

    // 3. Detectar Etiqueta de Contraseña / Password / Clave
    const matchEtiquetaPass = linea.match(
      /^(?:[^\w\s]*\s*)?(?:contrase[ñn]a|password|pass|clave|key)\s*[:=-]\s*(.*)$/i
    );
    if (matchEtiquetaPass) {
      const valorPass = matchEtiquetaPass[1].trim();
      if (valorPass) {
        // Si es un mensaje de Spotify Invitación donde "Contraseña:" trae la calle/dirección
        if (
          linkInvitacion ||
          /av\.|calle|bolivia|santa cruz|barrio|zona/i.test(valorPass)
        ) {
          if (
            /av\.|calle|bolivia|santa cruz|barrio|zona|,/i.test(valorPass) &&
            valorPass.includes(" ")
          ) {
            direccion = valorPass;
          } else {
            password = valorPass;
          }
        } else {
          password = valorPass;
        }
      } else if (
        sigLinea &&
        !/^(?:perfil|pin|codigo2fa|2fa|vence|vencimiento|fecha)/i.test(sigLinea)
      ) {
        // Cuando la contraseña viene en el renglón de abajo ("Contraseña:\nNhincaigi7979")
        password = sigLinea.trim();
        i++;
      }
      continue;
    }

    // 4. Detectar Dirección / Calle explícita
    const matchDireccion = linea.match(
      /^(?:[^\w\s]*\s*)?(?:direcci[oó]n|calle|ubicaci[oó]n|address)\s*[:=-]\s*(.*)$/i
    );
    if (matchDireccion) {
      direccion = matchDireccion[1].trim() || sigLinea.trim();
      continue;
    }

    // 5. Detectar Código 2FA (En el mismo renglón o en el renglón de abajo)
    const match2FA = linea.match(
      /^(?:[^\w\s]*\s*)?(?:codigo\s*2fa|c[oó]digo\s*2fa|2fa|token|secret)\s*[:=-]\s*(.*)$/i
    );
    if (match2FA) {
      const val2FA = match2FA[1].trim();
      if (val2FA) {
        codigo2fa = val2FA.replace(/\s+/g, "");
      } else if (sigLinea) {
        codigo2fa = sigLinea.trim().replace(/\s+/g, "");
        i++;
      }
      continue;
    }

    // 6. Detectar Perfil (Ej: "Perfil: 2" -> "Perfil 2")
    const matchPerfil = linea.match(
      /^(?:[^\w\s]*\s*)?(?:perfil|profile|pantalla)\s*[:=-]\s*(.*)$/i
    );
    if (matchPerfil) {
      const valP = matchPerfil[1].trim();
      if (valP) {
        perfil = /^\d+$/.test(valP) ? `Perfil ${valP}` : valP;
      }
      continue;
    }

    // 7. Detectar PIN
    const matchPin = linea.match(
      /^(?:[^\w\s]*\s*)?(?:pin|c[oó]digo\s*pin)\s*[:=-]\s*(.*)$/i
    );
    if (matchPin) {
      pin = matchPin[1].trim();
      continue;
    }
  }

  // 8. Respaldo para mensajes de 2 líneas sin etiquetas (Prime, Disney, Netflix: línea 1 = correo, línea 2 = clave)
  if (!correo) {
    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(emailRegex);
      if (m) {
        correo = m[0].trim();
        // Si aún no tenemos contraseña, verificamos si la línea inmediatamente siguiente es la contraseña
        if (!password && lineas[i + 1]) {
          const candidata = lineas[i + 1].trim();
          const esTituloPlataforma =
            /^(?:disney|netflix|prime|max|hbo|crunchyroll|spotify|youtube|chatgpt|capcut|canva|flujo|iptv|account|vencimiento|vence|reglas|📆)/i.test(
              candidata
            );
          const tieneDosPuntos = candidata.includes(":");
          if (!esTituloPlataforma && !tieneDosPuntos && !emailRegex.test(candidata)) {
            password = candidata.split(/\s+/)[0];
          }
        }
        break;
      }
    }
  }

  // Armar nota automática si trae Código 2FA
  let notas = "";
  if (codigo2fa) {
    notas = `🔐 Código 2FA: ${codigo2fa}\n🌐 Link 2FA: https://2fa.live`;
  }

  return {
    correo: correo.replace(/\*/g, "").trim(),
    password: password.replace(/\*/g, "").trim(),
    perfil: perfil.replace(/\*/g, "").trim(),
    pin: pin.replace(/\*/g, "").trim(),
    codigo2fa,
    linkInvitacion,
    direccion,
    notas
  };
}