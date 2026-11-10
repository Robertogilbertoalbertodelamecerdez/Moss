"use client";
import React, { useState, useMemo, useEffect } from "react";
import {
  supabase,
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  sumarDiasBoliviaISO,
  extraerFechaLocalISO
} from "@/config";
import {
  BarChart3,
  TrendingUp,
  Award,
  Users,
  Trophy,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  X,
  Sparkles,
  RotateCcw,
  History,
  Trash2
} from "lucide-react";

function armarSerieConPrediccion(mapaPorFecha) {
  const reales = Object.values(mapaPorFecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-12);

  if (reales.length === 0) return { serie: [], prevision30d: 0 };

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
      gananciaParaAdmin: Number(ganEst.toFixed(2)),
      gananciaDeEllos: Number(ganEst.toFixed(2)),
      esPrediccion: true
    };
  });

  return {
    serie: [...reales, ...proyecciones],
    prevision30d: promGan * 30
  };
}

// Calcula el lunes de la semana actual en Bolivia (porque cada domingo se cierra y paga el ciclo)
function obtenerLunesDeSemanaBolivia(fechaHoyISO) {
  const d = new Date(fechaHoyISO + "T12:00:00-04:00");
  const day = d.getDay(); // 0 = Domingo, 1 = Lunes, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return obtenerFechaBoliviaISO(d);
}

export default function ModuloEstadisticas({
  suscripciones = [],
  matrices = [],
  movimientosYolo = [],
  revendedores = [],
  nombreBilletera = "Yolo",
  recargarTodo,
  notificar
}) {
  const hoyISO = obtenerFechaBoliviaISO();
  const lunesSemanaActualISO = obtenerLunesDeSemanaBolivia(hoyISO);
  const mesActualISO = hoyISO.slice(0, 7);
  const anioActualISO = hoyISO.slice(0, 4);

  const [periodo, setPeriodo] = useState("mes");
  const [fechaEspecifica, setFechaEspecifica] = useState(hoyISO);
  const [mesEspecifico, setMesEspecifico] = useState(mesActualISO);
  const [anioEspecifico, setAnioEspecifico] = useState(anioActualISO);

  const [filtroTipoComprador, setFiltroTipoComprador] = useState("todos");
  const [revendedorSeleccionado, setRevendedorSeleccionado] = useState("todos");

  // Controles de la Gráfica #2 de Revendedores: distinguir "Profit para Mí (Admin)" vs "Ganancia de Ellos"
  const [revendedorGraficaDos, setRevendedorGraficaDos] = useState("todos");
  const [modoMetricaRevendedores, setModoMetricaRevendedores] = useState("para_mi"); // 'para_mi' | 'de_ellos'

  // Configuración del Bono Semanal y Ciclo de Domingos
  const [modalBonoAbierto, setModalBonoAbierto] = useState(false);
  const [tabModalBono, setTabModalBono] = useState("ciclo_actual"); // 'ciclo_actual' | 'historial'
  const [cantidadGanadoresTop, setCantidadGanadoresTop] = useState(3); // 1 | 2 | 3
  const [pctTop1, setPctTop1] = useState(5);
  const [pctTop2, setPctTop2] = useState(3);
  const [pctTop3, setPctTop3] = useState(2);
  const [timestampUltimoReinicio, setTimestampUltimoReinicio] = useState("");

  // Filtros para la pestaña de Historial de Comisiones y Bonos Pagados
  const [periodoHistorialBono, setPeriodoHistorialBono] = useState("semana"); // 'dia' | 'semana' | 'mes' | 'todo'
  const [fechaHistBono, setFechaHistBono] = useState(hoyISO);
  const [mesHistBono, setMesHistBono] = useState(mesActualISO);

  const [puntoActivoIdx, setPuntoActivoIdx] = useState(null);
  const [puntoActivoRevIdx, setPuntoActivoRevIdx] = useState(null);

  useEffect(() => {
    const gTop = localStorage.getItem("moss_top_count");
    const p1 = localStorage.getItem("moss_pct_bono_1");
    const p2 = localStorage.getItem("moss_pct_bono_2");
    const p3 = localStorage.getItem("moss_pct_bono_3");
    const tsReset = localStorage.getItem("moss_ciclo_bono_reset_ts");
    if (gTop) setCantidadGanadoresTop(Number(gTop));
    if (p1) setPctTop1(Number(p1));
    if (p2) setPctTop2(Number(p2));
    if (p3) setPctTop3(Number(p3));
    if (tsReset) setTimestampUltimoReinicio(tsReset);
  }, []);

  // Profit que una venta te deja A TI como Admin (Lo que te pagan - Tu costo de matriz o proveedor)
  const calcularGananciaAdminDeVenta = (s) => {
    const ingresoQueMePago = Number(s.precio_venta || 0);
    if (s.origen === "stock" && s.matriz_id) {
      const mat = matrices.find((m) => m.id === s.matriz_id);
      if (mat && Number(mat.costo_total) > 0) {
        const costoPorCupo = Number(mat.costo_total) / Math.max(1, Number(mat.capacidad_total || 5));
        return ingresoQueMePago - costoPorCupo;
      }
      return ingresoQueMePago;
    }
    return ingresoQueMePago - Number(s.costo_proveedor || 0);
  };

  // Ganancia que obtiene EL REVENDEDOR para su bolsillo (Lo que le cobra a su cliente - Lo que te paga a ti)
  const calcularGananciaPropiaDelRevendedor = (s) => {
    const cobroAClienteFinal = Number(s.precio_venta_revendedor || 0);
    const pagoAlAdmin = Number(s.precio_venta || 0);
    return cobroAClienteFinal > 0 ? cobroAClienteFinal - pagoAlAdmin : 0;
  };

  // =========================================================================
  // 1. RANKING DEL CICLO SEMANAL ACTUAL (SE REINICIA CADA DOMINGO AL PAGAR)
  // =========================================================================
  const rankingSemanalBono = useMemo(() => {
    const mapa = {};
    revendedores.forEach((r) => {
      mapa[r.id] = {
        ...r,
        ventasSemana: 0,
        ingresoSemana: 0,
        gananciaNetaParaAdmin: 0,
        gananciaDelRevendedorSemana: 0
      };
    });

    suscripciones
      .filter((s) => !s.en_papelera && s.tipo_comprador === "revendedor")
      .forEach((s) => {
        const f = extraerFechaLocalISO(s.fecha_venta);
        // Solo cuenta las ventas de la semana actual (desde el lunes)
        if (f < lunesSemanaActualISO || f > hoyISO) return;

        // Si ya pagaste y reiniciaste el ciclo este domingo, solo cuenta ventas posteriores al reinicio
        if (
          timestampUltimoReinicio &&
          s.creado_en &&
          String(s.creado_en) < String(timestampUltimoReinicio)
        ) {
          return;
        }

        let target = mapa[s.revendedor_id];
        if (!target) {
          target = Object.values(mapa).find((r) => r.telefono === s.telefono_cliente);
        }
        if (target) {
          target.ventasSemana += 1;
          target.ingresoSemana += Number(s.precio_venta || 0);
          target.gananciaNetaParaAdmin += calcularGananciaAdminDeVenta(s);
          target.gananciaDelRevendedorSemana += calcularGananciaPropiaDelRevendedor(s);
        }
      });

    const ordenados = Object.values(mapa).sort((a, b) =>
      b.ventasSemana !== a.ventasSemana
        ? b.ventasSemana - a.ventasSemana
        : b.gananciaNetaParaAdmin - a.gananciaNetaParaAdmin
    );

    return ordenados.map((item, idx) => {
      const puesto = idx + 1;
      const entraEnPodio = puesto <= cantidadGanadoresTop && item.ventasSemana > 0;
      const pctAplicado =
        puesto === 1
          ? Number(pctTop1 || 0)
          : puesto === 2
          ? Number(pctTop2 || 0)
          : puesto === 3
          ? Number(pctTop3 || 0)
          : 0;
      const bonoCalculado = entraEnPodio
        ? Math.max(0, item.gananciaNetaParaAdmin * (pctAplicado / 100))
        : 0;

      return {
        ...item,
        puesto,
        pctAplicado,
        entraEnPodio,
        bonoCalculado
      };
    });
  }, [
    revendedores,
    suscripciones,
    matrices,
    lunesSemanaActualISO,
    hoyISO,
    pctTop1,
    pctTop2,
    pctTop3,
    cantidadGanadoresTop,
    timestampUltimoReinicio
  ]);

  const ganadoresActivosPodio = rankingSemanalBono.filter((r) => r.entraEnPodio);

  // Reiniciar el ciclo semanal (Limpia el estado de la semana y arranca contador desde 0)
  const reiniciarCicloSemanalDomingo = async (esAutomatico = false) => {
    const ahoraISO = new Date().toISOString();
    localStorage.setItem("moss_ciclo_bono_reset_ts", ahoraISO);
    setTimestampUltimoReinicio(ahoraISO);

    for (const r of revendedores) {
      if (r.bono_semanal_pagado || r.mostrar_bono_semanal) {
        await supabase
          .from("revendedores")
          .update({
            bono_semanal_pagado: false,
            mostrar_bono_semanal: false,
            monto_bono_semanal: 0,
            ganancia_generada_semana: 0
          })
          .eq("id", r.id);
      }
    }

    await recargarTodo();
    notificar(
      esAutomatico
        ? "🎉 ¡Pagaste a todos los ganadores del Top! El ciclo semanal se reinició automáticamente y los pagos quedaron en el Historial."
        : "Ciclo semanal reiniciado en 0 para la nueva semana"
    );
  };

  const toggleVisibilidadBono = async (revObj) => {
    const nuevoValor = !revObj.mostrar_bono_semanal;
    await supabase
      .from("revendedores")
      .update({
        mostrar_bono_semanal: nuevoValor,
        monto_bono_semanal: Number(revObj.bonoCalculado.toFixed(2)),
        ganancia_generada_semana: Number(revObj.gananciaNetaParaAdmin.toFixed(2))
      })
      .eq("id", revObj.id);
    await recargarTodo();
    notificar(
      nuevoValor
        ? `Bono del ${revObj.pctAplicado}% visible en el portal de ${revObj.nombre}`
        : `Bono ocultado del portal de ${revObj.nombre}`
    );
  };

  // Pagar solo a los del Top seleccionado; si ya se pagó a todos los del Top, reinicia el ciclo semanal
  const pagarBonoAGanadorTop = async (revObj) => {
    if (!revObj.entraEnPodio) {
      return notificar("Este revendedor está fuera del Top seleccionado", "error");
    }

    if (revObj.bono_semanal_pagado) {
      await supabase
        .from("revendedores")
        .update({ bono_semanal_pagado: false })
        .eq("id", revObj.id);
      await recargarTodo();
      return notificar(`Pago de ${revObj.nombre} desmarcado`);
    }

    await supabase
      .from("revendedores")
      .update({
        bono_semanal_pagado: true,
        monto_bono_semanal: Number(revObj.bonoCalculado.toFixed(2)),
        ganancia_generada_semana: Number(revObj.gananciaNetaParaAdmin.toFixed(2))
      })
      .eq("id", revObj.id);

    if (revObj.bonoCalculado > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          tipo: `Bono Revendedor #${revObj.puesto} (${revObj.pctAplicado}%)`,
          monto: -Math.abs(Number(revObj.bonoCalculado.toFixed(2))),
          afecta_ganancia_neta: true,
          descripcion: `Bono Semanal Domingo Puesto #${revObj.puesto} (${revObj.pctAplicado}%) a ${revObj.nombre} | Profit generado: Bs ${revObj.gananciaNetaParaAdmin.toFixed(2)}`
        }
      ]);
    }

    // Verificar si con este pago ya quedaron pagados TODOS los ganadores del Top activo
    const cuantosFaltaban = ganadoresActivosPodio.filter(
      (g) => g.id !== revObj.id && !g.bono_semanal_pagado
    ).length;

    if (cuantosFaltaban === 0 && ganadoresActivosPodio.length > 0) {
      await reiniciarCicloSemanalDomingo(true);
    } else {
      await recargarTodo();
      notificar(
        `Bono de Bs ${revObj.bonoCalculado.toFixed(2)} pagado a ${revObj.nombre}. Faltan ${cuantosFaltaban} del Top para cerrar y reiniciar la semana.`
      );
    }
  };

  // =========================================================================
  // 2. HISTORIAL DE COMISIONES GENERADAS Y BONOS PAGADOS POR FILTRO
  // =========================================================================
  const resumenComisionesPorFiltro = useMemo(() => {
    const mapa = {};
    revendedores.forEach((r) => {
      mapa[r.id] = {
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono,
        ventas: 0,
        tePago: 0,
        profitParaMi: 0,
        gananciaDeEl: 0,
        comisionEstimada5Pct: 0
      };
    });

    suscripciones
      .filter((s) => !s.en_papelera && s.tipo_comprador === "revendedor")
      .forEach((s) => {
        const f = extraerFechaLocalISO(s.fecha_venta);
        if (periodoHistorialBono === "dia" && f !== fechaHistBono) return;
        if (periodoHistorialBono === "semana" && (f < lunesSemanaActualISO || f > hoyISO)) return;
        if (periodoHistorialBono === "mes" && !f.startsWith(mesHistBono)) return;

        let target = mapa[s.revendedor_id];
        if (!target) {
          target = Object.values(mapa).find((r) => r.telefono === s.telefono_cliente);
        }
        if (target) {
          const profMio = calcularGananciaAdminDeVenta(s);
          const ganEl = calcularGananciaPropiaDelRevendedor(s);
          target.ventas += 1;
          target.tePago += Number(s.precio_venta || 0);
          target.profitParaMi += profMio;
          target.gananciaDeEl += ganEl;
          target.comisionEstimada5Pct = Math.max(0, target.profitParaMi * (Number(pctTop1 || 5) / 100));
        }
      });

    return Object.values(mapa).sort((a, b) => b.profitParaMi - a.profitParaMi);
  }, [
    revendedores,
    suscripciones,
    matrices,
    periodoHistorialBono,
    fechaHistBono,
    lunesSemanaActualISO,
    hoyISO,
    mesHistBono,
    pctTop1
  ]);

  const historialBonosPagados = useMemo(() => {
    return movimientosYolo.filter((m) => String(m.tipo || "").startsWith("Bono Revendedor"));
  }, [movimientosYolo]);

  // Ventas filtradas generales
  const ventasFiltradas = useMemo(() => {
    return suscripciones
      .filter((s) => {
        if (s.en_papelera) return false;
        const f = extraerFechaLocalISO(s.fecha_venta);
        if (periodo === "dia" && f !== fechaEspecifica) return false;
        if (periodo === "mes" && !f.startsWith(mesEspecifico)) return false;
        if (periodo === "anio" && !f.startsWith(anioEspecifico)) return false;

        const tipo = s.tipo_comprador || "cliente";
        if (filtroTipoComprador !== "todos" && tipo !== filtroTipoComprador) return false;

        if (filtroTipoComprador === "revendedor" && revendedorSeleccionado !== "todos") {
          const coincideId = s.revendedor_id === revendedorSeleccionado;
          const revObj = revendedores.find((r) => r.id === revendedorSeleccionado);
          const coincideTel = revObj && s.telefono_cliente === revObj.telefono;
          if (!coincideId && !coincideTel) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.creado_en || "").localeCompare(String(a.creado_en || "")));
  }, [suscripciones, periodo, fechaEspecifica, mesEspecifico, anioEspecifico, filtroTipoComprador, revendedorSeleccionado, revendedores]);

  const movimientosFiltrados = useMemo(() => {
    return movimientosYolo.filter((m) => {
      const f = extraerFechaLocalISO(m.fecha);
      if (periodo === "dia" && f !== fechaEspecifica) return false;
      if (periodo === "mes" && !f.startsWith(mesEspecifico)) return false;
      if (periodo === "anio" && !f.startsWith(anioEspecifico)) return false;
      return true;
    });
  }, [movimientosYolo, periodo, fechaEspecifica, mesEspecifico, anioEspecifico]);

  const totalVendidoPeriodo = ventasFiltradas.reduce((acc, s) => acc + Number(s.precio_venta || 0), 0);
  const gananciaVentasPeriodo = ventasFiltradas.reduce((acc, s) => acc + calcularGananciaAdminDeVenta(s), 0);
  const gananciaNetaContablePeriodo = movimientosFiltrados
    .filter((m) => m.afecta_ganancia_neta)
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const saldoTotalBilletera = movimientosYolo.reduce((acc, m) => acc + Number(m.monto || 0), 0);

  // Gráfica #1: Tu Profit General
  const { serie: serieBursatil, prevision30d: previsionMensualProfit } = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((s) => {
      const f = extraerFechaLocalISO(s.fecha_venta);
      if (!mapa[f]) mapa[f] = { fecha: f, ventas: 0, ingreso: 0, ganancia: 0, esPrediccion: false };
      mapa[f].ventas += 1;
      mapa[f].ingreso += Number(s.precio_venta || 0);
      mapa[f].ganancia += calcularGananciaAdminDeVenta(s);
    });
    return armarSerieConPrediccion(mapa);
  }, [ventasFiltradas, matrices]);

  // =========================================================================
  // GRÁFICA #2: DISTINGUE CLARAMENTE "PROFIT QUE ME GENERARON A MÍ" VS "GANANCIA DE ELLOS"
  // =========================================================================
  const {
    serie: serieRevendedores,
    prevision30d: previsionRevendedores30d,
    totalProfitParaMiRev,
    totalGananciaDeEllosRev
  } = useMemo(() => {
    const mapa = {};
    let sumaProfitParaMi = 0;
    let sumaGananciaDeEllos = 0;

    suscripciones
      .filter((s) => {
        if (s.en_papelera || s.tipo_comprador !== "revendedor") return false;
        const f = extraerFechaLocalISO(s.fecha_venta);
        if (periodo === "dia" && f !== fechaEspecifica) return false;
        if (periodo === "mes" && !f.startsWith(mesEspecifico)) return false;
        if (periodo === "anio" && !f.startsWith(anioEspecifico)) return false;

        if (revendedorGraficaDos !== "todos") {
          const rObj = revendedores.find((r) => r.id === revendedorGraficaDos);
          const coincide =
            s.revendedor_id === revendedorGraficaDos ||
            (rObj && s.telefono_cliente === rObj.telefono);
          if (!coincide) return false;
        }
        return true;
      })
      .forEach((s) => {
        const f = extraerFechaLocalISO(s.fecha_venta);
        if (!mapa[f]) {
          mapa[f] = {
            fecha: f,
            ventas: 0,
            ingreso: 0,
            ganancia: 0,
            gananciaParaAdmin: 0,
            gananciaDeEllos: 0,
            esPrediccion: false
          };
        }

        const profitMio = calcularGananciaAdminDeVenta(s);
        const gananciaEl = calcularGananciaPropiaDelRevendedor(s);

        sumaProfitParaMi += profitMio;
        sumaGananciaDeEllos += gananciaEl;

        mapa[f].ventas += 1;
        mapa[f].gananciaParaAdmin += profitMio;
        mapa[f].gananciaDeEllos += gananciaEl;
        mapa[f].ingreso += Number(s.precio_venta || 0);
        // La curva principal dibuja lo que elegiste en el botón selector ('para_mi' o 'de_ellos')
        mapa[f].ganancia += modoMetricaRevendedores === "para_mi" ? profitMio : gananciaEl;
      });

    const res = armarSerieConPrediccion(mapa);
    return {
      ...res,
      totalProfitParaMiRev: sumaProfitParaMi,
      totalGananciaDeEllosRev: sumaGananciaDeEllos
    };
  }, [
    suscripciones,
    matrices,
    periodo,
    fechaEspecifica,
    mesEspecifico,
    anioEspecifico,
    revendedorGraficaDos,
    revendedores,
    modoMetricaRevendedores
  ]);

  const construirGeometriaSVG = (serie, activeIdx) => {
    const svgWidth = 680;
    const svgHeight = 200;
    const padX = 32;
    const padY = 24;
    const maxVal = Math.max(...serie.map((d) => Math.max(d.ingreso, d.ganancia, 10)), 10);

    const puntos = serie.map((d, i) => {
      const total = Math.max(1, serie.length - 1);
      const x = padX + (i / total) * (svgWidth - padX * 2);
      const yGan = svgHeight - padY - (Math.max(0, d.ganancia) / maxVal) * (svgHeight - padY * 2);
      return { ...d, idx: i, x, yGan };
    });

    const reales = puntos.filter((p) => !p.esPrediccion);
    const preds = puntos.filter((p, idx) => p.esPrediccion || idx === reales.length - 1);

    const rutaReal = reales.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.yGan.toFixed(1)}`).join(" ");
    const rutaArea =
      reales.length > 0
        ? `${rutaReal} L ${reales[reales.length - 1].x.toFixed(1)} ${svgHeight - padY} L ${reales[0].x.toFixed(1)} ${svgHeight - padY} Z`
        : "";
    const rutaPred = preds.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.yGan.toFixed(1)}`).join(" ");

    const seleccionado =
      activeIdx !== null && puntos[activeIdx] ? puntos[activeIdx] : reales[reales.length - 1] || null;

    return { svgWidth, svgHeight, padX, padY, puntos, rutaReal, rutaArea, rutaPred, seleccionado };
  };

  const geoAdmin = construirGeometriaSVG(serieBursatil, puntoActivoIdx);
  const geoRev = construirGeometriaSVG(serieRevendedores, puntoActivoRevIdx);

  const rankingPlataformas = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((s) => {
      if (!mapa[s.plataforma]) mapa[s.plataforma] = { nombre: s.plataforma, cantidad: 0, monto: 0 };
      mapa[s.plataforma].cantidad += 1;
      mapa[s.plataforma].monto += Number(s.precio_venta || 0);
    });
    return Object.values(mapa).sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasFiltradas]);

  return (
    <div className="space-y-6">
      {/* BARRA DE FILTROS + BOTÓN EMERGENTE DE BONO SEMANAL (CICLO DOMINGOS) */}
      <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#66FF00]" /> Estadísticas & Trading de Profit MOSS
            </h2>
            <p className="text-xs text-gray-400">
              Hoy en Santa Cruz: <b className="text-[#66FF00]">{formatearFechaDMA(hoyISO)}</b> · Toca cualquier pico de las gráficas para ver el detalle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "dia", label: "Por Día" },
              { id: "mes", label: "Por Mes" },
              { id: "anio", label: "Por Año" },
              { id: "todo", label: "Histórico" }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  periodo === p.id
                    ? "bg-[#66FF00] text-black border-[#66FF00]"
                    : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                }`}
              >
                {p.label}
              </button>
            ))}

            {periodo === "dia" && (
              <input
                type="date"
                value={fechaEspecifica}
                onChange={(e) => setFechaEspecifica(e.target.value)}
                className="bg-[#070B06] border border-[#66FF00] rounded-xl px-3 py-1.5 text-xs text-white"
              />
            )}
            {periodo === "mes" && (
              <input
                type="month"
                value={mesEspecifico}
                onChange={(e) => setMesEspecifico(e.target.value)}
                className="bg-[#070B06] border border-[#66FF00] rounded-xl px-3 py-1.5 text-xs text-white"
              />
            )}
            {periodo === "anio" && (
              <input
                type="number"
                min="2024"
                max="2035"
                value={anioEspecifico}
                onChange={(e) => setAnioEspecifico(e.target.value)}
                className="w-24 bg-[#070B06] border border-[#66FF00] rounded-xl px-3 py-1.5 text-xs text-white"
              />
            )}

            <button
              type="button"
              onClick={() => setModalBonoAbierto(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-black flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(251,191,36,0.3)]"
            >
              <Trophy className="w-4 h-4" /> Bono Domingo & Historial (Top {cantidadGanadoresTop})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#1E331A]">
          <span className="text-xs text-gray-400 font-bold mr-1">Filtrar comprador:</span>
          {[
            { id: "todos", label: "Todos (Clientes + Revendedores)" },
            { id: "cliente", label: "👤 Solo Clientes Finales" },
            { id: "revendedor", label: "🤝 Solo Revendedores" }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFiltroTipoComprador(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                filtroTipoComprador === t.id
                  ? "bg-[#66FF00] text-black border-[#66FF00]"
                  : "bg-[#070B06] text-gray-300 border-[#2A4226]"
              }`}
            >
              {t.label}
            </button>
          ))}

          {filtroTipoComprador === "revendedor" && (
            <select
              value={revendedorSeleccionado}
              onChange={(e) => setRevendedorSeleccionado(e.target.value)}
              className="bg-[#070B06] border border-[#66FF00] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
            >
              <option value="todos">-- Todos los Revendedores --</option>
              {revendedores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.telefono})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* RESUMEN DE TARJETAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 font-bold uppercase">Cuentas Vendidas</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">{ventasFiltradas.length}</p>
          <p className="text-[10px] text-gray-400">Ingreso: Bs {totalVendidoPeriodo.toFixed(2)}</p>
        </div>

        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 font-bold uppercase">Mi Profit Real Ventas</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">Bs {gananciaVentasPeriodo.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">Neto c/Matrices: Bs {gananciaNetaContablePeriodo.toFixed(2)}</p>
        </div>

        <div className="bg-[#111A10] border border-cyan-500/40 rounded-2xl p-4">
          <p className="text-[11px] text-cyan-300 font-bold uppercase flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Previsión Profit (30d)
          </p>
          <p className="text-2xl font-black text-cyan-300 mt-1">Bs {previsionMensualProfit.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">Proyección según tu ritmo diario</p>
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00]/60 rounded-2xl p-4">
          <p className="text-[11px] text-[#66FF00] font-bold uppercase">Saldo Actual {nombreBilletera}</p>
          <p className="text-2xl font-black text-white mt-1">Bs {saldoTotalBilletera.toFixed(2)}</p>
        </div>
      </div>

      {/* GRÁFICA 1 (TU PROFIT) + TOP PLATAFORMAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> 1. Mi Curva Bursátil de Profit & Predicción IA
              </h3>
              <p className="text-[11px] text-gray-400">
                Muestra tu ganancia neta real por día y tu proyección para los próximos 3 días.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-[#66FF00] font-bold">
                <span className="w-3 h-1 bg-[#66FF00] inline-block rounded" /> Mi Ganancia Real
              </span>
              <span className="flex items-center gap-1 text-cyan-300 font-bold">
                <span className="w-3 h-1 bg-cyan-400 inline-block rounded" /> Predicción (+3 días)
              </span>
            </div>
          </div>

          {geoAdmin.seleccionado && (
            <div
              className={`rounded-2xl p-3 border flex flex-wrap justify-between items-center gap-2 text-xs ${
                geoAdmin.seleccionado.esPrediccion
                  ? "bg-cyan-950/30 border-cyan-500/60 text-cyan-200"
                  : "bg-[#070B06] border-[#66FF00]/60 text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                    geoAdmin.seleccionado.esPrediccion ? "bg-cyan-400 text-black" : "bg-[#66FF00] text-black"
                  }`}
                >
                  {geoAdmin.seleccionado.esPrediccion ? "🔮 Predicción Futura" : "📈 Pico Real"}
                </span>
                <span className="font-mono font-bold text-sm">{formatearFechaDMA(geoAdmin.seleccionado.fecha)}</span>
              </div>

              <div className="flex flex-wrap gap-4">
                <span>Ventas: <b>{geoAdmin.seleccionado.ventas}</b></span>
                <span>Ingreso: <b>Bs {geoAdmin.seleccionado.ingreso.toFixed(2)}</b></span>
                <span className={geoAdmin.seleccionado.esPrediccion ? "text-cyan-300 font-black" : "text-[#66FF00] font-black"}>
                  {geoAdmin.seleccionado.esPrediccion ? "Mi Profit Proyectado:" : "Mi Profit Neto:"} Bs{" "}
                  {geoAdmin.seleccionado.ganancia.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {geoAdmin.puntos.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-500">
              Sin datos en este período.
            </div>
          ) : (
            <div className="relative w-full overflow-x-auto">
              <svg viewBox={`0 0 ${geoAdmin.svgWidth} ${geoAdmin.svgHeight}`} className="w-full h-52 select-none overflow-visible">
                <defs>
                  <linearGradient id="mossStockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#66FF00" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="#66FF00" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0.2, 0.5, 0.8].map((pct, i) => (
                  <line
                    key={i}
                    x1={geoAdmin.padX}
                    y1={geoAdmin.padY + pct * (geoAdmin.svgHeight - geoAdmin.padY * 2)}
                    x2={geoAdmin.svgWidth - geoAdmin.padX}
                    y2={geoAdmin.padY + pct * (geoAdmin.svgHeight - geoAdmin.padY * 2)}
                    stroke="#1E331A"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                ))}

                {geoAdmin.rutaArea && <path d={geoAdmin.rutaArea} fill="url(#mossStockGrad)" />}
                {geoAdmin.rutaReal && (
                  <path d={geoAdmin.rutaReal} fill="none" stroke="#66FF00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {geoAdmin.rutaPred && (
                  <path d={geoAdmin.rutaPred} fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="round" />
                )}

                {geoAdmin.seleccionado && (
                  <line
                    x1={geoAdmin.seleccionado.x}
                    y1={geoAdmin.padY / 2}
                    x2={geoAdmin.seleccionado.x}
                    y2={geoAdmin.svgHeight - geoAdmin.padY}
                    stroke={geoAdmin.seleccionado.esPrediccion ? "#22D3EE" : "#66FF00"}
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                )}

                {geoAdmin.puntos.map((p) => {
                  const esActivo = geoAdmin.seleccionado && geoAdmin.seleccionado.idx === p.idx;
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
                        y={geoAdmin.svgHeight - 6}
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
          <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
            <Award className="w-4 h-4" /> Cuentas Más Vendidas
          </h3>
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {rankingPlataformas.map((p, idx) => {
              const maxCant = rankingPlataformas[0]?.cantidad || 1;
              const pct = Math.round((p.cantidad / maxCant) * 100);
              return (
                <div key={p.nombre} className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-white">#{idx + 1} {p.nombre}</span>
                    <span className="text-[#66FF00]">{p.cantidad} cta(s) · Bs {p.monto.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-2 bg-[#070B06] rounded-full overflow-hidden">
                    <div className="h-full bg-[#66FF00]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEGUNDA GRÁFICA BURSÁTIL: DISTINGUE ENTRE TU PROFIT VS GANANCIA DE ELLOS  */}
      {/* ========================================================================= */}
      <div className="bg-[#111A10] border-2 border-purple-500/40 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-black text-purple-300 uppercase flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" /> 2. Gráfica de Revendedores: Profit Generado para Mí vs. Ganancia de Ellos
            </h3>
            <p className="text-[11px] text-gray-400">
              Aquí ves claramente diferenciados ambos montos. Elige abajo cuál de las dos curvas quieres graficar y proyectar a 30 días.
            </p>
          </div>

          <select
            value={revendedorGraficaDos}
            onChange={(e) => {
              setRevendedorGraficaDos(e.target.value);
              setPuntoActivoRevIdx(null);
            }}
            className="bg-[#070B06] border border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white font-extrabold"
          >
            <option value="todos">🤝 Ver Todos los Revendedores Juntos</option>
            {revendedores.map((r) => (
              <option key={r.id} value={r.id}>
                👤 Solo {r.nombre} ({r.telefono})
              </option>
            ))}
          </select>
        </div>

        {/* CAJAS COMPARATIVAS CLARAS: LO QUE TE GENERARON A TI VS LO QUE GANARON ELLOS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => setModoMetricaRevendedores("para_mi")}
            className={`p-3.5 rounded-2xl border cursor-pointer transition ${
              modoMetricaRevendedores === "para_mi"
                ? "bg-[#142611] border-2 border-[#66FF00]"
                : "bg-[#070B06] border-[#233820]"
            }`}
          >
            <p className="text-[10px] font-black uppercase text-[#66FF00]">
              🟢 1. Profit que ME generaron a Mí (Mateus)
            </p>
            <p className="text-xl font-black text-white mt-0.5">
              Bs {totalProfitParaMiRev.toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400">
              (Lo que me pagaron ellos menos mi costo de matriz/proveedor)
            </p>
          </div>

          <div
            onClick={() => setModoMetricaRevendedores("de_ellos")}
            className={`p-3.5 rounded-2xl border cursor-pointer transition ${
              modoMetricaRevendedores === "de_ellos"
                ? "bg-purple-950/40 border-2 border-purple-400"
                : "bg-[#070B06] border-[#233820]"
            }`}
          >
            <p className="text-[10px] font-black uppercase text-purple-300">
              🟣 2. Ganancia Neta de ELLOS (Revendedores)
            </p>
            <p className="text-xl font-black text-white mt-0.5">
              Bs {totalGananciaDeEllosRev.toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400">
              (Lo que cobraron a sus clientes finales menos lo que me pagaron a mí)
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#070B06] border border-cyan-500/40">
            <p className="text-[10px] font-black uppercase text-cyan-300">
              🔮 Previsión a 30 Días ({modoMetricaRevendedores === "para_mi" ? "Mi Profit por Rev." : "Ganancia de Ellos"})
            </p>
            <p className="text-xl font-black text-cyan-300 mt-0.5">
              Bs {previsionRevendedores30d.toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400">
              Toca la caja 1 o 2 para cambiar la curva de abajo
            </p>
          </div>
        </div>

        {/* DETALLE AL TOCAR UN PICO DE LA GRÁFICA #2 (MUESTRA AMBOS PROFITS) */}
        {geoRev.seleccionado && (
          <div
            className={`rounded-2xl p-3 border flex flex-wrap justify-between items-center gap-2 text-xs ${
              geoRev.seleccionado.esPrediccion
                ? "bg-cyan-950/30 border-cyan-500/60 text-cyan-200"
                : "bg-[#070B06] border-purple-500/60 text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                  geoRev.seleccionado.esPrediccion ? "bg-cyan-400 text-black" : "bg-purple-500 text-white"
                }`}
              >
                {geoRev.seleccionado.esPrediccion ? "🔮 Predicción (+3d)" : "📊 Pico de Revendedores"}
              </span>
              <span className="font-mono font-bold text-sm">{formatearFechaDMA(geoRev.seleccionado.fecha)}</span>
            </div>

            <div className="flex flex-wrap gap-4">
              <span>Ventas: <b>{geoRev.seleccionado.ventas}</b></span>
              <span className="text-[#66FF00] font-black">
                🟢 Profit p/Mí (Admin): Bs {Number(geoRev.seleccionado.gananciaParaAdmin ?? geoRev.seleccionado.ganancia).toFixed(2)}
              </span>
              <span className="text-purple-300 font-black">
                🟣 Ganancia de Ellos: Bs {Number(geoRev.seleccionado.gananciaDeEllos ?? geoRev.seleccionado.ganancia).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {geoRev.puntos.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-gray-500">
            Aún no hay ventas de este revendedor en el período seleccionado.
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <svg viewBox={`0 0 ${geoRev.svgWidth} ${geoRev.svgHeight}`} className="w-full h-52 select-none overflow-visible">
              <defs>
                <linearGradient id="revStockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={modoMetricaRevendedores === "para_mi" ? "#66FF00" : "#A855F7"}
                    stopOpacity="0.42"
                  />
                  <stop
                    offset="100%"
                    stopColor={modoMetricaRevendedores === "para_mi" ? "#66FF00" : "#A855F7"}
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {[0.2, 0.5, 0.8].map((pct, i) => (
                <line
                  key={i}
                  x1={geoRev.padX}
                  y1={geoRev.padY + pct * (geoRev.svgHeight - geoRev.padY * 2)}
                  x2={geoRev.svgWidth - geoRev.padX}
                  y2={geoRev.padY + pct * (geoRev.svgHeight - geoRev.padY * 2)}
                  stroke="#1E331A"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              ))}

              {geoRev.rutaArea && <path d={geoRev.rutaArea} fill="url(#revStockGrad)" />}
              {geoRev.rutaReal && (
                <path
                  d={geoRev.rutaReal}
                  fill="none"
                  stroke={modoMetricaRevendedores === "para_mi" ? "#66FF00" : "#C084FC"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {geoRev.rutaPred && (
                <path d={geoRev.rutaPred} fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="round" />
              )}

              {geoRev.seleccionado && (
                <line
                  x1={geoRev.seleccionado.x}
                  y1={geoRev.padY / 2}
                  x2={geoRev.seleccionado.x}
                  y2={geoRev.svgHeight - geoRev.padY}
                  stroke={
                    geoRev.seleccionado.esPrediccion
                      ? "#22D3EE"
                      : modoMetricaRevendedores === "para_mi"
                      ? "#66FF00"
                      : "#C084FC"
                  }
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              )}

              {geoRev.puntos.map((p) => {
                const esActivo = geoRev.seleccionado && geoRev.seleccionado.idx === p.idx;
                return (
                  <g
                    key={p.fecha}
                    onMouseEnter={() => setPuntoActivoRevIdx(p.idx)}
                    onClick={() => setPuntoActivoRevIdx(p.idx)}
                    className="cursor-pointer"
                  >
                    <circle cx={p.x} cy={p.yGan} r="16" fill="transparent" />
                    <circle
                      cx={p.x}
                      cy={p.yGan}
                      r={esActivo ? "6.5" : "4"}
                      fill={
                        p.esPrediccion
                          ? "#22D3EE"
                          : modoMetricaRevendedores === "para_mi"
                          ? "#66FF00"
                          : "#C084FC"
                      }
                      stroke="#070B06"
                      strokeWidth="2"
                    />
                    <text
                      x={p.x}
                      y={p.yGan - 10}
                      textAnchor="middle"
                      fill={
                        p.esPrediccion
                          ? "#67E8F9"
                          : modoMetricaRevendedores === "para_mi"
                          ? "#66FF00"
                          : "#D8B4FE"
                      }
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {p.ganancia.toFixed(0)}
                    </text>
                    <text
                      x={p.x}
                      y={geoRev.svgHeight - 6}
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

      {/* REGISTRO EN ORDEN DE HORA */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
            <Clock className="w-4 h-4" /> Últimas Ventas Registradas por Orden de Hora ({ventasFiltradas.length})
          </h3>
          <span className="text-xs text-gray-400">La última registrada aparece primero arriba</span>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {ventasFiltradas.slice(0, 40).map((s) => {
            const esRev = s.tipo_comprador === "revendedor";
            const horaStr = s.creado_en
              ? new Date(s.creado_en).toLocaleTimeString("es-BO", {
                  timeZone: "America/La_Paz",
                  hour: "2-digit",
                  minute: "2-digit"
                })
              : "";

            return (
              <div
                key={s.id}
                className="bg-[#070B06] border border-[#1E331A] rounded-xl p-3 flex flex-wrap justify-between items-center gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#66FF00]/20 text-[#66FF00] font-extrabold text-[10px]">
                      {s.plataforma}
                    </span>
                    <span className="text-gray-400 font-mono text-[11px]">
                      {formatearFechaDMA(s.fecha_venta)} {horaStr}
                    </span>
                    <span className="font-bold text-white">
                      {esRev ? `🤝 Rev: ${s.nombre_cliente}` : `👤 Cli: ${s.nombre_cliente}`}
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Cuenta: <span className="text-white font-mono">{s.correo_cuenta}</span> ({s.nombre_perfil})
                    {esRev && s.nombre_cliente_final && (
                      <span className="text-[#66FF00] font-bold ml-2">
                        👉 Su cliente final: {s.nombre_cliente_final} (📞 {s.telefono_cliente_final})
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-black text-[#66FF00]">
                    Te pagó: Bs {Number(s.precio_venta).toFixed(2)} (Mi Profit: Bs {calcularGananciaAdminDeVenta(s).toFixed(1)})
                  </p>
                  {esRev && (
                    <p className="text-[11px] text-purple-300">
                      Lo vendió a: Bs {Number(s.precio_venta_revendedor || 0).toFixed(2)} (Ganancia de él: Bs {calcularGananciaPropiaDelRevendedor(s).toFixed(1)})
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL EMERGENTE: CICLO DE DOMINGO + HISTORIAL DE BONOS Y COMISIONES       */}
      {/* ========================================================================= */}
      {modalBonoAbierto && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-amber-400 rounded-3xl p-5 sm:p-6 max-w-5xl w-full space-y-5 shadow-[0_0_50px_rgba(251,191,36,0.25)] max-h-[94vh] overflow-y-auto animate-modal">
            <div className="flex flex-wrap justify-between items-center border-b border-[#233820] pb-3 gap-2">
              <div>
                <h3 className="font-black text-amber-400 text-base sm:text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5" /> Ciclo Semanal de Domingos (Bono sobre Profit que ME generaron)
                </h3>
                <p className="text-[11px] text-gray-400">
                  Semana actual desde el Lunes {formatearFechaDMA(lunesSemanaActualISO)} · Cuando terminas de pagar a todos los del Top elegido, el ciclo se reinicia automáticamente.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => reiniciarCicloSemanalDomingo(false)}
                  className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-500/50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reiniciar Semana Manualmente
                </button>
                <button onClick={() => setModalBonoAbierto(false)} className="text-gray-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PESTAÑAS DENTRO DEL MODAL: 1. CICLO ACTUAL DE DOMINGO | 2. HISTORIAL Y COMISIONES POR FILTRO */}
            <div className="grid grid-cols-2 gap-2 bg-[#070B06] p-1.5 rounded-2xl border border-[#233820]">
              <button
                type="button"
                onClick={() => setTabModalBono("ciclo_actual")}
                className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                  tabModalBono === "ciclo_actual"
                    ? "bg-amber-400 text-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                <Trophy className="w-4 h-4" /> 1. Ranking de Esta Semana (Pagar Top {cantidadGanadoresTop})
              </button>
              <button
                type="button"
                onClick={() => setTabModalBono("historial")}
                className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                  tabModalBono === "historial"
                    ? "bg-[#66FF00] text-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                <History className="w-4 h-4" /> 2. Historial de Pagos & Comisiones por Filtro ({historialBonosPagados.length})
              </button>
            </div>

            {tabModalBono === "ciclo_actual" ? (
              <>
                {/* CONFIGURACIÓN DEL TOP (SOLO LOS ELEGIDOS TIENEN BOTÓN DE PAGAR) */}
                <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="text-xs text-gray-300 font-bold block">
                      ¿A cuántos mejores de la semana vas a pagar este domingo? (Solo a ellos les saldrá el botón Pagar):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { n: 1, texto: "🥇 Solo al Top 1" },
                        { n: 2, texto: "🥈 A los Mejores 2 (Top 2)" },
                        { n: 3, texto: "🥉 A los Mejores 3 (Top 3)" }
                      ].map((op) => (
                        <button
                          key={op.n}
                          type="button"
                          onClick={() => {
                            setCantidadGanadoresTop(op.n);
                            localStorage.setItem("moss_top_count", String(op.n));
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                            cantidadGanadoresTop === op.n
                              ? "bg-amber-400 text-black border-amber-400"
                              : "bg-[#111A10] text-gray-300 border-[#2A4226]"
                          }`}
                        >
                          {op.texto}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-300 font-bold">🥇 #1 (%):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={pctTop1}
                        onChange={(e) => {
                          setPctTop1(e.target.value);
                          localStorage.setItem("moss_pct_bono_1", e.target.value);
                        }}
                        className="w-16 bg-[#111A10] border border-amber-400 rounded-xl p-1.5 text-center text-white font-black"
                      />
                    </div>

                    {cantidadGanadoresTop >= 2 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-300 font-bold">🥈 #2 (%):</span>
                        <input
                          type="number"
                          step="0.5"
                          value={pctTop2}
                          onChange={(e) => {
                            setPctTop2(e.target.value);
                            localStorage.setItem("moss_pct_bono_2", e.target.value);
                          }}
                          className="w-16 bg-[#111A10] border border-gray-400 rounded-xl p-1.5 text-center text-white font-black"
                        />
                      </div>
                    )}

                    {cantidadGanadoresTop >= 3 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-orange-300 font-bold">🥉 #3 (%):</span>
                        <input
                          type="number"
                          step="0.5"
                          value={pctTop3}
                          onChange={(e) => {
                            setPctTop3(e.target.value);
                            localStorage.setItem("moss_pct_bono_3", e.target.value);
                          }}
                          className="w-16 bg-[#111A10] border border-orange-400 rounded-xl p-1.5 text-center text-white font-black"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* DOS COLUMNAS: IZQUIERDA (SOLO LOS GANADORES DEL TOP ELEGIDO PARA PAGAR) | DERECHA (TABLA RANKING) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5 space-y-3">
                    <h4 className="text-xs font-black uppercase text-amber-300">
                      🏆 Ganadores del Top {cantidadGanadoresTop} para Pagar ({ganadoresActivosPodio.length})
                    </h4>

                    {ganadoresActivosPodio.length === 0 ? (
                      <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-6 text-center text-xs text-gray-400">
                        Sin ventas registradas en el ciclo actual (o ya pagaste y se reinició la semana). Revisa la pestaña de Historial al lado.
                      </div>
                    ) : (
                      ganadoresActivosPodio.map((g) => {
                        const medalla = g.puesto === 1 ? "🥇 #1" : g.puesto === 2 ? "🥈 #2" : "🥉 #3";
                        return (
                          <div
                            key={g.id}
                            className="bg-[#070B06] border-2 border-amber-400/60 rounded-2xl p-4 space-y-2.5"
                          >
                            <div className="flex justify-between items-center">
                              <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-400 text-black uppercase">
                                {medalla} · {g.nombre} ({g.ventasSemana} vtas)
                              </span>
                              <span className="text-xs font-extrabold text-amber-300">
                                Bono {g.pctAplicado}%: Bs {g.bonoCalculado.toFixed(2)}
                              </span>
                            </div>

                            <div className="text-xs text-gray-300 space-y-0.5">
                              <p>
                                🟢 Profit que ME generó: <b className="text-[#66FF00]">Bs {g.gananciaNetaParaAdmin.toFixed(2)}</b>
                              </p>
                              <p className="text-[11px] text-purple-300">
                                🟣 Ganancia propia de él: Bs {g.gananciaDelRevendedorSemana.toFixed(2)}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => toggleVisibilidadBono(g)}
                                className={`py-2 px-2.5 rounded-xl text-[11px] font-extrabold border flex items-center justify-center gap-1 cursor-pointer ${
                                  g.mostrar_bono_semanal
                                    ? "bg-[#66FF00] text-black border-[#66FF00]"
                                    : "bg-[#111A10] text-gray-300 border-gray-700"
                                }`}
                              >
                                {g.mostrar_bono_semanal ? (
                                  <>
                                    <Eye className="w-3.5 h-3.5" /> Visible (Ocultar)
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" /> Mostrar en Portal
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => pagarBonoAGanadorTop(g)}
                                className={`py-2 px-2.5 rounded-xl text-[11px] font-extrabold border flex items-center justify-center gap-1 cursor-pointer ${
                                  g.bono_semanal_pagado
                                    ? "bg-green-900/50 text-green-300 border-green-500"
                                    : "bg-amber-400 text-black border-amber-400"
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {g.bono_semanal_pagado ? "✓ Pagado" : `Pagar Bs ${g.bonoCalculado.toFixed(1)}`}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* TABLA DE RANKING AL LADO (LOS QUE NO ESTÁN EN EL TOP NO TIENEN BOTÓN DE PAGAR) */}
                  <div className="lg:col-span-7 bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-[#66FF00]">
                        📊 Tabla de Ranking de Esta Semana
                      </h4>
                      <span className="text-[11px] text-gray-400">
                        Solo el Top {cantidadGanadoresTop} tiene habilitado el pago
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#1E331A] text-[10px] text-gray-400 uppercase">
                            <th className="py-2 pr-2">#</th>
                            <th className="py-2 pr-2">Revendedor</th>
                            <th className="py-2 pr-2 text-center">Vtas</th>
                            <th className="py-2 pr-2 text-right">🟢 Profit p/Mí</th>
                            <th className="py-2 pr-2 text-right">🟣 Ganancia Él</th>
                            <th className="py-2 pr-2 text-right">Bono</th>
                            <th className="py-2 text-right">Estado / Pago</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#152213]">
                          {rankingSemanalBono.map((r) => {
                            const medalla =
                              r.puesto === 1
                                ? "🥇 1"
                                : r.puesto === 2
                                ? "🥈 2"
                                : r.puesto === 3
                                ? "🥉 3"
                                : `#${r.puesto}`;
                            return (
                              <tr key={r.id} className={r.entraEnPodio ? "bg-amber-950/15" : "opacity-65"}>
                                <td className="py-2.5 pr-2 font-black text-amber-300">{medalla}</td>
                                <td className="py-2.5 pr-2">
                                  <p className="font-bold text-white">{r.nombre}</p>
                                  <p className="text-[10px] text-gray-500 font-mono">{r.telefono}</p>
                                </td>
                                <td className="py-2.5 pr-2 text-center font-black text-white">
                                  {r.ventasSemana}
                                </td>
                                <td className="py-2.5 pr-2 text-right font-black text-[#66FF00]">
                                  Bs {r.gananciaNetaParaAdmin.toFixed(2)}
                                </td>
                                <td className="py-2.5 pr-2 text-right font-semibold text-purple-300">
                                  Bs {r.gananciaDelRevendedorSemana.toFixed(2)}
                                </td>
                                <td className="py-2.5 pr-2 text-right font-black text-amber-300">
                                  {r.entraEnPodio ? `Bs ${r.bonoCalculado.toFixed(2)} (${r.pctAplicado}%)` : "—"}
                                </td>
                                <td className="py-2.5 text-right">
                                  {r.entraEnPodio ? (
                                    <button
                                      type="button"
                                      onClick={() => pagarBonoAGanadorTop(r)}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                        r.bono_semanal_pagado
                                          ? "bg-green-900/50 text-green-300 border-green-500"
                                          : "bg-amber-400 text-black border-amber-400"
                                      }`}
                                    >
                                      {r.bono_semanal_pagado ? "✓ Pagado" : "Pagar"}
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-gray-500 font-semibold">
                                      Fuera del Top {cantidadGanadoresTop}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* ========================================================================= */
              /* PESTAÑA 2: HISTORIAL DE PAGOS REALIZADOS Y COMISIONES POR FILTRO          */
              /* ========================================================================= */
              <div className="space-y-4">
                <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#66FF00]">
                    Filtrar cuánto generaron de Profit y Comisión en cualquier fecha:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: "dia", label: "Por Día" },
                      { id: "semana", label: "Esta Semana" },
                      { id: "mes", label: "Por Mes" },
                      { id: "todo", label: "Histórico Total" }
                    ].map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setPeriodoHistorialBono(op.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                          periodoHistorialBono === op.id
                            ? "bg-[#66FF00] text-black border-[#66FF00]"
                            : "bg-[#111A10] text-gray-300 border-[#2A4226]"
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}

                    {periodoHistorialBono === "dia" && (
                      <input
                        type="date"
                        value={fechaHistBono}
                        onChange={(e) => setFechaHistBono(e.target.value)}
                        className="bg-[#111A10] border border-[#66FF00] rounded-xl px-2.5 py-1 text-xs text-white"
                      />
                    )}
                    {periodoHistorialBono === "mes" && (
                      <input
                        type="month"
                        value={mesHistBono}
                        onChange={(e) => setMesHistBono(e.target.value)}
                        className="bg-[#111A10] border border-[#66FF00] rounded-xl px-2.5 py-1 text-xs text-white"
                      />
                    )}
                  </div>
                </div>

                {/* TABLA DE PRODUCCIÓN Y COMISIÓN GENERADA SEGÚN EL FILTRO */}
                <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-black uppercase text-[#66FF00]">
                    1. Profit y Comisión Generada en el Período Seleccionado
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#1E331A] text-[10px] text-gray-400 uppercase">
                          <th className="py-2">Revendedor</th>
                          <th className="py-2 text-center">Ventas</th>
                          <th className="py-2 text-right">Te Pagó</th>
                          <th className="py-2 text-right">🟢 Profit p/Mí (Admin)</th>
                          <th className="py-2 text-right">🟣 Ganancia de Él</th>
                          <th className="py-2 text-right">Comisión ({pctTop1}%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#152213]">
                        {resumenComisionesPorFiltro.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 font-bold text-white">{r.nombre}</td>
                            <td className="py-2 text-center font-bold">{r.ventas}</td>
                            <td className="py-2 text-right text-gray-300">Bs {r.tePago.toFixed(2)}</td>
                            <td className="py-2 text-right font-black text-[#66FF00]">
                              Bs {r.profitParaMi.toFixed(2)}
                            </td>
                            <td className="py-2 text-right font-bold text-purple-300">
                              Bs {r.gananciaDeEl.toFixed(2)}
                            </td>
                            <td className="py-2 text-right font-black text-amber-300">
                              Bs {r.comisionEstimada5Pct.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* HISTORIAL DE PAGOS DE BONOS REALIZADOS LOS DOMINGOS */}
                <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-2.5">
                  <h4 className="text-xs font-black uppercase text-amber-300">
                    2. Historial de Bonos Pagados ({historialBonosPagados.length})
                  </h4>
                  {historialBonosPagados.length === 0 ? (
                    <p className="text-xs text-gray-500 py-4 text-center">
                      Aún no has registrado pagos de bonos semanales.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {historialBonosPagados.map((b) => (
                        <div
                          key={b.id}
                          className="bg-[#111A10] border border-[#1E331A] rounded-xl p-2.5 flex justify-between items-center text-xs"
                        >
                          <div>
                            <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[10px]">
                              {b.tipo}
                            </span>
                            <span className="ml-2 text-gray-400 font-mono text-[11px]">
                              {formatearFechaDMA(b.fecha)}
                            </span>
                            <p className="text-gray-200 mt-1">{b.descripcion}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-amber-300">
                              Pagado: Bs {Math.abs(Number(b.monto)).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await supabase.from("movimientos_yolo").delete().eq("id", b.id);
                                await recargarTodo();
                                notificar("Pago de bono eliminado del historial");
                              }}
                              className="text-gray-500 hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}