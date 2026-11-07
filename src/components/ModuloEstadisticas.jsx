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
  Wallet,
  Trophy,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  X,
  Sparkles
} from "lucide-react";

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

  // Modal Emergente de Bono Semanal + Porcentaje Editable
  const [modalBonoAbierto, setModalBonoAbierto] = useState(false);
  const [porcentajeBono, setPorcentajeBono] = useState(5);

  // Punto seleccionado en la Gráfica Bursátil Interactiva (Mouse o Touch en Celular)
  const [puntoActivoIdx, setPuntoActivoIdx] = useState(null);

  useEffect(() => {
    const guardado = localStorage.getItem("moss_pct_bono");
    if (guardado) setPorcentajeBono(Number(guardado));
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

  // Ranking Semanal con Porcentaje Editable (por defecto 5%)
  const rankingSemanalBono = useMemo(() => {
    const pct = Number(porcentajeBono || 0) / 100;
    const mapa = {};
    revendedores.forEach((r) => {
      mapa[r.id] = {
        ...r,
        ventasSemana: 0,
        ingresoSemana: 0,
        gananciaNetaParaAdmin: 0,
        bonoCalculado: 0
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
          target.ventasSemana += 1;
          target.ingresoSemana += Number(s.precio_venta || 0);
          target.gananciaNetaParaAdmin += gananciaMia;
          target.bonoCalculado = Math.max(0, target.gananciaNetaParaAdmin * pct);
        }
      });

    return Object.values(mapa).sort((a, b) =>
      b.ventasSemana !== a.ventasSemana
        ? b.ventasSemana - a.ventasSemana
        : b.gananciaNetaParaAdmin - a.gananciaNetaParaAdmin
    );
  }, [revendedores, suscripciones, matrices, hace7DiasISO, hoyISO, porcentajeBono]);

  const ganadorSemana =
    rankingSemanalBono[0] && rankingSemanalBono[0].ventasSemana > 0
      ? rankingSemanalBono[0]
      : null;

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
        ? `Bono del ${porcentajeBono}% visible en el portal de ${revObj.nombre}`
        : `Bono ocultado del portal de ${revObj.nombre}`
    );
  };

  const togglePagoBonoSemanal = async (revObj) => {
    const nuevoPago = !revObj.bono_semanal_pagado;
    await supabase
      .from("revendedores")
      .update({
        bono_semanal_pagado: nuevoPago,
        monto_bono_semanal: Number(revObj.bonoCalculado.toFixed(2))
      })
      .eq("id", revObj.id);

    if (nuevoPago && revObj.bonoCalculado > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          tipo: `Bono Revendedor ${porcentajeBono}%`,
          monto: -Math.abs(Number(revObj.bonoCalculado.toFixed(2))),
          afecta_ganancia_neta: true,
          descripcion: `Pago Bono Semanal ${porcentajeBono}% a mejor revendedor (${revObj.nombre})`
        }
      ]);
    }
    await recargarTodo();
    notificar(nuevoPago ? "Bono marcado como Pagado" : "Marcado como No Pagado");
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

  // =========================================================================
  // SERIE TEMPORAL + PREDICCIÓN LINEAL DE PROFIT (ESTILO BOLSA DE VALORES)
  // =========================================================================
  const serieBursatil = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((s) => {
      const f = extraerFechaLocalISO(s.fecha_venta);
      if (!mapa[f]) mapa[f] = { fecha: f, ventas: 0, ingreso: 0, ganancia: 0, esPrediccion: false };
      mapa[f].ventas += 1;
      mapa[f].ingreso += Number(s.precio_venta || 0);
      mapa[f].ganancia += calcularGananciaAdminDeVenta(s);
    });

    const reales = Object.values(mapa)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-12);

    if (reales.length === 0) return [];

    // Calcular pendiente de tendencia (Regresión Lineal / Media Móvil Ponderada) para proyectar los próximos 3 días
    const n = reales.length;
    const promedioGanancia = reales.reduce((a, b) => a + b.ganancia, 0) / n;
    const promedioIngreso = reales.reduce((a, b) => a + b.ingreso, 0) / n;
    const promedioVentas = Math.max(1, Math.round(reales.reduce((a, b) => a + b.ventas, 0) / n));

    let pendienteGan = 0;
    if (n >= 2) {
      const ult = reales[n - 1].ganancia;
      const ant = reales[Math.max(0, n - 3)].ganancia;
      pendienteGan = (ult - ant) / Math.min(3, n);
    }

    const ultimaFechaReal = reales[n - 1].fecha;
    const proyecciones = [1, 2, 3].map((d) => {
      const fechaFutura = sumarDiasBoliviaISO(d, ultimaFechaReal);
      const ganEstimada = Math.max(
        promedioGanancia * 0.6,
        promedioGanancia + pendienteGan * d * 0.45
      );
      const ingEstimado = Math.max(ganEstimada, promedioIngreso + pendienteGan * d * 0.5);
      return {
        fecha: fechaFutura,
        ventas: promedioVentas,
        ingreso: Number(ingEstimado.toFixed(2)),
        ganancia: Number(ganEstimada.toFixed(2)),
        esPrediccion: true
      };
    });

    return [...reales, ...proyecciones];
  }, [ventasFiltradas, matrices]);

  // Previsión estimada a 30 días según el ritmo diario real
  const previsionMensualProfit = useMemo(() => {
    const reales = serieBursatil.filter((x) => !x.esPrediccion);
    if (reales.length === 0) return 0;
    const promDiario = reales.reduce((a, b) => a + b.ganancia, 0) / reales.length;
    return promDiario * 30;
  }, [serieBursatil]);

  // Geometría SVG para la gráfica estilo Trading / Bolsa de Valores
  const svgWidth = 680;
  const svgHeight = 210;
  const padX = 32;
  const padY = 24;

  const maxValorSerie = Math.max(
    ...serieBursatil.map((d) => Math.max(d.ingreso, d.ganancia, 10)),
    10
  );

  const puntosSVG = serieBursatil.map((d, i) => {
    const total = Math.max(1, serieBursatil.length - 1);
    const x = padX + (i / total) * (svgWidth - padX * 2);
    const yGan = svgHeight - padY - (Math.max(0, d.ganancia) / maxValorSerie) * (svgHeight - padY * 2);
    const yIng = svgHeight - padY - (Math.max(0, d.ingreso) / maxValorSerie) * (svgHeight - padY * 2);
    return { ...d, idx: i, x, yGan, yIng };
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
      {/* BARRA DE FILTROS DE TIEMPO + BOTÓN DISCRETO DE BONO SEMANAL EMERGENTE */}
      <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#66FF00]" /> Estadísticas & Trading de Profit MOSS
            </h2>
            <p className="text-xs text-gray-400">
              Hoy en Santa Cruz: <b className="text-[#66FF00]">{formatearFechaDMA(hoyISO)}</b> · Toca cualquier pico de la gráfica para inspeccionarlo.
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

            {/* BOTÓN EMERGENTE PARA VER / CONFIGURAR BONO SEMANAL DE REVENDEDOR */}
            <button
              type="button"
              onClick={() => setModalBonoAbierto(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-black flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-4 h-4" /> Bono Semanal ({porcentajeBono}%)
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

      {/* RESUMEN DE TARJETAS + PREVISIÓN MENSUAL DE PROFIT */}
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

      {/* ========================================================================= */}
      {/* GRÁFICA BURSÁTIL INTERACTIVA (BOLSA DE VALORES) + PREDICCIÓN DE PROFIT     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Curva Bursátil de Profit & Predicción IA
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
                <span className="w-3 h-1 bg-cyan-400 inline-block rounded border-b border-dashed" /> Predicción (+3 días)
              </span>
            </div>
          </div>

          {/* PANEL INTERACTIVO DEL PICO SELECCIONADO */}
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
                  {puntoSeleccionado.esPrediccion ? "🔮 Predicción Futura" : "📈 Pico Real"}
                </span>
                <span className="font-mono font-bold text-sm">{formatearFechaDMA(puntoSeleccionado.fecha)}</span>
              </div>

              <div className="flex flex-wrap gap-4">
                <span>
                  Ventas: <b>{puntoSeleccionado.ventas}</b>
                </span>
                <span>
                  Ingreso: <b>Bs {puntoSeleccionado.ingreso.toFixed(2)}</b>
                </span>
                <span className={puntoSeleccionado.esPrediccion ? "text-cyan-300 font-black" : "text-[#66FF00] font-black"}>
                  {puntoSeleccionado.esPrediccion ? "Profit Proyectado:" : "Profit Neto:"} Bs{" "}
                  {puntoSeleccionado.ganancia.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {puntosSVG.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-gray-500">
              Sin datos en este período. Cambia el filtro arriba a "Por Mes" o "Histórico".
            </div>
          ) : (
            <div className="relative w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-56 select-none overflow-visible"
              >
                <defs>
                  <linearGradient id="mossStockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#66FF00" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="#66FF00" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Líneas guía horizontales tipo Trading */}
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

                {/* Área sombreada bajo la curva real */}
                {rutaAreaReal && <path d={rutaAreaReal} fill="url(#mossStockGrad)" />}

                {/* Línea de Ganancia Real */}
                {rutaLineaReal && (
                  <path
                    d={rutaLineaReal}
                    fill="none"
                    stroke="#66FF00"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Línea Punteada de Predicción Futura */}
                {rutaLineaPrediccion && (
                  <path
                    d={rutaLineaPrediccion}
                    fill="none"
                    stroke="#22D3EE"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                  />
                )}

                {/* Línea vertical en el punto activo */}
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

                {/* Puntos interactivos para Mouse (PC) y Touch (Celular) */}
                {puntosSVG.map((p) => {
                  const esActivo = puntoSeleccionado && puntoSeleccionado.idx === p.idx;
                  return (
                    <g
                      key={p.fecha}
                      onMouseEnter={() => setPuntoActivoIdx(p.idx)}
                      onClick={() => setPuntoActivoIdx(p.idx)}
                      className="cursor-pointer"
                    >
                      {/* Círculo invisible amplio para facilitar el toque en celular */}
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

        {/* RANKING DE PLATAFORMAS MÁS VENDIDAS */}
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

      {/* REGISTRO EN ORDEN DE HORA (ÚLTIMA VENTA ARRIBA) */}
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
      {/* VENTANA EMERGENTE: BONO SEMANAL DE REVENDEDOR CON PORCENTAJE EDITABLE     */}
      {/* ========================================================================= */}
      {modalBonoAbierto && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-amber-400 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-[0_0_50px_rgba(251,191,36,0.25)] animate-modal">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <h3 className="font-black text-amber-400 text-base flex items-center gap-2">
                <Trophy className="w-5 h-5" /> Bono Semanal al Mejor Revendedor
              </h3>
              <button onClick={() => setModalBonoAbierto(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#070B06] border border-[#233820] rounded-2xl p-3.5 text-xs">
              <span className="text-gray-300 font-bold">Porcentaje de Bono sobre tu Ganancia Neta (%):</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={porcentajeBono}
                onChange={(e) => {
                  setPorcentajeBono(e.target.value);
                  localStorage.setItem("moss_pct_bono", e.target.value);
                }}
                className="w-20 bg-[#111A10] border border-amber-400 rounded-xl p-2 text-center text-white font-black"
              />
            </div>

            {!ganadorSemana ? (
              <p className="text-xs text-gray-400 bg-[#070B06] p-4 rounded-xl text-center">
                Aún no hay ventas de revendedores en los últimos 7 días.
              </p>
            ) : (
              <div className="bg-[#070B06] border border-amber-400/50 rounded-2xl p-4 space-y-3">
                <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-400 text-black uppercase">
                  🥇 #1 de la Semana: {ganadorSemana.nombre} ({ganadorSemana.ventasSemana} ventas)
                </span>
                <p className="text-xs text-gray-300">
                  Ingreso total que te pagó: <b>Bs {ganadorSemana.ingresoSemana.toFixed(2)}</b>
                </p>
                <p className="text-xs text-gray-300">
                  Ganancia Neta que te dejó a ti:{" "}
                  <b className="text-[#66FF00]">Bs {ganadorSemana.gananciaNetaParaAdmin.toFixed(2)}</b>
                </p>
                <p className="text-base font-black text-amber-300">
                  🎁 Bono ({porcentajeBono}%) que le corresponde: Bs {ganadorSemana.bonoCalculado.toFixed(2)}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={() => toggleVisibilidadBono(ganadorSemana)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 cursor-pointer ${
                      ganadorSemana.mostrar_bono_semanal
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#111A10] text-gray-300 border-gray-700"
                    }`}
                  >
                    {ganadorSemana.mostrar_bono_semanal ? (
                      <>
                        <Eye className="w-4 h-4" /> Visible para él (Ocultar)
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4" /> Mostrar en su Portal
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => togglePagoBonoSemanal(ganadorSemana)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 cursor-pointer ${
                      ganadorSemana.bono_semanal_pagado
                        ? "bg-green-900/50 text-green-300 border-green-500"
                        : "bg-amber-400 text-black border-amber-400"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {ganadorSemana.bono_semanal_pagado ? "✓ Bono Pagado" : "Marcar Pagado"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}