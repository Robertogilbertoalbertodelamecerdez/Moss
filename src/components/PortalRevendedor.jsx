"use client";
import React, { useState, useMemo } from "react";
import {
  supabase,
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  sumarDiasBoliviaISO,
  extraerFechaLocalISO
} from "@/config";
import {
  generarMensajeEntrega,
  generarMensajeRenovacionCorto,
  generarMensajeCambioCredencial
} from "@/utils/mensajesMoss";
import {
  Layers,
  BellRing,
  FolderSearch,
  Edit3,
  Copy,
  Share2,
  CheckCircle2,
  X,
  User,
  UserCheck,
  Lock,
  AlertCircle,
  MessageSquare,
  PlusCircle,
  BarChart3,
  Wallet,
  Trophy,
  Trash2,
  TrendingUp,
  Calendar
} from "lucide-react";

export default function PortalRevendedor({
  revendedor,
  suscripciones = [],
  matrices = [],
  movimientosRevendedor = [],
  plataformasList = [],
  recargarTodo,
  notificar,
  registrarErrorSistema
}) {
  const [tabRev, setTabRev] = useState("mis_clientes");
  const [busqueda, setBusqueda] = useState("");

  // Filtro superior para las tarjetas del Revendedor ('hoy' | 'semana' | 'mes' | 'siempre')
  const [filtroTarjetasRev, setFiltroTarjetasRev] = useState("siempre");

  const hoyISO = obtenerFechaBoliviaISO();
  const hace7DiasISO = sumarDiasBoliviaISO(-6, hoyISO);
  const [periodoEst, setPeriodoEst] = useState("mes");
  const [fechaDiaEst, setFechaDiaEst] = useState(hoyISO);
  const [mesEst, setMesEst] = useState(hoyISO.slice(0, 7));

  const [puntoActivoIdx, setPuntoActivoIdx] = useState(null);

  const [nombreBanca, setNombreBanca] = useState(revendedor.nombre_billetera || "Mi Billetera");
  const [modalAjusteBanca, setModalAjusteBanca] = useState(false);
  const [montoBanca, setMontoBanca] = useState("");
  const [descBanca, setDescBanca] = useState("");

  const [subAnotar, setSubAnotar] = useState(null);
  const [nomFinal, setNomFinal] = useState("");
  const [telFinal, setTelFinal] = useState("");
  const [precioFinal, setPrecioFinal] = useState("");

  const [perfilPropioModal, setPerfilPropioModal] = useState(null);
  const [pinEditRev, setPinEditRev] = useState("");
  const [nomCliEditRev, setNomCliEditRev] = useState("");
  const [telCliEditRev, setTelCliEditRev] = useState("");
  const [precioCliEditRev, setPrecioCliEditRev] = useState("");

  const [matrizVender, setMatrizVender] = useState(null);
  const [nomVentaStock, setNomVentaStock] = useState("");
  const [telVentaStock, setTelVentaStock] = useState("");
  const [precioVentaStock, setPrecioVentaStock] = useState("");
  const [mesesStock, setMesesStock] = useState(1);
  const [guardandoStock, setGuardandoStock] = useState(false);

  const [mensajeModal, setMensajeModal] = useState(null);

  // Todas las ventas históricas de este revendedor
  const misVentas = useMemo(() => {
    return suscripciones
      .filter((s) => {
        if (s.en_papelera) return false;
        if (s.tipo_comprador !== "revendedor") return false;
        return s.revendedor_id === revendedor.id || s.telefono_cliente === revendedor.telefono;
      })
      .sort((a, b) => String(b.creado_en || "").localeCompare(String(a.creado_en || "")));
  }, [suscripciones, revendedor]);

  // Ventas filtradas para las 3 tarjetas superiores del Revendedor (Hoy / Esta Semana / Este Mes / Siempre)
  const misVentasTarjetasTop = useMemo(() => {
    return misVentas.filter((s) => {
      const f = extraerFechaLocalISO(s.fecha_venta);
      if (filtroTarjetasRev === "hoy") return f === hoyISO;
      if (filtroTarjetasRev === "semana") return f >= hace7DiasISO && f <= hoyISO;
      if (filtroTarjetasRev === "mes") return f.startsWith(hoyISO.slice(0, 7));
      return true;
    });
  }, [misVentas, filtroTarjetasRev, hoyISO, hace7DiasISO]);

  // Ventas filtradas en su pestaña de Estadísticas
  const misVentasEstadisticas = useMemo(() => {
    return misVentas.filter((s) => {
      const f = extraerFechaLocalISO(s.fecha_venta);
      if (periodoEst === "dia" && f !== fechaDiaEst) return false;
      if (periodoEst === "mes" && !f.startsWith(mesEst)) return false;
      return true;
    });
  }, [misVentas, periodoEst, fechaDiaEst, mesEst]);

  // Métricas de las tarjetas superiores según el filtro elegido (Hoy / Semana / Mes / Siempre)
  const cobradoPeriodoTop = misVentasTarjetasTop.reduce(
    (acc, s) => acc + Number(s.precio_venta_revendedor || 0),
    0
  );
  const costoAdminPeriodoTop = misVentasTarjetasTop.reduce(
    (acc, s) => acc + Number(s.precio_venta || 0),
    0
  );
  const gananciaNetaPeriodoTop = cobradoPeriodoTop - costoAdminPeriodoTop;

  // Saldo Total Acumulado en la Billetera del Revendedor (siempre muestra su total general real)
  const gananciaHistoricaTotal = misVentas.reduce(
    (acc, s) => acc + (Number(s.precio_venta_revendedor || 0) - Number(s.precio_venta || 0)),
    0
  );
  const ajustesManualesBanca = movimientosRevendedor.reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const saldoBilleteraRevendedor = gananciaHistoricaTotal + ajustesManualesBanca;

  const deudaPendienteAdmin = misVentas
    .filter((s) => s.pagado_al_admin === false)
    .reduce((acc, s) => acc + Number(s.precio_venta || 0), 0);

  const etiquetaFiltroRev =
    filtroTarjetasRev === "hoy"
      ? "DE HOY"
      : filtroTarjetasRev === "semana"
      ? "ESTA SEMANA"
      : filtroTarjetasRev === "mes"
      ? "ESTE MES"
      : "HISTÓRICO";

  // Serie Bursátil + Predicción IA para el Revendedor
  const { serieRevBursatil, previsionMensualRev } = useMemo(() => {
    const mapa = {};
    misVentasEstadisticas.forEach((s) => {
      const f = extraerFechaLocalISO(s.fecha_venta);
      if (!mapa[f]) mapa[f] = { fecha: f, ventas: 0, ingreso: 0, ganancia: 0, esPrediccion: false };
      const cobro = Number(s.precio_venta_revendedor || 0);
      const costo = Number(s.precio_venta || 0);
      mapa[f].ventas += 1;
      mapa[f].ingreso += cobro > 0 ? cobro : costo;
      mapa[f].ganancia += cobro > 0 ? cobro - costo : 0;
    });

    const reales = Object.values(mapa)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-12);

    if (reales.length === 0) return { serieRevBursatil: [], previsionMensualRev: 0 };

    const n = reales.length;
    const promGan = reales.reduce((a, b) => a + b.ganancia, 0) / n;
    const promIng = reales.reduce((a, b) => a + b.ingreso, 0) / n;
    const promVtas = Math.max(1, Math.round(reales.reduce((a, b) => a + b.ventas, 0) / n));

    let pendiente = 0;
    if (n >= 2) {
      pendiente = (reales[n - 1].ganancia - reales[Math.max(0, n - 3)].ganancia) / Math.min(3, n);
    }

    const ultFecha = reales[n - 1].fecha;
    const proyecciones = [1, 2, 3].map((d) => {
      const fFutura = sumarDiasBoliviaISO(d, ultFecha);
      const ganEst = Math.max(promGan * 0.6, promGan + pendiente * d * 0.45);
      const ingEst = Math.max(ganEst, promIng + pendiente * d * 0.5);
      return {
        fecha: fFutura,
        ventas: promVtas,
        ingreso: Number(ingEst.toFixed(2)),
        ganancia: Number(ganEst.toFixed(2)),
        esPrediccion: true
      };
    });

    return {
      serieRevBursatil: [...reales, ...proyecciones],
      previsionMensualRev: promGan * 30
    };
  }, [misVentasEstadisticas]);

  const svgWidth = 680;
  const svgHeight = 205;
  const padX = 32;
  const padY = 24;
  const maxValRev = Math.max(
    ...serieRevBursatil.map((d) => Math.max(d.ingreso, d.ganancia, 10)),
    10
  );

  const puntosSVG = serieRevBursatil.map((d, i) => {
    const total = Math.max(1, serieRevBursatil.length - 1);
    const x = padX + (i / total) * (svgWidth - padX * 2);
    const yGan = svgHeight - padY - (Math.max(0, d.ganancia) / maxValRev) * (svgHeight - padY * 2);
    return { ...d, idx: i, x, yGan };
  });

  const puntosRealesSVG = puntosSVG.filter((p) => !p.esPrediccion);
  const puntosPredSVG = puntosSVG.filter((p, idx) => p.esPrediccion || idx === puntosRealesSVG.length - 1);

  const rutaLineaReal = puntosRealesSVG
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.yGan.toFixed(1)}`)
    .join(" ");

  const rutaAreaReal =
    puntosRealesSVG.length > 0
      ? `${rutaLineaReal} L ${puntosRealesSVG[puntosRealesSVG.length - 1].x.toFixed(1)} ${svgHeight - padY} L ${puntosRealesSVG[0].x.toFixed(1)} ${svgHeight - padY} Z`
      : "";

  const rutaLineaPrediccion = puntosPredSVG
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.yGan.toFixed(1)}`)
    .join(" ");

  const puntoSeleccionado =
    puntoActivoIdx !== null && puntosSVG[puntoActivoIdx]
      ? puntosSVG[puntoActivoIdx]
      : puntosRealesSVG[puntosRealesSVG.length - 1] || null;

  const calcularDias = (fechaCorte) => {
    const hoy = new Date(hoyISO + "T00:00:00-04:00");
    const corte = new Date(fechaCorte + "T00:00:00-04:00");
    return Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
  };

  const misRenovaciones = misVentas.filter((s) => s.estado === "Activa" && calcularDias(s.fecha_corte) <= 3);

  const obtenerPrecioRevendedorPlat = (nombrePlat) => {
    const p = plataformasList.find((x) => x.nombre === nombrePlat);
    return Number(p?.precioRevendedor ?? 10);
  };

  const abrirModalAnotarCliente = (s) => {
    setSubAnotar(s);
    setNomFinal(s.nombre_cliente_final || "");
    setTelFinal(s.telefono_cliente_final || "");
    setPrecioFinal(
      s.precio_venta_revendedor && Number(s.precio_venta_revendedor) > 0 ? s.precio_venta_revendedor : ""
    );
  };

  const guardarDatosClienteFinal = async (e) => {
    e.preventDefault();
    if (!nomFinal.trim() || !telFinal.trim() || precioFinal === "") {
      return notificar("Completa el nombre, teléfono y a cuánto se lo vendiste", "error");
    }
    try {
      await supabase
        .from("clientes")
        .upsert([{ telefono: telFinal.trim(), nombre: `${nomFinal.trim()} (Cliente de ${revendedor.nombre})` }], {
          onConflict: "telefono"
        });

      const { error } = await supabase
        .from("suscripciones")
        .update({
          nombre_cliente_final: nomFinal.trim(),
          telefono_cliente_final: telFinal.trim(),
          precio_venta_revendedor: Number(precioFinal)
        })
        .eq("id", subAnotar.id);

      if (error) throw error;

      setSubAnotar(null);
      await recargarTodo();
      notificar("¡Cliente guardado en tu cartera y ganancia calculada!");
    } catch (err) {
      registrarErrorSistema("Guardar Cliente de Revendedor", err.message, revendedor.nombre);
      notificar("Error al guardar: " + err.message, "error");
    }
  };

  const guardarEdicionDesdePersonitaMatriz = async (e) => {
    e.preventDefault();
    if (!perfilPropioModal) return;
    try {
      await supabase
        .from("perfiles_matriz")
        .update({ pin: pinEditRev.trim() })
        .eq("id", perfilPropioModal.perfil.id);

      if (perfilPropioModal.subOcupante) {
        if (telCliEditRev.trim() && nomCliEditRev.trim()) {
          await supabase.from("clientes").upsert(
            [{ telefono: telCliEditRev.trim(), nombre: `${nomCliEditRev.trim()} (Cliente de ${revendedor.nombre})` }],
            { onConflict: "telefono" }
          );
        }
        await supabase
          .from("suscripciones")
          .update({
            pin_perfil: pinEditRev.trim(),
            nombre_cliente_final: nomCliEditRev.trim(),
            telefono_cliente_final: telCliEditRev.trim(),
            precio_venta_revendedor: Number(precioCliEditRev || 0)
          })
          .eq("id", perfilPropioModal.subOcupante.id);
      }

      await recargarTodo();
      notificar("Datos de tu cliente y PIN actualizados");
    } catch (err) {
      registrarErrorSistema("Edición Personita Revendedor", err.message, revendedor.nombre);
      notificar("Error: " + err.message, "error");
    }
  };

  const venderPerfilDeMatriz = async (e) => {
    e.preventDefault();
    if (!matrizVender) return;
    if (!nomVentaStock.trim() || !telVentaStock.trim() || precioVentaStock === "") {
      return notificar("Completa los datos de tu cliente y tu precio de venta", "error");
    }

    const libres = (matrizVender.perfiles_matriz || [])
      .filter((p) => !p.ocupado && !p.caido)
      .sort((a, b) => (a.es_extra_final !== b.es_extra_final ? (a.es_extra_final ? 1 : -1) : a.numero_slot - b.numero_slot));

    const slot = libres[0];
    if (!slot) return notificar("Ya no quedan perfiles libres en esta matriz", "error");

    setGuardandoStock(true);
    try {
      const costoUnitarioRev = obtenerPrecioRevendedorPlat(matrizVender.plataforma);
      const costoTotalParaRev = costoUnitarioRev * Number(mesesStock);
      const diasTotales = Number(mesesStock) === 12 ? 365 : Number(mesesStock) * 30;
      const fechaCorte = sumarDiasBoliviaISO(diasTotales, hoyISO);

      await supabase
        .from("clientes")
        .upsert([{ telefono: telVentaStock.trim(), nombre: `${nomVentaStock.trim()} (Cliente de ${revendedor.nombre})` }], {
          onConflict: "telefono"
        });

      const { data: nuevaSub, error: errSub } = await supabase
        .from("suscripciones")
        .insert([
          {
            tipo_comprador: "revendedor",
            revendedor_id: revendedor.id,
            nombre_cliente: revendedor.nombre,
            telefono_cliente: revendedor.telefono,
            nombre_cliente_final: nomVentaStock.trim(),
            telefono_cliente_final: telVentaStock.trim(),
            precio_venta_revendedor: Number(precioVentaStock),
            pagado_al_admin: false,
            plataforma: matrizVender.plataforma,
            tipo_cuenta: "1 Dispositivo",
            origen: "stock",
            matriz_id: matrizVender.id,
            perfil_id: slot.id,
            proveedor_id: matrizVender.proveedor_id || null,
            nombre_proveedor: matrizVender.nombre_proveedor || null,
            telefono_proveedor: matrizVender.telefono_proveedor || null,
            correo_cuenta: matrizVender.correo,
            password_cuenta: matrizVender.password,
            nombre_perfil: slot.nombre_perfil,
            pin_perfil: slot.pin,
            costo_proveedor: 0,
            precio_venta: costoTotalParaRev,
            meses_contratados: Number(mesesStock),
            dias_totales: diasTotales,
            fecha_venta: hoyISO,
            fecha_corte: fechaCorte,
            estado: "Activa"
          }
        ])
        .select()
        .single();

      if (errSub) throw errSub;

      await supabase.from("perfiles_matriz").update({ ocupado: true }).eq("id", slot.id);

      await supabase.from("notificaciones_sistema").insert([
        {
          tipo: "venta_revendedor",
          titulo: `🛒 ${revendedor.nombre} sacó ${matrizVender.plataforma} del Stock`,
          mensaje: `Correo: ${matrizVender.correo} (${slot.nombre_perfil}) · Cliente final: ${nomVentaStock.trim()} (${telVentaStock.trim()}) · Vendido en Bs ${precioVentaStock}. Cobrar a revendedor: Bs ${costoTotalParaRev.toFixed(2)}.`,
          revendedor_id: revendedor.id,
          nombre_revendedor: revendedor.nombre,
          suscripcion_id: nuevaSub.id,
          monto_cobrar: costoTotalParaRev,
          pagado: false
        }
      ]);

      const msg = generarMensajeEntrega(
        nomVentaStock.trim(),
        revendedor.telefono,
        [
          {
            plataforma: matrizVender.plataforma,
            tipoCuenta: "1 Dispositivo",
            correoFinal: matrizVender.correo,
            passFinal: matrizVender.password,
            perfilFinal: slot.nombre_perfil,
            pinFinal: slot.pin,
            meses: Number(mesesStock),
            fechaCorte,
            precioVenta: Number(precioVentaStock)
          }
        ],
        "",
        null,
        true
      );

      setMatrizVender(null);
      setNomVentaStock("");
      setTelVentaStock("");
      setPrecioVentaStock("");
      setMensajeModal(msg);
      await recargarTodo();
      notificar("¡Perfil asignado! Recuerda pagar el cupo al administrador.");
    } catch (err) {
      registrarErrorSistema("Auto-venta de Matriz por Revendedor", err.message, revendedor.nombre);
      notificar("Error: " + err.message, "error");
    } finally {
      setGuardandoStock(false);
    }
  };

  const registrarMovimientoPropio = async (e) => {
    e.preventDefault();
    if (!montoBanca) return;
    await supabase.from("movimientos_revendedor").insert([
      {
        revendedor_id: revendedor.id,
        tipo: Number(montoBanca) >= 0 ? "Ingreso Manual" : "Gasto / Retiro",
        monto: Number(montoBanca),
        descripcion: descBanca || "Ajuste manual en mi billetera"
      }
    ]);
    setMontoBanca("");
    setDescBanca("");
    setModalAjusteBanca(false);
    await recargarTodo();
    notificar("Movimiento registrado en tu billetera");
  };

  const guardarNombreBilleteraRev = async () => {
    await supabase
      .from("revendedores")
      .update({ nombre_billetera: nombreBanca.trim() || "Mi Billetera" })
      .eq("id", revendedor.id);
    await recargarTodo();
    notificar("Nombre de tu billetera actualizado");
  };

  return (
    <div className="space-y-5">
      {revendedor.mostrar_bono_semanal && (
        <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-[#111A10] border-2 border-amber-400 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-[0_0_30px_rgba(251,191,36,0.2)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-amber-400 text-black">
                🏆 Mejor Revendedor de la Semana
              </span>
              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                ¡Felicidades {revendedor.nombre}! Generaste Bs {Number(revendedor.ganancia_generada_semana || 0).toFixed(2)} de ganancia esta semana.
              </h3>
              <p className="text-xs text-amber-200">
                Te corresponde un bono equivalente a{" "}
                <b className="text-white text-sm">Bs {Number(revendedor.monto_bono_semanal || 0).toFixed(2)}</b>.
              </p>
            </div>
          </div>
          <span
            className={`px-4 py-2 rounded-xl text-xs font-black ${
              revendedor.bono_semanal_pagado
                ? "bg-[#66FF00] text-black"
                : "bg-amber-950 text-amber-300 border border-amber-400"
            }`}
          >
            {revendedor.bono_semanal_pagado ? "✓ BONO ENTREGADO / PAGADO" : "⏳ BONO PENDIENTE DE ENTREGA"}
          </span>
        </div>
      )}

      {/* BARRA DE FILTRO RÁPIDO PARA LAS TARJETAS DEL REVENDEDOR */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0E170D]/90 px-4 py-2.5 rounded-2xl border border-[#233820]">
        <span className="text-xs text-gray-400 font-bold flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#66FF00]" /> Mis métricas superiores mostrando:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "hoy", label: "Hoy" },
            { id: "semana", label: "Esta Semana" },
            { id: "mes", label: "Este Mes" },
            { id: "siempre", label: "Siempre (Total)" }
          ].map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => setFiltroTarjetasRev(op.id)}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                filtroTarjetasRev === op.id
                  ? "bg-[#66FF00] text-black border-[#66FF00]"
                  : "bg-[#070B06] text-gray-300 border-[#2A4226] hover:border-[#66FF00]/50"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* TARJETAS FINANCIERAS DEL REVENDEDOR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Total Cobrado ({etiquetaFiltroRev})</p>
          <p className="text-2xl font-black text-white mt-1">Bs {cobradoPeriodoTop.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">{misVentasTarjetasTop.length} venta(s) en periodo</p>
        </div>

        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Mi Costo Base ({etiquetaFiltroRev})</p>
          <p className="text-2xl font-black text-orange-300 mt-1">Bs {costoAdminPeriodoTop.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">Por Pagar a Admin: Bs {deudaPendienteAdmin.toFixed(0)}</p>
        </div>

        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-[#66FF00] uppercase font-extrabold">Mi Ganancia Neta ({etiquetaFiltroRev})</p>
          <p className={`text-2xl font-black mt-1 ${gananciaNetaPeriodoTop >= 0 ? "text-[#66FF00]" : "text-red-400"}`}>
            Bs {gananciaNetaPeriodoTop.toFixed(2)}
          </p>
          <p className="text-[10px] text-cyan-300 font-bold">
            Previsión 30d: Bs {previsionMensualRev.toFixed(0)}
          </p>
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] text-[#66FF00] uppercase font-extrabold">
              Saldo en {revendedor.nombre_billetera || "Mi Billetera"}
            </p>
            <p className="text-2xl font-black text-white mt-1">Bs {saldoBilleteraRevendedor.toFixed(2)}</p>
          </div>
          <button
            onClick={() => setModalAjusteBanca(true)}
            className="mt-2 py-1 px-2.5 bg-[#66FF00] text-black font-black rounded-lg text-[11px] cursor-pointer"
          >
            + Registrar Gasto / Ingreso
          </button>
        </div>
      </div>

      {/* BARRA DE PESTAÑAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0E170D] p-2 rounded-2xl border border-[#264023]">
        <button
          onClick={() => setTabRev("mis_clientes")}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
            tabRev === "mis_clientes" ? "bg-[#66FF00] text-black" : "text-gray-300"
          }`}
        >
          <FolderSearch className="w-4 h-4" /> Mis Ventas ({misVentas.length})
        </button>

        {revendedor.puede_ver_matrices && (
          <button
            onClick={() => setTabRev("stock_disponible")}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
              tabRev === "stock_disponible" ? "bg-[#66FF00] text-black" : "text-gray-300"
            }`}
          >
            <Layers className="w-4 h-4" /> Matrices y Stock
          </button>
        )}

        <button
          onClick={() => setTabRev("renovaciones")}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
            tabRev === "renovaciones" ? "bg-[#66FF00] text-black" : "text-gray-300"
          }`}
        >
          <BellRing className="w-4 h-4" /> Renovaciones ({misRenovaciones.length})
        </button>

        <button
          onClick={() => setTabRev("estadisticas")}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
            tabRev === "estadisticas" ? "bg-[#66FF00] text-black" : "text-gray-300"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Estadísticas y Banca
        </button>
      </div>

      {/* PESTAÑA 1: MIS VENTAS */}
      {tabRev === "mis_clientes" && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Buscar por nombre de tu cliente, teléfono, plataforma o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-[#111A10] border border-[#2A4226] rounded-2xl px-4 py-2.5 text-xs text-white"
          />

          <div className="space-y-3">
            {misVentas
              .filter((s) => {
                if (!busqueda.trim()) return true;
                const q = busqueda.toLowerCase();
                return (
                  (s.nombre_cliente_final || "").toLowerCase().includes(q) ||
                  (s.telefono_cliente_final || "").toLowerCase().includes(q) ||
                  (s.correo_cuenta || "").toLowerCase().includes(q) ||
                  (s.plataforma || "").toLowerCase().includes(q)
                );
              })
              .map((s) => {
                const faltaAnotar = !s.nombre_cliente_final || !s.telefono_cliente_final;
                const gananciaIndividual =
                  Number(s.precio_venta_revendedor || 0) - Number(s.precio_venta || 0);

                return (
                  <div
                    key={s.id}
                    className={`bg-[#111A10] border rounded-2xl p-4 space-y-3 ${
                      faltaAnotar ? "border-amber-400" : "border-[#233820]"
                    }`}
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                            {s.plataforma}
                          </span>

                          {s.pagado_al_admin === false ? (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500 text-black">
                              ⏳ Por pagar a Admin (Bs {s.precio_venta})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-900/50 text-green-300">
                              ✓ Pagado a Admin
                            </span>
                          )}

                          {faltaAnotar && (
                            <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ¡Anota tu cliente y precio!
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-white pt-1">
                          Mi Cliente:{" "}
                          {s.nombre_cliente_final ? (
                            <span className="text-[#66FF00]">
                              {s.nombre_cliente_final} — 📞 {s.telefono_cliente_final}
                            </span>
                          ) : (
                            <span className="text-amber-400 italic">Falta anotar nombre y número</span>
                          )}
                        </p>

                        <p className="text-xs text-gray-300">
                          Correo: <b className="text-white font-mono">{s.correo_cuenta}</b>
                          {s.password_cuenta ? ` · Clave: ${s.password_cuenta}` : ""}
                          {s.nombre_perfil ? ` · ${s.nombre_perfil}` : ""}
                          {s.pin_perfil ? ` (PIN: ${s.pin_perfil})` : ""}
                        </p>
                      </div>

                      <div className="text-right text-xs space-y-0.5">
                        <p className="text-gray-400">
                          Tu costo: <b className="text-orange-300">Bs {s.precio_venta}</b>
                        </p>
                        <p className="text-gray-400">
                          Lo vendiste a:{" "}
                          <b className="text-white">Bs {Number(s.precio_venta_revendedor || 0).toFixed(2)}</b>
                        </p>
                        {Number(s.precio_venta_revendedor) > 0 && (
                          <p className="text-[#66FF00] font-black">
                            Tu ganancia: +Bs {gananciaIndividual.toFixed(2)}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-500">
                          Corte: {formatearFechaDMA(s.fecha_corte)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1E331A]">
                      <button
                        onClick={() => abrirModalAnotarCliente(s)}
                        className="px-3.5 py-1.5 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {faltaAnotar ? "Anotar mi Cliente y Precio" : "Editar Cliente / Precio"}
                      </button>

                      <button
                        onClick={() =>
                          setMensajeModal(
                            generarMensajeEntrega(
                              s.nombre_cliente_final || "Cliente",
                              revendedor.telefono,
                              [
                                {
                                  plataforma: s.plataforma,
                                  tipoCuenta: s.tipo_cuenta || "1 Dispositivo",
                                  correoFinal: s.correo_cuenta,
                                  passFinal: s.password_cuenta,
                                  perfilFinal: s.nombre_perfil,
                                  pinFinal: s.pin_perfil,
                                  meses: s.meses_contratados || 1,
                                  fechaCorte: s.fecha_corte,
                                  precioVenta: s.precio_venta_revendedor || s.precio_venta
                                }
                              ],
                              "",
                              null,
                              true
                            )
                          )
                        }
                        className="px-3.5 py-1.5 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/40 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Copiar Mensaje de Entrega
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: MATRICES Y STOCK */}
      {tabRev === "stock_disponible" && revendedor.puede_ver_matrices && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matrices
            .filter((m) => !m.en_papelera && m.estado === "Activa")
            .map((matriz) => {
              const perfiles = (matriz.perfiles_matriz || []).sort((a, b) => a.numero_slot - b.numero_slot);
              const libres = perfiles.filter((p) => !p.ocupado && !p.caido);
              const precioMayorista = obtenerPrecioRevendedorPlat(matriz.plataforma);

              return (
                <div key={matriz.id} className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                        {matriz.plataforma}
                      </span>
                      <span className="ml-2 text-xs text-orange-300 font-bold">
                        Tu Costo: Bs {precioMayorista}
                      </span>
                      <p className="text-xs text-gray-300 font-mono mt-1">{matriz.correo}</p>
                      <p className="text-[11px] text-gray-500">
                        Vence: {formatearFechaDMA(matriz.fecha_corte_matriz)}
                      </p>
                    </div>

                    {libres.length > 0 ? (
                      <button
                        onClick={() => {
                          setMatrizVender(matriz);
                          setMesesStock(1);
                        }}
                        className="px-4 py-2 bg-[#66FF00] text-black font-black rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" /> Vender Cupo ({libres.length})
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500 font-bold">Llena</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#1E331A]">
                    {perfiles.map((p) => {
                      const subOcupante = suscripciones.find(
                        (s) => s.perfil_id === p.id && s.estado === "Activa" && !s.en_papelera
                      );
                      const esMio =
                        subOcupante &&
                        (subOcupante.revendedor_id === revendedor.id ||
                          subOcupante.telefono_cliente === revendedor.telefono);

                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={!esMio && (p.ocupado || p.caido)}
                          onClick={() => {
                            if (esMio) {
                              setPerfilPropioModal({ perfil: p, matriz, subOcupante });
                              setPinEditRev(p.pin || "");
                              setNomCliEditRev(subOcupante.nombre_cliente_final || "");
                              setTelCliEditRev(subOcupante.telefono_cliente_final || "");
                              setPrecioCliEditRev(subOcupante.precio_venta_revendedor || "");
                            } else if (!p.ocupado && !p.caido) {
                              setMatrizVender(matriz);
                            }
                          }}
                          className={`p-2 rounded-xl border text-left text-xs flex items-center gap-2 transition ${
                            esMio
                              ? "bg-[#1A2E17] border-[#66FF00] cursor-pointer hover:brightness-110"
                              : p.ocupado || p.caido
                              ? "bg-[#070B06] border-gray-800 opacity-55 cursor-not-allowed"
                              : "bg-[#122010] border-[#66FF00]/40 hover:border-[#66FF00] cursor-pointer"
                          }`}
                        >
                          {esMio ? (
                            <UserCheck className="w-4 h-4 text-[#66FF00] shrink-0" />
                          ) : p.ocupado || p.caido ? (
                            <Lock className="w-4 h-4 text-gray-500 shrink-0" />
                          ) : (
                            <User className="w-4 h-4 text-[#66FF00] shrink-0" />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-[11px] truncate">{p.nombre_perfil}</p>
                            {esMio ? (
                              <>
                                <p className="text-[10px] text-orange-300 font-bold truncate">
                                  {subOcupante.nombre_cliente_final || "Falta anotar"}
                                </p>
                                <p className="text-[9px] text-[#66FF00] font-mono truncate">
                                  📞 {subOcupante.telefono_cliente_final || "Tocar p/anotar"}
                                </p>
                              </>
                            ) : p.ocupado || p.caido ? (
                              <p className="text-[10px] text-gray-500">Ocupado</p>
                            ) : (
                              <p className="text-[10px] text-[#66FF00]">● Libre (Vender)</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* PESTAÑA 3: RENOVACIONES */}
      {tabRev === "renovaciones" && (
        <div className="space-y-3">
          {misRenovaciones.length === 0 ? (
            <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-8 text-center text-gray-400 text-xs">
              No tienes clientes próximos a vencer en los siguientes 3 días.
            </div>
          ) : (
            misRenovaciones.map((s) => {
              const dias = calcularDias(s.fecha_corte);
              const textoDias =
                dias < 0 ? `Venció hace ${Math.abs(dias)}d` : dias === 0 ? "¡Vence HOY!" : `Vence en ${dias}d`;
              const msgCorto = generarMensajeRenovacionCorto(s, textoDias);

              return (
                <div
                  key={s.id}
                  className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3"
                >
                  <div>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-[#66FF00]/20 text-[#66FF00]">
                      {s.plataforma}
                    </span>
                    <span className="ml-2 text-xs font-bold text-orange-400">{textoDias}</span>
                    <p className="font-bold text-white text-sm mt-1">
                      Cliente: {s.nombre_cliente_final || "Sin nombre anotado"} — 📞{" "}
                      {s.telefono_cliente_final || "Sin número"}
                    </p>
                    <p className="text-xs text-gray-400">
                      Cuenta: {s.correo_cuenta} ({s.nombre_perfil}) · Pagó: Bs{" "}
                      {Number(s.precio_venta_revendedor || 0).toFixed(2)} · Corte:{" "}
                      {formatearFechaDMA(s.fecha_corte)}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msgCorto);
                      notificar("Aviso corto copiado para tu cliente");
                    }}
                    className="px-4 py-2 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar Aviso
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PESTAÑA 4: ESTADÍSTICAS CON GRÁFICA BURSÁTIL + PREDICCIÓN IA */}
      {tabRev === "estadisticas" && (
        <div className="space-y-5">
          <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {[
                { id: "dia", label: "Por Día" },
                { id: "mes", label: "Por Mes" },
                { id: "todo", label: "Histórico" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPeriodoEst(p.id);
                    setPuntoActivoIdx(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                    periodoEst === p.id
                      ? "bg-[#66FF00] text-black border-[#66FF00]"
                      : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {periodoEst === "dia" && (
                <input
                  type="date"
                  value={fechaDiaEst}
                  onChange={(e) => setFechaDiaEst(e.target.value)}
                  className="bg-[#070B06] border border-[#66FF00] rounded-xl px-2.5 py-1 text-xs text-white"
                />
              )}
              {periodoEst === "mes" && (
                <input
                  type="month"
                  value={mesEst}
                  onChange={(e) => setMesEst(e.target.value)}
                  className="bg-[#070B06] border border-[#66FF00] rounded-xl px-2.5 py-1 text-xs text-white"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nombreBanca}
                onChange={(e) => setNombreBanca(e.target.value)}
                placeholder="Nombre de tu billetera"
                className="bg-[#070B06] border border-[#2A4226] rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <button
                onClick={guardarNombreBilleteraRev}
                className="px-3 py-1.5 bg-[#66FF00] text-black font-bold rounded-xl text-xs cursor-pointer"
              >
                Renombrar Banca
              </button>
            </div>
          </div>

          <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Mi Curva Bursátil de Ganancias & Predicción IA
                </h3>
                <p className="text-[11px] text-gray-400">
                  Toca cualquier punto o pico para ver tu ganancia exacta y tu proyección de los próximos 3 días. Previsión a 30 días:{" "}
                  <b className="text-cyan-300">Bs {previsionMensualRev.toFixed(2)}</b>.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-[#66FF00] font-bold">
                  <span className="w-3 h-1 bg-[#66FF00] inline-block rounded" /> Mi Ganancia Real
                </span>
                <span className="flex items-center gap-1 text-cyan-300 font-bold">
                  <span className="w-3 h-1 bg-cyan-400 inline-block rounded" /> Mi Predicción (+3d)
                </span>
              </div>
            </div>

            {puntoSeleccionado && (
              <div
                className={`rounded-2xl p-3 border flex flex-wrap justify-between items-center gap-2 text-xs ${
                  puntoSeleccionado.esPrediccion
                    ? "bg-cyan-950/30 border-cyan-500/60 text-cyan-200"
                    : "bg-[#070B06] border-[#66FF00]/60 text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                      puntoSeleccionado.esPrediccion ? "bg-cyan-400 text-black" : "bg-[#66FF00] text-black"
                    }`}
                  >
                    {puntoSeleccionado.esPrediccion ? "🔮 Mi Predicción Futura" : "📈 Mi Pico Real"}
                  </span>
                  <span className="font-mono font-bold text-sm">{formatearFechaDMA(puntoSeleccionado.fecha)}</span>
                </div>

                <div className="flex flex-wrap gap-4">
                  <span>Mis ventas: <b>{puntoSeleccionado.ventas}</b></span>
                  <span>Cobrado: <b>Bs {puntoSeleccionado.ingreso.toFixed(2)}</b></span>
                  <span className={puntoSeleccionado.esPrediccion ? "text-cyan-300 font-black" : "text-[#66FF00] font-black"}>
                    {puntoSeleccionado.esPrediccion ? "Ganancia Proyectada:" : "Mi Ganancia Neta:"} Bs{" "}
                    {puntoSeleccionado.ganancia.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {puntosSVG.length === 0 ? (
              <p className="text-xs text-gray-500 py-8 text-center">
                Aún no hay ventas con precio anotado en este período.
              </p>
            ) : (
              <div className="relative w-full overflow-x-auto">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-52 select-none overflow-visible">
                  <defs>
                    <linearGradient id="revPortalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#66FF00" stopOpacity="0.42" />
                      <stop offset="100%" stopColor="#66FF00" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[0.2, 0.5, 0.8].map((pct, i) => (
                    <line
                      key={i}
                      x1={padX}
                      y1={padY + pct * (svgHeight - padY * 2)}
                      x2={svgWidth - padX}
                      y2={padY + pct * (svgHeight - padY * 2)}
                      stroke="#1E331A"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                  ))}

                  {rutaAreaReal && <path d={rutaAreaReal} fill="url(#revPortalGrad)" />}
                  {rutaLineaReal && (
                    <path d={rutaLineaReal} fill="none" stroke="#66FF00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {rutaLineaPrediccion && (
                    <path d={rutaLineaPrediccion} fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="round" />
                  )}

                  {puntoSeleccionado && (
                    <line
                      x1={puntoSeleccionado.x}
                      y1={padY / 2}
                      x2={puntoSeleccionado.x}
                      y2={svgHeight - padY}
                      stroke={puntoSeleccionado.esPrediccion ? "#22D3EE" : "#66FF00"}
                      strokeWidth="1.2"
                      strokeDasharray="2 2"
                    />
                  )}

                  {puntosSVG.map((p) => {
                    const esActivo = puntoSeleccionado && puntoSeleccionado.idx === p.idx;
                    return (
                      <g
                        key={p.fecha}
                        onMouseEnter={() => setPuntoActivoIdx(p.idx)}
                        onClick={() => setPuntoActivoIdx(p.idx)}
                        className="cursor-pointer"
                      >
                        <circle cx={p.x} cy={p.yGan} r="16" fill="transparent" />
                        <circle
                          cx={p.x}
                          cy={p.yGan}
                          r={esActivo ? "6.5" : "4"}
                          fill={p.esPrediccion ? "#22D3EE" : "#66FF00"}
                          stroke="#070B06"
                          strokeWidth="2"
                        />
                        <text
                          x={p.x}
                          y={p.yGan - 10}
                          textAnchor="middle"
                          fill={p.esPrediccion ? "#67E8F9" : "#66FF00"}
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {p.ganancia.toFixed(0)}
                        </text>
                        <text
                          x={p.x}
                          y={svgHeight - 6}
                          textAnchor="middle"
                          fill={p.esPrediccion ? "#22D3EE" : "#9CA3AF"}
                          fontSize="9"
                        >
                          {formatearFechaDMA(p.fecha).slice(0, 5)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Movimientos Manuales en {revendedor.nombre_billetera || "Mi Billetera"}
              </h3>
              <button
                onClick={() => setModalAjusteBanca(true)}
                className="px-3 py-1.5 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer"
              >
                + Nuevo Gasto / Ingreso
              </button>
            </div>

            {movimientosRevendedor.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">
                Aún no registraste gastos o ingresos extras en tu billetera.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {movimientosRevendedor.map((m) => (
                  <div
                    key={m.id}
                    className="bg-[#070B06] border border-[#1E331A] rounded-xl p-2.5 flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">{m.tipo}: </span>
                      <span className="text-gray-300">{m.descripcion}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-black ${Number(m.monto) >= 0 ? "text-[#66FF00]" : "text-red-400"}`}>
                        {Number(m.monto) >= 0 ? `+Bs ${m.monto}` : `-Bs ${Math.abs(m.monto)}`}
                      </span>
                      <button
                        onClick={async () => {
                          await supabase.from("movimientos_revendedor").delete().eq("id", m.id);
                          await recargarTodo();
                        }}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PERSONITA EN MATRIZ */}
      {perfilPropioModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={guardarEdicionDesdePersonitaMatriz}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-md w-full space-y-4"
          >
            <div className="flex justify-between items-center border-b border-[#233820] pb-2">
              <h3 className="font-black text-[#66FF00] text-sm">
                {perfilPropioModal.matriz.plataforma} — {perfilPropioModal.perfil.nombre_perfil}
              </h3>
              <button type="button" onClick={() => setPerfilPropioModal(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs text-gray-400">Nombre de tu Cliente</label>
                <input
                  type="text"
                  value={nomCliEditRev}
                  onChange={(e) => setNomCliEditRev(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Teléfono de tu Cliente</label>
                <input
                  type="text"
                  value={telCliEditRev}
                  onChange={(e) => setTelCliEditRev(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-[#66FF00] font-bold">Precio de Venta (Bs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={precioCliEditRev}
                  onChange={(e) => setPrecioCliEditRev(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white font-bold"
                />
              </div>
              <div>
                <label className="text-xs text-[#66FF00] font-bold">PIN del Perfil</label>
                <input
                  type="text"
                  value={pinEditRev}
                  onChange={(e) => setPinEditRev(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer"
            >
              Guardar Cambios
            </button>

            <button
              type="button"
              onClick={() => {
                const msg = generarMensajeCambioCredencial(
                  "PIN de tu perfil",
                  perfilPropioModal.matriz.plataforma,
                  perfilPropioModal.matriz.correo,
                  perfilPropioModal.matriz.password,
                  perfilPropioModal.perfil.nombre_perfil,
                  pinEditRev
                );
                navigator.clipboard.writeText(msg);
                notificar("Aviso corto de cambio de PIN copiado");
              }}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-4 h-4" /> Copiar Aviso de Cambio de PIN (Morado)
            </button>
          </form>
        </div>
      )}

      {/* MODAL ANOTAR CLIENTE FINAL Y PRECIO */}
      {subAnotar && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={guardarDatosClienteFinal}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00] text-sm">
                Anotar / Editar Cliente ({subAnotar.plataforma})
              </h3>
              <button type="button" onClick={() => setSubAnotar(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-400">Nombre de tu Cliente Final *</label>
              <input
                type="text"
                placeholder="Ej: Carlos Pérez"
                value={nomFinal}
                onChange={(e) => setNomFinal(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Teléfono / WhatsApp de tu Cliente *</label>
              <input
                type="text"
                placeholder="Ej: 71234567"
                value={telFinal}
                onChange={(e) => setTelFinal(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#66FF00] font-bold">
                ¿En cuánto se lo vendiste? (Bs) * — (Tu costo fue Bs {subAnotar.precio_venta})
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej: 25"
                value={precioFinal}
                onChange={(e) => setPrecioFinal(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-xs text-white font-bold"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSubAnotar(null)} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL SACAR CUENTA DE STOCK */}
      {matrizVender && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={venderPerfilDeMatriz}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00] text-sm">
                Sacar 1 Perfil de {matrizVender.plataforma}
              </h3>
              <button type="button" onClick={() => setMatrizVender(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-orange-300 bg-orange-950/40 border border-orange-500/40 p-2.5 rounded-xl">
              Tu costo mayorista: <b>Bs {obtenerPrecioRevendedorPlat(matrizVender.plataforma)} / mes</b>.
            </p>
            <div>
              <label className="text-xs text-gray-400">Nombre de tu Cliente Final *</label>
              <input
                type="text"
                value={nomVentaStock}
                onChange={(e) => setNomVentaStock(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Teléfono de tu Cliente Final *</label>
              <input
                type="text"
                value={telVentaStock}
                onChange={(e) => setTelVentaStock(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#66FF00] font-bold">
                Precio al que se lo vendiste a tu cliente (Bs) *
              </label>
              <input
                type="number"
                step="0.01"
                value={precioVentaStock}
                onChange={(e) => setPrecioVentaStock(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-xs text-white font-bold"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMatrizVender(null)} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" disabled={guardandoStock} className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                {guardandoStock ? "Asignando..." : "Obtener Datos"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL REGISTRAR MOVIMIENTO EN BILLETERA DEL REVENDEDOR */}
      {modalAjusteBanca && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={registrarMovimientoPropio}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00] text-sm">
                Ajustar Saldo en {revendedor.nombre_billetera || "Mi Billetera"}
              </h3>
              <button type="button" onClick={() => setModalAjusteBanca(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              placeholder="Monto Bs (Usa negativo ej: -10 para gastos)"
              value={montoBanca}
              onChange={(e) => setMontoBanca(e.target.value)}
              className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Descripción (Ej: Retiro o publicidad)"
              value={descBanca}
              onChange={(e) => setDescBanca(e.target.value)}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalAjusteBanca(false)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL MENSAJE DE ENTREGA */}
      {mensajeModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#66FF00] font-black text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Datos Listos para Enviar
              </h3>
              <button onClick={() => setMensajeModal(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              readOnly
              rows={9}
              value={mensajeModal.completo}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-2xl p-3 text-xs text-white font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mensajeModal.completo);
                  notificar("¡Copiado!");
                }}
                className="py-2.5 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/50 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Copiar
              </button>
              <button
                onClick={() => {
                  if (navigator.share) navigator.share({ text: mensajeModal.completo });
                  else navigator.clipboard.writeText(mensajeModal.completo);
                }}
                className="py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Share2 className="w-4 h-4" /> Compartir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}