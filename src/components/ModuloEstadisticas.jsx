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
  Sparkles
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
      esPrediccion: true
    };
  });

  return {
    serie: [...reales, ...proyecciones],
    prevision30d: promGan * 30
  };
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
  const hace7DiasISO = sumarDiasBoliviaISO(-7, hoyISO);
  const mesActualISO = hoyISO.slice(0, 7);
  const anioActualISO = hoyISO.slice(0, 4);

  const [periodo, setPeriodo] = useState("mes");
  const [fechaEspecifica, setFechaEspecifica] = useState(hoyISO);
  const [mesEspecifico, setMesEspecifico] = useState(mesActualISO);
  const [anioEspecifico, setAnioEspecifico] = useState(anioActualISO);

  const [filtroTipoComprador, setFiltroTipoComprador] = useState("todos");
  const [revendedorSeleccionado, setRevendedorSeleccionado] = useState("todos");

  const [revendedorGraficaDos, setRevendedorGraficaDos] = useState("todos");

  // Configuración del Bono Semanal y Podio (Top 1, Top 2, Top 3 o Todos)
  const [modalBonoAbierto, setModalBonoAbierto] = useState(false);
  const [cantidadGanadoresTop, setCantidadGanadoresTop] = useState(1); // 1 | 2 | 3 | 99
  const [pctTop1, setPctTop1] = useState(5);
  const [pctTop2, setPctTop2] = useState(3);
  const [pctTop3, setPctTop3] = useState(2);

  const [puntoActivoIdx, setPuntoActivoIdx] = useState(null);
  const [puntoActivoRevIdx, setPuntoActivoRevIdx] = useState(null);

  useEffect(() => {
    const gTop = localStorage.getItem("moss_top_count");
    const p1 = localStorage.getItem("moss_pct_bono_1");
    const p2 = localStorage.getItem("moss_pct_bono_2");
    const p3 = localStorage.getItem("moss_pct_bono_3");
    if (gTop) setCantidadGanadoresTop(Number(gTop));
    if (p1) setPctTop1(Number(p1));
    if (p2) setPctTop2(Number(p2));
    if (p3) setPctTop3(Number(p3));
  }, []);

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

  // Ranking Semanal Completo de Todos los Revendedores con su posición y porcentaje según el puesto
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
        if (f < hace7DiasISO || f > hoyISO) return;

        let target = mapa[s.revendedor_id];
        if (!target) {
          target = Object.values(mapa).find((r) => r.telefono === s.telefono_cliente);
        }
        if (target) {
          const gananciaMia = calcularGananciaAdminDeVenta(s);
          const cobroRev = Number(s.precio_venta_revendedor || 0);
          const gananciaDeEl = cobroRev > 0 ? cobroRev - Number(s.precio_venta || 0) : 0;

          target.ventasSemana += 1;
          target.ingresoSemana += Number(s.precio_venta || 0);
          target.gananciaNetaParaAdmin += gananciaMia;
          target.gananciaDelRevendedorSemana += gananciaDeEl;
        }
      });

    const ordenados = Object.values(mapa).sort((a, b) =>
      b.ventasSemana !== a.ventasSemana
        ? b.ventasSemana - a.ventasSemana
        : b.gananciaNetaParaAdmin - a.gananciaNetaParaAdmin
    );

    return ordenados.map((item, idx) => {
      const puesto = idx + 1;
      const pctAplicado =
        puesto === 1
          ? Number(pctTop1 || 0)
          : puesto === 2
          ? Number(pctTop2 || 0)
          : Number(pctTop3 || 0);
      const entraEnPodio = puesto <= cantidadGanadoresTop && item.ventasSemana > 0;
      const bonoCalculado = Math.max(0, item.gananciaNetaParaAdmin * (pctAplicado / 100));

      return {
        ...item,
        puesto,
        pctAplicado,
        entraEnPodio,
        bonoCalculado
      };
    });
  }, [revendedores, suscripciones, matrices, hace7DiasISO, hoyISO, pctTop1, pctTop2, pctTop3, cantidadGanadoresTop]);

  const ganadoresActivosPodio = rankingSemanalBono.filter((r) => r.entraEnPodio);

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

  const togglePagoBonoSemanal = async (revObj) => {
    const nuevoPago = !revObj.bono_semanal_pagado;
    await supabase
      .from("revendedores")
      .update({
        bono_semanal_pagado: nuevoPago,
        monto_bono_semanal: Number(revObj.bonoCalculado.toFixed(2)),
        ganancia_generada_semana: Number(revObj.gananciaNetaParaAdmin.toFixed(2))
      })
      .eq("id", revObj.id);

    if (nuevoPago && revObj.bonoCalculado > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          tipo: `Bono Revendedor #${revObj.puesto} (${revObj.pctAplicado}%)`,
          monto: -Math.abs(Number(revObj.bonoCalculado.toFixed(2))),
          afecta_ganancia_neta: true,
          descripcion: `Pago Bono Semanal Puesto #${revObj.puesto} (${revObj.pctAplicado}%) a ${revObj.nombre}`
        }
      ]);
    }
    await recargarTodo();
    notificar(
      nuevoPago
        ? `Bono de Bs ${revObj.bonoCalculado.toFixed(2)} pagado a ${revObj.nombre}`
        : `Bono de ${revObj.nombre} marcado como No Pagado`
    );
  };

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

  const { serie: serieRevendedores, prevision30d: previsionRevendedores30d } = useMemo(() => {
    const mapa = {};
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
        if (!mapa[f]) mapa[f] = { fecha: f, ventas: 0, ingreso: 0, ganancia: 0, esPrediccion: false };
        const loQueCobroElRev = Number(s.precio_venta_revendedor || 0);
        const loQueTePagoATi = Number(s.precio_venta || 0);
        const gananciaDeEl = loQueCobroElRev > 0 ? loQueCobroElRev - loQueTePagoATi : 0;

        mapa[f].ventas += 1;
        mapa[f].ingreso += loQueCobroElRev > 0 ? loQueCobroElRev : loQueTePagoATi;
        mapa[f].ganancia += gananciaDeEl;
      });

    return armarSerieConPrediccion(mapa);
  }, [suscripciones, periodo, fechaEspecifica, mesEspecifico, anioEspecifico, revendedorGraficaDos, revendedores]);

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
      {/* BARRA DE FILTROS + BOTÓN EMERGENTE DE BONO Y RANKING SEMANAL */}
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
              <Trophy className="w-4 h-4" /> Bono & Ranking Semanal (Top {cantidadGanadoresTop === 99 ? "Todos" : cantidadGanadoresTop})
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
          <p className="text-[11px] text-gray-400 font-bold uppercase">Profit Real Ventas</p>
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
                Pasa el mouse o toca cualquier punto en tu celular para ver el pico exacto y la predicción.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-[#66FF00] font-bold">
                <span className="w-3 h-1 bg-[#66FF00] inline-block rounded" /> Ganancia Real
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
                  {geoAdmin.seleccionado.esPrediccion ? "Profit Proyectado:" : "Profit Neto:"} Bs{" "}
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

      {/* SEGUNDA GRÁFICA BURSÁTIL ABAJO: GANANCIAS DE ELLOS (REVENDEDORES) + PREDICCIÓN */}
      <div className="bg-[#111A10] border-2 border-purple-500/40 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-purple-300 uppercase flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" /> 2. Curva Bursátil de Ganancias de Mis Revendedores & Predicción
            </h3>
            <p className="text-[11px] text-gray-400">
              Muestra cuánto están ganando tus revendedores y su proyección a 30 días:{" "}
              <b className="text-cyan-300">Bs {previsionRevendedores30d.toFixed(2)} / mes</b>.
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
                {geoRev.seleccionado.esPrediccion ? "🔮 Predicción Revendedor" : "📊 Pico de Revendedor"}
              </span>
              <span className="font-mono font-bold text-sm">{formatearFechaDMA(geoRev.seleccionado.fecha)}</span>
            </div>

            <div className="flex flex-wrap gap-4">
              <span>Ventas de revendedor: <b>{geoRev.seleccionado.ventas}</b></span>
              <span>Cobrado a sus clientes: <b>Bs {geoRev.seleccionado.ingreso.toFixed(2)}</b></span>
              <span className={geoRev.seleccionado.esPrediccion ? "text-cyan-300 font-black" : "text-purple-300 font-black"}>
                {geoRev.seleccionado.esPrediccion ? "Ganancia Proyectada de Ellos:" : "Ganancia Neta de Ellos:"} Bs{" "}
                {geoRev.seleccionado.ganancia.toFixed(2)}
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
                  <stop offset="0%" stopColor="#A855F7" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0.0" />
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
                <path d={geoRev.rutaReal} fill="none" stroke="#C084FC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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
                  stroke={geoRev.seleccionado.esPrediccion ? "#22D3EE" : "#C084FC"}
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
                      fill={p.esPrediccion ? "#22D3EE" : "#C084FC"}
                      stroke="#070B06"
                      strokeWidth="2"
                    />
                    <text
                      x={p.x}
                      y={p.yGan - 10}
                      textAnchor="middle"
                      fill={p.esPrediccion ? "#67E8F9" : "#D8B4FE"}
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
                  <p className="font-black text-[#66FF00]">Te pagó: Bs {Number(s.precio_venta).toFixed(2)}</p>
                  {esRev && (
                    <p className="text-[11px] text-purple-300">
                      Lo vendió a: Bs {Number(s.precio_venta_revendedor || 0).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL EMERGENTE: GANADORES DE LA SEMANA + TABLA DE RANKING AL LADO        */}
      {/* ========================================================================= */}
      {modalBonoAbierto && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-amber-400 rounded-3xl p-5 sm:p-6 max-w-5xl w-full space-y-5 shadow-[0_0_50px_rgba(251,191,36,0.25)] max-h-[94vh] overflow-y-auto animate-modal">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h3 className="font-black text-amber-400 text-base sm:text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5" /> Bono Semanal & Tabla de Ranking de Revendedores (Últimos 7 Días)
                </h3>
                <p className="text-[11px] text-gray-400">
                  Semana del {formatearFechaDMA(hace7DiasISO)} al {formatearFechaDMA(hoyISO)} · El bono se calcula sobre la Ganancia Neta que te dejó cada uno.
                </p>
              </div>
              <button onClick={() => setModalBonoAbierto(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BARRA SUPERIOR: ACTIVAR TOP 1, TOP 2, TOP 3 O TODOS + PORCENTAJES POR PUESTO */}
            <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-xs text-gray-300 font-bold block">
                  ¿A cuántos mejores de la semana quieres premiar?
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { n: 1, texto: "🥇 Solo Top 1" },
                    { n: 2, texto: "🥈 Top 2 Mejores" },
                    { n: 3, texto: "🥉 Top 3 Mejores" },
                    { n: 99, texto: "🏆 Todos con ventas" }
                  ].map((op) => (
                    <button
                      key={op.n}
                      type="button"
                      onClick={() => {
                        setCantidadGanadoresTop(op.n);
                        localStorage.setItem("moss_top_count", String(op.n));
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
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
                    <span className="text-orange-300 font-bold">🥉 #3+ (%):</span>
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

            {/* DISEÑO A 2 COLUMNAS: IZQUIERDA (PODIO GANADORES) | DERECHA (TABLA RANKING COMPLETA) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* COLUMNA IZQUIERDA: TARJETAS DE LOS GANADORES SELECCIONADOS */}
              <div className="lg:col-span-5 space-y-3">
                <h4 className="text-xs font-black uppercase text-amber-300">
                  🏆 Premiados Activos ({ganadoresActivosPodio.length})
                </h4>

                {ganadoresActivosPodio.length === 0 ? (
                  <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-6 text-center text-xs text-gray-400">
                    Ningún revendedor registra ventas en los últimos 7 días.
                  </div>
                ) : (
                  ganadoresActivosPodio.map((g) => {
                    const medalla = g.puesto === 1 ? "🥇 #1" : g.puesto === 2 ? "🥈 #2" : `🥉 #${g.puesto}`;
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
                            Te pagó: <b>Bs {g.ingresoSemana.toFixed(2)}</b> · Ganancia Neta p/Ti:{" "}
                            <b className="text-[#66FF00]">Bs {g.gananciaNetaParaAdmin.toFixed(2)}</b>
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
                            onClick={() => togglePagoBonoSemanal(g)}
                            className={`py-2 px-2.5 rounded-xl text-[11px] font-extrabold border flex items-center justify-center gap-1 cursor-pointer ${
                              g.bono_semanal_pagado
                                ? "bg-green-900/50 text-green-300 border-green-500"
                                : "bg-amber-400 text-black border-amber-400"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {g.bono_semanal_pagado ? "✓ Bono Pagado" : "Pagar Bono"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* COLUMNA DERECHA: TABLA DE RANKING COMPLETA DE TODOS LOS REVENDEDORES */}
              <div className="lg:col-span-7 bg-[#070B06] border border-[#233820] rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase text-[#66FF00]">
                    📊 Tabla de Ranking Semanal (Cuánto generó cada uno)
                  </h4>
                  <span className="text-[11px] text-gray-400">
                    Puedes pagar o mostrar bono a cualquiera desde la tabla
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#1E331A] text-[10px] text-gray-400 uppercase">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Revendedor</th>
                        <th className="py-2 pr-2 text-center">Ventas</th>
                        <th className="py-2 pr-2 text-right">Te Pagó</th>
                        <th className="py-2 pr-2 text-right">Tu Profit Neto</th>
                        <th className="py-2 pr-2 text-right">Bono</th>
                        <th className="py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#152213]">
                      {rankingSemanalBono.map((r) => {
                        const medalla = r.puesto === 1 ? "🥇 1" : r.puesto === 2 ? "🥈 2" : r.puesto === 3 ? "🥉 3" : `#${r.puesto}`;
                        return (
                          <tr
                            key={r.id}
                            className={r.entraEnPodio ? "bg-amber-950/15" : ""}
                          >
                            <td className="py-2.5 pr-2 font-black text-amber-300">{medalla}</td>
                            <td className="py-2.5 pr-2">
                              <p className="font-bold text-white">{r.nombre}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{r.telefono}</p>
                            </td>
                            <td className="py-2.5 pr-2 text-center font-black text-white">
                              {r.ventasSemana}
                            </td>
                            <td className="py-2.5 pr-2 text-right font-semibold text-gray-300">
                              Bs {r.ingresoSemana.toFixed(2)}
                            </td>
                            <td className="py-2.5 pr-2 text-right font-black text-[#66FF00]">
                              Bs {r.gananciaNetaParaAdmin.toFixed(2)}
                            </td>
                            <td className="py-2.5 pr-2 text-right font-black text-amber-300">
                              Bs {r.bonoCalculado.toFixed(2)}
                              <span className="block text-[9px] text-gray-400">({r.pctAplicado}%)</span>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleVisibilidadBono(r)}
                                  className={`p-1.5 rounded-lg border cursor-pointer ${
                                    r.mostrar_bono_semanal
                                      ? "bg-[#66FF00] text-black border-[#66FF00]"
                                      : "bg-[#111A10] text-gray-400 border-gray-700"
                                  }`}
                                  title={r.mostrar_bono_semanal ? "Ocultar de su portal" : "Mostrar en su portal"}
                                >
                                  {r.mostrar_bono_semanal ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => togglePagoBonoSemanal(r)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                    r.bono_semanal_pagado
                                      ? "bg-green-900/50 text-green-300 border-green-500"
                                      : "bg-amber-400 text-black border-amber-400"
                                  }`}
                                >
                                  {r.bono_semanal_pagado ? "✓ Pagado" : "Pagar"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}