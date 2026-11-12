"use client";
import React, { useState, useMemo, useEffect } from "react";
import {
  supabase,
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  obtenerLunesDeSemanaBolivia,
  obtenerDomingoDeSemanaBolivia,
  sumarDiasBoliviaISO,
  extraerFechaLocalISO
} from "@/config";
import {
  BarChart3,
  TrendingUp,
  Award,
  Users,
  Trophy,
  CheckCircle2,
  Clock,
  X,
  Sparkles,
  RotateCcw,
  Trash2,
  ShieldCheck
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
  esSuperAdmin = true,
  adminKeyActual = "admin",
  subAdmins = [],
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
  const domingoSemanaActualISO = obtenerDomingoDeSemanaBolivia(hoyISO);
  const mesActualISO = hoyISO.slice(0, 7);
  const anioActualISO = hoyISO.slice(0, 4);

  const [periodo, setPeriodo] = useState("semana");
  const [fechaEspecifica, setFechaEspecifica] = useState(hoyISO);
  const [mesEspecifico, setMesEspecifico] = useState(mesActualISO);
  const [anioEspecifico, setAnioEspecifico] = useState(anioActualISO);

  const [filtroTipoComprador, setFiltroTipoComprador] = useState("todos");

  const [verEstadisticasRevendedores, setVerEstadisticasRevendedores] = useState(false);
  const [modoMetricaRevendedores, setModoMetricaRevendedores] = useState("para_mi");

  // Botón exclusivo para que Mateus (Cabeza) inspeccione las estadísticas de Marcus / Sub-Admins
  const [verPanelSubAdmins, setVerPanelSubAdmins] = useState(false);
  const [subAdminInspeccionadoId, setSubAdminInspeccionadoId] = useState("");

  const [modalBonoAbierto, setModalBonoAbierto] = useState(false);
  const [cantidadGanadoresTop, setCantidadGanadoresTop] = useState(3);
  const [pctTop1, setPctTop1] = useState(5);
  const [pctTop2, setPctTop2] = useState(3);
  const [pctTop3, setPctTop3] = useState(2);
  const [timestampUltimoReinicio, setTimestampUltimoReinicio] = useState("");

  const [puntoActivoIdx, setPuntoActivoIdx] = useState(null);

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

  // Qué Admin se está visualizando actualmente en la pantalla de Estadísticas
  const adminEnVista =
    esSuperAdmin && verPanelSubAdmins && subAdminInspeccionadoId
      ? subAdminInspeccionadoId
      : adminKeyActual;

  const calcularGananciaAdminDeVenta = (s) => {
    const ingresoQueMePago = Number(s.precio_venta || 0);
    if (s.origen === "stock" && s.matriz_id) {
      const mat = matrices.find((m) => m.id === s.matriz_id);
      if (mat && Number(mat.costo_total) > 0) {
        const costoPorCupo = Number(mat.costo_total) / Math.max(1, Number(mat.capacidad_total || 5));
        return ingresoQueMePago - costoPorCupo;
      }
      return ingresoQueMePago - Number(s.costo_proveedor || 0);
    }
    return ingresoQueMePago - Number(s.costo_proveedor || 0);
  };

  const calcularGananciaPropiaDelRevendedor = (s) => {
    const cobroAClienteFinal = Number(s.precio_venta_revendedor || 0);
    const pagoAlAdmin = Number(s.precio_venta || 0);
    return cobroAClienteFinal > 0 ? cobroAClienteFinal - pagoAlAdmin : 0;
  };

  const cumplePeriodoActual = (fechaRaw) => {
    const f = extraerFechaLocalISO(fechaRaw);
    if (periodo === "dia") return f === fechaEspecifica;
    if (periodo === "semana") return f >= lunesSemanaActualISO && f <= domingoSemanaActualISO;
    if (periodo === "mes") return f.startsWith(mesEspecifico);
    if (periodo === "anio") return f.startsWith(anioEspecifico);
    return true;
  };

  // Suscripciones y Movimientos del Admin en vista (Mateus ve lo suyo por defecto, o lo de Marcus al activar el botón)
  const suscripcionesDelAdminVista = useMemo(() => {
    return suscripciones.filter((s) => (s.admin_propietario || "admin") === adminEnVista);
  }, [suscripciones, adminEnVista]);

  const movimientosDelAdminVista = useMemo(() => {
    return movimientosYolo.filter((m) => (m.admin_propietario || "admin") === adminEnVista);
  }, [movimientosYolo, adminEnVista]);

  const revendedoresDelAdminVista = useMemo(() => {
    return revendedores.filter((r) => (r.admin_propietario || "admin") === adminEnVista);
  }, [revendedores, adminEnVista]);

  // Ciclo Semanal de Bono (Lunes a Domingo)
  const rankingSemanalBono = useMemo(() => {
    const mapa = {};
    revendedoresDelAdminVista.forEach((r) => {
      mapa[r.id] = {
        ...r,
        ventasSemana: 0,
        ingresoSemana: 0,
        gananciaNetaParaAdmin: 0
      };
    });

    suscripcionesDelAdminVista
      .filter((s) => !s.en_papelera && s.tipo_comprador === "revendedor")
      .forEach((s) => {
        const f = extraerFechaLocalISO(s.fecha_venta);
        if (f < lunesSemanaActualISO || f > domingoSemanaActualISO) return;
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
        puesto === 1 ? Number(pctTop1 || 0) : puesto === 2 ? Number(pctTop2 || 0) : puesto === 3 ? Number(pctTop3 || 0) : 0;
      const bonoCalculado = entraEnPodio
        ? Math.max(0, item.gananciaNetaParaAdmin * (pctAplicado / 100))
        : 0;
      return { ...item, puesto, pctAplicado, entraEnPodio, bonoCalculado };
    });
  }, [
    revendedoresDelAdminVista,
    suscripcionesDelAdminVista,
    matrices,
    lunesSemanaActualISO,
    domingoSemanaActualISO,
    pctTop1,
    pctTop2,
    pctTop3,
    cantidadGanadoresTop,
    timestampUltimoReinicio
  ]);

  const ganadoresActivosPodio = rankingSemanalBono.filter((r) => r.entraEnPodio);
  const totalProfitSemanalRevendedores = rankingSemanalBono.reduce((acc, r) => acc + r.gananciaNetaParaAdmin, 0);
  const totalBonoSemanalAPagar = ganadoresActivosPodio.reduce((acc, r) => acc + r.bonoCalculado, 0);

  const reiniciarCicloSemanalDomingo = async (esAutomatico = false) => {
    const ahoraISO = new Date().toISOString();
    localStorage.setItem("moss_ciclo_bono_reset_ts", ahoraISO);
    setTimestampUltimoReinicio(ahoraISO);

    for (const r of revendedoresDelAdminVista) {
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
    notificar(esAutomatico ? "🎉 ¡Ciclo semanal reiniciado automáticamente!" : "Ciclo semanal reiniciado en 0");
  };

  const pagarBonoAGanadorTop = async (revObj) => {
    if (!revObj.entraEnPodio) return;
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
          admin_propietario: adminEnVista,
          tipo: `Bono Revendedor Top #${revObj.puesto} (${revObj.pctAplicado}%)`,
          monto: -Math.abs(Number(revObj.bonoCalculado.toFixed(2))),
          afecta_ganancia_neta: true,
          descripcion: `Pago Bono Semanal Domingo Puesto #${revObj.puesto} (${revObj.pctAplicado}%)`
        }
      ]);
    }

    const cuantosFaltaban = ganadoresActivosPodio.filter(
      (g) => g.id !== revObj.id && !g.bono_semanal_pagado
    ).length;

    if (cuantosFaltaban === 0 && ganadoresActivosPodio.length > 0) {
      await reiniciarCicloSemanalDomingo(true);
    } else {
      await recargarTodo();
      notificar(`Bono del Puesto #${revObj.puesto} pagado.`);
    }
  };

  const ventasFiltradas = useMemo(() => {
    return suscripcionesDelAdminVista
      .filter((s) => {
        if (s.en_papelera) return false;
        if (!cumplePeriodoActual(s.fecha_venta)) return false;
        const tipo = s.tipo_comprador || "cliente";
        if (filtroTipoComprador !== "todos" && tipo !== filtroTipoComprador) return false;
        return true;
      })
      .sort((a, b) => String(b.creado_en || "").localeCompare(String(a.creado_en || "")));
  }, [suscripcionesDelAdminVista, periodo, fechaEspecifica, mesEspecifico, anioEspecifico, filtroTipoComprador]);

  const movimientosFiltrados = useMemo(() => {
    return movimientosDelAdminVista.filter((m) => cumplePeriodoActual(m.fecha));
  }, [movimientosDelAdminVista, periodo, fechaEspecifica, mesEspecifico, anioEspecifico]);

  const totalVendidoPeriodo = ventasFiltradas.reduce((acc, s) => acc + Number(s.precio_venta || 0), 0);
  const gananciaVentasPeriodo = ventasFiltradas.reduce((acc, s) => acc + calcularGananciaAdminDeVenta(s), 0);
  const gananciaNetaContablePeriodo = movimientosFiltrados
    .filter((m) => m.afecta_ganancia_neta)
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const saldoTotalBilletera = movimientosDelAdminVista.reduce((acc, m) => acc + Number(m.monto || 0), 0);

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

  const {
    serie: serieRevendedores,
    prevision30d: previsionRevendedores30d,
    totalProfitParaMiRev,
    totalGananciaDeEllosRev
  } = useMemo(() => {
    const mapa = {};
    let sumaProfitParaMi = 0;
    let sumaGananciaDeEllos = 0;

    suscripcionesDelAdminVista
      .filter((s) => !s.en_papelera && s.tipo_comprador === "revendedor" && cumplePeriodoActual(s.fecha_venta))
      .forEach((s) => {
        const f = extraerFechaLocalISO(s.fecha_venta);
        if (!mapa[f]) mapa[f] = { fecha: f, ventas: 0, ingreso: 0, ganancia: 0, esPrediccion: false };
        const profitMio = calcularGananciaAdminDeVenta(s);
        const gananciaEl = calcularGananciaPropiaDelRevendedor(s);
        sumaProfitParaMi += profitMio;
        sumaGananciaDeEllos += gananciaEl;
        mapa[f].ventas += 1;
        mapa[f].ingreso += Number(s.precio_venta || 0);
        mapa[f].ganancia += modoMetricaRevendedores === "para_mi" ? profitMio : gananciaEl;
      });

    const res = armarSerieConPrediccion(mapa);
    return {
      ...res,
      totalProfitParaMiRev: sumaProfitParaMi,
      totalGananciaDeEllosRev: sumaGananciaDeEllos
    };
  }, [suscripcionesDelAdminVista, matrices, periodo, fechaEspecifica, mesEspecifico, anioEspecifico, modoMetricaRevendedores]);

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
  const geoRev = construirGeometriaSVG(serieRevendedores, null);

  const rankingPlataformas = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((s) => {
      if (!mapa[s.plataforma]) mapa[s.plataforma] = { nombre: s.plataforma, cantidad: 0, monto: 0 };
      mapa[s.plataforma].cantidad += 1;
      mapa[s.plataforma].monto += Number(s.precio_venta || 0);
    });
    return Object.values(mapa).sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasFiltradas]);

  const nombreAdminEnVista =
    adminEnVista === "admin"
      ? "Mateus (Mi Panel Principal)"
      : subAdmins.find((s) => s.id === adminEnVista)?.nombre || "Sub-Admin";

  return (
    <div className="space-y-6">
      <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#66FF00]" /> Estadísticas de {nombreAdminEnVista}
            </h2>
            <p className="text-xs text-gray-400">
              Ciclo semanal: <b className="text-[#66FF00]">Lun {formatearFechaDMA(lunesSemanaActualISO).slice(0, 5)} al Dom {formatearFechaDMA(domingoSemanaActualISO).slice(0, 5)}</b>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "dia", label: "Por Día" },
              { id: "semana", label: "Esta Semana (Lun - Dom)" },
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
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#1E331A]">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "todos", label: "Todos (Total General)" },
              { id: "cliente", label: "👤 Solo Clientes Finales" },
              { id: "revendedor", label: "🤝 Total Revendedores" }
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
          </div>

          <div className="flex flex-wrap gap-2">
            {/* BOTÓN EXCLUSIVO DE MATEUS PARA VER LAS ESTADÍSTICAS DE MARCUS / SUB-ADMINS */}
            {esSuperAdmin && subAdmins.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const nuevo = !verPanelSubAdmins;
                  setVerPanelSubAdmins(nuevo);
                  if (nuevo && !subAdminInspeccionadoId) {
                    setSubAdminInspeccionadoId(subAdmins[0]?.id || "");
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer ${
                  verPanelSubAdmins
                    ? "bg-amber-400 text-black border-amber-400"
                    : "bg-[#070B06] text-amber-300 border-amber-500/60"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                {verPanelSubAdmins
                  ? "Volver a Mis Estadísticas (Mateus)"
                  : "👑 Ver Estadísticas de Marcus / Sub-Admins"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setVerEstadisticasRevendedores(!verEstadisticasRevendedores)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 cursor-pointer ${
                verEstadisticasRevendedores
                  ? "bg-purple-500 text-white border-purple-400"
                  : "bg-[#070B06] text-purple-300 border-purple-500/50"
              }`}
            >
              <Users className="w-4 h-4" />
              {verEstadisticasRevendedores
                ? "Ocultar Estadísticas de Revendedores"
                : "📊 Ver Estadísticas de Revendedores"}
            </button>

            <button
              type="button"
              onClick={() => setModalBonoAbierto(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-black flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-4 h-4" /> Bono Semanal (Top {cantidadGanadoresTop})
            </button>
          </div>
        </div>

        {/* SELECTOR DE SUB-ADMIN CUANDO MATEUS ACTIVA EL BOTÓN DE VER ESTADÍSTICAS DE MARCUS */}
        {esSuperAdmin && verPanelSubAdmins && (
          <div className="bg-amber-950/30 border-2 border-amber-400 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black text-amber-300">
              👑 Inspeccionando Panel y Revendedores de:
            </span>
            <div className="flex flex-wrap gap-2">
              {subAdmins.map((sa) => (
                <button
                  key={sa.id}
                  type="button"
                  onClick={() => setSubAdminInspeccionadoId(sa.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                    subAdminInspeccionadoId === sa.id
                      ? "bg-amber-400 text-black"
                      : "bg-[#070B06] text-amber-200 border border-amber-500/40"
                  }`}
                >
                  {sa.nombre} (📞 {sa.telefono})
                </button>
              ))}
            </div>
          </div>
        )}
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
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00]/60 rounded-2xl p-4">
          <p className="text-[11px] text-[#66FF00] font-bold uppercase">Saldo Billetera ({nombreAdminEnVista})</p>
          <p className="text-2xl font-black text-white mt-1">Bs {saldoTotalBilletera.toFixed(2)}</p>
        </div>
      </div>

      {/* GRÁFICA 1 + TOP PLATAFORMAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Curva Bursátil de Profit ({nombreAdminEnVista})
          </h3>

          {geoAdmin.puntos.length > 0 && (
            <div className="relative w-full overflow-x-auto">
              <svg viewBox={`0 0 ${geoAdmin.svgWidth} ${geoAdmin.svgHeight}`} className="w-full h-52 select-none overflow-visible">
                <defs>
                  <linearGradient id="mossStockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#66FF00" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="#66FF00" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {geoAdmin.rutaArea && <path d={geoAdmin.rutaArea} fill="url(#mossStockGrad)" />}
                {geoAdmin.rutaReal && (
                  <path d={geoAdmin.rutaReal} fill="none" stroke="#66FF00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {geoAdmin.rutaPred && (
                  <path d={geoAdmin.rutaPred} fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="round" />
                )}
                {geoAdmin.puntos.map((p) => (
                  <g
                    key={p.fecha}
                    onMouseEnter={() => setPuntoActivoIdx(p.idx)}
                    onClick={() => setPuntoActivoIdx(p.idx)}
                    className="cursor-pointer"
                  >
                    <circle cx={p.x} cy={p.yGan} r="4.5" fill={p.esPrediccion ? "#22D3EE" : "#66FF00"} stroke="#070B06" strokeWidth="2" />
                    <text x={p.x} y={p.yGan - 10} textAnchor="middle" fill="#66FF00" fontSize="9" fontWeight="bold">
                      {p.ganancia.toFixed(0)}
                    </text>
                    <text x={p.x} y={geoAdmin.svgHeight - 6} textAnchor="middle" fill="#9CA3AF" fontSize="9">
                      {formatearFechaDMA(p.fecha).slice(0, 5)}
                    </text>
                  </g>
                ))}
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

      {/* ESTADÍSTICAS GENERALES DE REVENDEDORES (OCULTA TRAS BOTÓN, SOLO TOTAL GENERAL) */}
      {verEstadisticasRevendedores && (
        <div className="bg-[#111A10] border-2 border-purple-500/40 rounded-3xl p-5 space-y-4 shadow-lg animate-modal">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm sm:text-base font-black text-purple-300 uppercase flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" /> Estadísticas Generales de Revendedores ({nombreAdminEnVista})
              </h3>
            </div>
            <button onClick={() => setVerEstadisticasRevendedores(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              onClick={() => setModoMetricaRevendedores("para_mi")}
              className={`p-3.5 rounded-2xl border cursor-pointer ${
                modoMetricaRevendedores === "para_mi" ? "bg-[#142611] border-2 border-[#66FF00]" : "bg-[#070B06] border-[#233820]"
              }`}
            >
              <p className="text-[10px] font-black uppercase text-[#66FF00]">
                🟢 1. Profit Total Generado para Admin
              </p>
              <p className="text-xl font-black text-white mt-0.5">
                Bs {totalProfitParaMiRev.toFixed(2)}
              </p>
            </div>

            <div
              onClick={() => setModoMetricaRevendedores("de_ellos")}
              className={`p-3.5 rounded-2xl border cursor-pointer ${
                modoMetricaRevendedores === "de_ellos" ? "bg-purple-950/40 border-2 border-purple-400" : "bg-[#070B06] border-[#233820]"
              }`}
            >
              <p className="text-[10px] font-black uppercase text-purple-300">
                🟣 2. Ganancia Neta Total de Revendedores
              </p>
              <p className="text-xl font-black text-white mt-0.5">
                Bs {totalGananciaDeEllosRev.toFixed(2)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#070B06] border border-cyan-500/40">
              <p className="text-[10px] font-black uppercase text-cyan-300">
                🔮 Previsión Mensual (30d)
              </p>
              <p className="text-xl font-black text-cyan-300 mt-0.5">
                Bs {previsionRevendedores30d.toFixed(2)}
              </p>
            </div>
          </div>

          {geoRev.puntos.length > 0 && (
            <div className="relative w-full overflow-x-auto">
              <svg viewBox={`0 0 ${geoRev.svgWidth} ${geoRev.svgHeight}`} className="w-full h-48 select-none overflow-visible">
                {geoRev.rutaReal && (
                  <path
                    d={geoRev.rutaReal}
                    fill="none"
                    stroke={modoMetricaRevendedores === "para_mi" ? "#66FF00" : "#C084FC"}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      )}

      {/* MODAL BONO SEMANAL */}
      {modalBonoAbierto && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-amber-400 rounded-3xl p-6 max-w-2xl w-full space-y-4 max-h-[92vh] overflow-y-auto animate-modal">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h3 className="font-black text-amber-400 text-base flex items-center gap-2">
                  <Trophy className="w-5 h-5" /> Ciclo Semanal (Lun {formatearFechaDMA(lunesSemanaActualISO).slice(0, 5)} al Dom {formatearFechaDMA(domingoSemanaActualISO).slice(0, 5)})
                </h3>
                <p className="text-[11px] text-gray-400">
                  Profit Total Revendedores:{" "}
                  <b className="text-[#66FF00]">Bs {totalProfitSemanalRevendedores.toFixed(2)}</b> · Bono Total:{" "}
                  <b className="text-amber-300">Bs {totalBonoSemanalAPagar.toFixed(2)}</b>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => reiniciarCicloSemanalDomingo(false)}
                  className="px-3 py-1.5 rounded-xl bg-amber-950/60 text-amber-300 border border-amber-500/50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reiniciar Semana
                </button>
                <button onClick={() => setModalBonoAbierto(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {ganadoresActivosPodio.length === 0 ? (
                <p className="text-xs text-gray-400 bg-[#070B06] p-4 rounded-xl text-center">
                  Sin comisiones pendientes en este ciclo semanal.
                </p>
              ) : (
                ganadoresActivosPodio.map((g) => (
                  <div
                    key={g.id}
                    className="bg-[#070B06] border border-amber-400/50 rounded-2xl p-3.5 flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-black text-[10px]">
                        Puesto #{g.puesto} de la Semana ({g.ventasSemana} vtas)
                      </span>
                      <p className="text-amber-300 font-black text-sm mt-1">
                        Bono {g.pctAplicado}%: Bs {g.bonoCalculado.toFixed(2)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => pagarBonoAGanadorTop(g)}
                      className={`px-4 py-2 rounded-xl font-black border flex items-center gap-1.5 cursor-pointer ${
                        g.bono_semanal_pagado
                          ? "bg-green-900/50 text-green-300 border-green-500"
                          : "bg-amber-400 text-black border-amber-400"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {g.bono_semanal_pagado ? "✓ Pagado" : `Marcar Pagado (Bs ${g.bonoCalculado.toFixed(1)})`}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}