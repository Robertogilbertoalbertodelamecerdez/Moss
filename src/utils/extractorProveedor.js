import { PLATAFORMAS } from "@/config";

export function extraerDatosProveedor(textoCrudo, plataformasPersonalizadas = PLATAFORMAS) {
  if (!textoCrudo) return {};

  const resultado = {
    plataforma: null,
    correo: "",
    password: "",
    perfil: "",
    pin: ""
  };

  // 1. Detectar Plataforma mencionada en cualquier parte del texto
  const upper = textoCrudo.toUpperCase();
  if (upper.includes("NETFLIX")) resultado.plataforma = "Netflix";
  else if (upper.includes("DISNEY") || upper.includes("ESPN")) resultado.plataforma = "Disney+ / ESPN";
  else if (upper.includes("PRIME") || upper.includes("AMAZON")) resultado.plataforma = "Prime Video";
  else if (upper.includes("CRUNCHYROLL") || upper.includes("CRUNCHY")) resultado.plataforma = "Crunchyroll";
  else if (upper.includes("HBO") || upper.includes("MAX")) resultado.plataforma = "Max (HBO)";
  else if (upper.includes("GEMINI")) {
    const tieneGemini = plataformasPersonalizadas.find((p) => p.nombre.toUpperCase().includes("GEMINI"));
    resultado.plataforma = tieneGemini ? tieneGemini.nombre : "Gemini Pro";
  } else if (upper.includes("CHATGPT") || upper.includes("OPENAI") || upper.includes("GPT")) {
    const tienePlus = plataformasPersonalizadas.find((p) => p.nombre.toUpperCase().includes("CHATGPT"));
    resultado.plataforma = tienePlus ? tienePlus.nombre : "ChatGPT Plus";
  } else if (upper.includes("CLAUDE") || upper.includes("ANTHROPIC")) {
    const tieneClaude = plataformasPersonalizadas.find((p) => p.nombre.toUpperCase().includes("CLAUDE"));
    resultado.plataforma = tieneClaude ? tieneClaude.nombre : "Claude Pro";
  } else if (upper.includes("SPOTIFY")) {
    resultado.plataforma = upper.includes("INVITACI") ? "Spotify (Invitación)" : "Spotify (Asignada)";
  } else if (upper.includes("YOUTUBE")) resultado.plataforma = "YouTube Premium";
  else if (upper.includes("CANVA")) resultado.plataforma = "Canva Pro";
  else {
    for (const p of plataformasPersonalizadas) {
      if (upper.includes(p.nombre.toUpperCase())) {
        resultado.plataforma = p.nombre;
        break;
      }
    }
  }

  // 2. Extraer Correo
  const matchCorreo = textoCrudo.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  if (matchCorreo) {
    resultado.correo = matchCorreo[0].trim();
  }

  // 3. Caso especial: formato "correo@gmail.com:contraseña123"
  if (resultado.correo) {
    const regexCombo = new RegExp(
      resultado.correo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[:|/\\-]\\s*([^\\s\\n]+)",
      "i"
    );
    const matchCombo = textoCrudo.match(regexCombo);
    if (matchCombo && matchCombo[1]) {
      resultado.password = matchCombo[1].trim();
    }
  }

  // Analizar línea por línea para Contraseña, Perfil y PIN
  const lineas = textoCrudo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const linea of lineas) {
    if (!resultado.password) {
      const matchPass = linea.match(
        /(?:contrase[ñn]a|clave|pass(?:word)?|key|acceso)\s*(?:de\s*la\s*cuenta)?\s*[:=\->]+\s*([^\s|]+)/i
      );
      if (matchPass && matchPass[1]) {
        resultado.password = matchPass[1].trim();
        continue;
      }
    }

    if (!resultado.perfil) {
      const matchPerfilEtiqueta = linea.match(
        /(?:perfil|pantalla|espacio|slot|usuario\s*asignado)\s*[:=\->]+\s*([^|\n🔒📌🔑]+)/i
      );
      if (matchPerfilEtiqueta && matchPerfilEtiqueta[1]) {
        let valorPerfil = matchPerfilEtiqueta[1].trim();
        if (/^\d+$/.test(valorPerfil)) {
          valorPerfil = `Perfil ${valorPerfil}`;
        }
        resultado.perfil = valorPerfil;
      } else {
        const matchPerfilSuelto = linea.match(/\b(?:perfil|pantalla)\s*#?\s*(\d+)\b/i);
        if (matchPerfilSuelto) {
          resultado.perfil = `Perfil ${matchPerfilSuelto[1]}`;
        }
      }
    }

    if (!resultado.pin) {
      const matchPin = linea.match(/(?:pin|c[óo]digo\s*de\s*perfil|clave\s*perfil|candado)\s*[:=\->#]*\s*(\d{4,6})/i);
      if (matchPin && matchPin[1]) {
        resultado.pin = matchPin[1].trim();
      }
    }
  }

  return resultado;
}