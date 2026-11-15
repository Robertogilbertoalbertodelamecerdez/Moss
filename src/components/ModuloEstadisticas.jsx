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
  X,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Bell,
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

  // Estadísticas de Revendedores: Total o filtrando quién es cada uno
  const [verEstadisticasRevendedores, setVerEstadisticasRevendedores] = useState(false);
  const [revendedorSeleccionadoStatsId, setRevendedorSeleccionadoStatsId] = useState("todos");
  const [modoMetricaRevendedores, setModoMetricaRevendedores] = useState("para_mi");
  const [periodoGraficaRev, setPeriodoGraficaRev] = useState("semana");

  // Panel de Marcus / Sub-Admins
  const [verPanelSubAdmins, setVerPanelSubAdmins] = useState(false);
  const [subAdminInspeccionadoId, setSubAdminInspeccionadoId] = useState("");

  const [modalBonoAbierto, setModalBonoAbierto] = useState(false);
  const [cantidadGanadoresTop, setCantidadGanadoresTop] = useState(3);
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

  const adminEnVista =
    esSuperAdmin && verPanelSubAdmins && subAdminInspeccionadoId
      ? subAdminInspeccionadoId
      : adminKeyActual;

  const esCuentaDeSubAdminVinculadaAMateus = (s) => {
    if ((s.admin_propietario || "admin") === "admin") return false;
    const provMoss = String(s.nombre_proveedor || "").toLowerCase().includes("moss");
    const matDeMateus =
      s.matriz_id &&
      (matrices.find((m) => m.id === s.matriz_id)?.admin_propietario || "admin") === "admin";
    return provMoss || Boolean(matDeMateus) || s.tipo_comprador === "subadmin";
  };

  const calcularGananciaAdminDeVenta = (s) => {
    const ingresoQueMePago = Number(s.precio_venta || 0);
    if (s.origen === "stock" && s.matriz_id) {
      const mat = matrices.find((m) => m.id === s.matriz_id);
      if ((s.admin_propietario || "admin") !== "admin" && (mat?.admin_propietario || "admin") === "admin") {
        return ingresoQueMePago - Number(s.costo_proveedor || 0);
      }
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

  const cumplePeriodoGraficaRev = (fechaRaw) => {
    const f = extraerFechaLocalISO(fechaRaw);
    if (periodoGraficaRev === "dia") return f === hoyISO;
    if (periodoGraficaRev === "semana") return f >= lunesSemanaActualISO && f <= domingoSemanaActualISO;
    if (periodoGraficaRev === "mes") return f.startsWith(mesActualISO);
    return true;
  };

  const suscripcionesDelAdminVista = useMemo(() => {
    return suscripciones.filter((s) => (s.admin_propietario || "admin") === adminEnVista);
  }, [suscripciones, adminEnVista]);

  const matricesDelAdminVista = useMemo(() => {
    return matrices.filter((m) => !m.en_papelera && (m.admin_propietario || "admin") === adminEnVista);
  }, [matrices, adminEnVista]);

  const movimientosDelAdminVista = useMemo(() => {
    return movimientosYolo.filter((m) => (m.admin_propietario || "admin") === adminEnVista);
  }, [movimientosYolo, adminEnVista]);

  // Lista de revendedores del Admin en vista (Excluye automáticamente a Marcus o cualquier Sub-Admin por nombre/teléfono)
  const revendedoresDelAdminVista = useMemo(() => {
    const telefonosSubAdmins = subAdmins.map((sa) => String(sa.telefono || "").trim());
    const nombresSubAdmins = subAdmins.map((sa) => String(sa.nombre || "").trim().toLowerCase());

    return revendedores.filter((r) => {
      if ((r.admin_propietario || "admin") !== adminEnVista) return false;
      if (telefonosSubAdmins.includes(String(r.telefono || "").trim())) return false;
      if (nombresSubAdmins.includes(String(r.nombre || "").trim().toLowerCase())) return false;
      return true;
    });
  }, [revendedores, adminEnVista, subAdmins]);

  // =========================================================================
  // RANKING DEL CICLO SEMANAL: MUESTRA QUIÉN ES CADA PUESTO (NOMBRE Y TELÉFONO)
  // =========================================================================
  const rankingSemanalBono = useMemo(() => {
    const mapa = {};
    revendedoresDelAdminVista.forEach((r) => {
      mapa[r.id] = {
        ...r,
        ventasSemana: 0,
        ingresoSemana: 0,
        gananciaNetaParaAdmin: 0,
        gananciaDelRevendedorSemana: 0
      };
    });

    suscripcionesDelAdminVista
      .filter((s) => !s.en_papelera && s.tipo_comprador === "revendedor")
      .forEach((s) => {
        const f = extraerFechaLocalISO(s.fecha_venta);
        if (f < lunesSemanaActualISO || f > domingoSemanaActualISO) return;

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
    cantidadGanadoresTop
  ]);

  const ganadoresActivosPodio = rankingSemanalBono.filter((r) => r.entraEnPodio);
  const totalProfitSemanalRevendedores = rankingSemanalBono.reduce((acc, r) => acc + r.gananciaNetaParaAdmin, 0);
  const totalBonoSemanalAPagar = ganadoresActivosPodio.reduce((acc, r) => acc + r.bonoCalculado, 0);

  const desmarcarPagosBonoSemana = async () => {
    for (const r of revendedoresDelAdminVista) {
      if (r.bono_semanal_pagado || r.mostrar_bono_semanal) {
        await supabase
          .from("revendedores")
          .update({
            bono_semanal_pagado: false,
            mostrar_bono_semanal: false
          })
          .eq("id", r.id);
      }
    }
    await recargarTodo();
    notificar("Estados de pago de esta semana restablecidos.");
  };

  const toggleMostrarCartelBonoEnPortal = async (revObj) => {
    const nuevoMostrar = !revObj.mostrar_bono_semanal;
    await supabase
      .from("revendedores")
      .update({
        mostrar_bono_semanal: nuevoMostrar,
        monto_bono_semanal: Number(revObj.bonoCalculado.toFixed(2)),
        ganancia_generada_semana: Number(revObj.gananciaNetaParaAdmin.toFixed(2))
      })
      .eq("id", revObj.id);
    await recargarTodo();
    notificar(
      nuevoMostrar
        ? `🏆 Cartel de premio activado en el portal de ${revObj.nombre}`
        : `Cartel ocultado en el portal de ${revObj.nombre}`
    );
  };

  const pagarBonoAGanadorTop = async (revObj) => {
    if (!revObj.entraEnPodio) return;
    const nuevoEstado = !revObj.bono_semanal_pagado;

    await supabase
      .from("revendedores")
      .update({
        bono_semanal_pagado: nuevoEstado,
        monto_bono_semanal: Number(revObj.bonoCalculado.toFixed(2)),
        ganancia_generada_semana: Number(revObj.gananciaNetaParaAdmin.toFixed(2))
      })
      .eq("id", revObj.id);

    if (nuevoEstado && revObj.bonoCalculado > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          admin_propietario: adminEnVista,
          tipo: `Bono Revendedor Top #${revObj.puesto} (${revObj.pctAplicado}%)`,
          monto: -Math.abs(Number(revObj.bonoCalculado.toFixed(2))),
          afecta_ganancia_neta: true,
          descripcion: `Pago Bono Semanal a ${revObj.nombre} - Puesto #${revObj.puesto} (${revObj.pctAplicado}%)`
        }
      ]);
    }

    await recargarTodo();
    notificar(
      nuevoEstado
        ? `Bono de ${revObj.nombre} (Puesto #${revObj.puesto}) marcado como Pagado.`
        : `Pago de ${revObj.nombre} desmarcado.`
    );
  };

  const historialBonosPagados = useMemo(() => {
    return movimientosDelAdminVista.filter((m) => String(m.tipo || "").startsWith("Bono Revendedor"));
  }, [movimientosDelAdminVista]);

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

  const gastoEnMatricesAdminVista = matricesDelAdminVista
    .filter((m) => cumplePeriodoActual(m.fecha_compra))
    .reduce((acc, m) => acc + Number(m.costo_total || 0), 0);

  const fiadoDeMateusAdminVista =
    adminEnVista !== "admin"
      ? ventasFiltradas
          .filter((s) => esCuentaDeSubAdminVinculadaAMateus(s))
          .reduce((acc, s) => acc + Number(s.costo_proveedor || 0), 0)
      : 0;

  const deudaPendienteFieAdminVista =
    adminEnVista !== "admin"
      ? suscripcionesDelAdminVista
          .filter((s) => !s.en_papelera && esCuentaDeSubAdminVinculadaAMateus(s) && s.pagado_al_admin === false)
          .reduce((acc, s) => acc + Number(s.costo_proveedor || 0), 0)
      : 0;

  const pagadoAProveedoresExternosAdminVista = ventasFiltradas
    .filter((s) => !esCuentaDeSubAdminVinculadaAMateus(s))
    .reduce((acc, s) => acc + Number(s.costo_proveedor || 0), 0);

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

  // Estadísticas y Gráfica de Revendedores (Permite ver Todos o elegir un Revendedor específico)
  const {
    serie: serieRevendedores,
    prevision30d: previsionRevendedores30d,
    totalProfitParaMiRev,
    totalGananciaDeEllosRev,
    totalVentasRevFiltro
  } = useMemo(() => {
    const mapa = {};
    let sumaProfitParaMi = 0;
    let sumaGananciaDeEllos = 0;
    let conteoVentas = 0;

    const revObjSeleccionado =
      revendedorSeleccionadoStatsId !== "todos"
        ? revendedoresDelAdminVista.find((r) => r.id === revendedorSeleccionadoStatsId)
        : null;

    suscripcionesDelAdminVista
      .filter((s) => {
        if (s.en_papelera || s.tipo_comprador !== "revendedor") return false;
        if (!cumplePeriodoGraficaRev(s.fecha_venta)) return false;
        if (revObjSeleccionado) {
          const coincide =
            s.revendedor_id === revObjSeleccionado.id ||
            s.telefono_cliente === revObjSeleccionado.telefono;
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
        conteoVentas += 1;
        mapa[f].ventas += 1;
        mapa[f].gananciaParaAdmin += profitMio;
        mapa[f].gananciaDeEllos += gananciaEl;
        mapa[f].ingreso += Number(s.precio_venta || 0);
        mapa[f].ganancia += modoMetricaRevendedores === "para_mi" ? profitMio : gananciaEl;
      });

    const res = armarSerieConPrediccion(mapa);
    return {
      ...res,
      totalProfitParaMiRev: sumaProfitParaMi,
      totalGananciaDeEllosRev: sumaGananciaDeEllos,
      totalVentasRevFiltro: conteoVentas
    };
  }, [
    suscripcionesDelAdminVista,
    matrices,
    periodoGraficaRev,
    modoMetricaRevendedores,
    revendedorSeleccionadoStatsId,
    revendedoresDelAdminVista
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

        {esSuperAdmin && verPanelSubAdmins && (
          <div className="bg-amber-950/30 border-2 border-amber-400 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black text-amber-300">
              👑 Inspeccionando Panel, Fíe, Proveedores y Matrices de:
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

      {/* 5 TARJETAS COMPLETAS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Cuentas Vendidas</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">{ventasFiltradas.length}</p>
          <p className="text-[10px] text-gray-400">Ingreso: Bs {totalVendidoPeriodo.toFixed(2)}</p>
        </div>

        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Profit Real Ventas</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">Bs {gananciaVentasPeriodo.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">Neto c/Matrices: Bs {gananciaNetaContablePeriodo.toFixed(2)}</p>
        </div>

        <div className="bg-[#111A10] border border-amber-500/50 rounded-2xl p-4">
          {adminEnVista !== "admin" ? (
            <>
              <p className="text-[10px] text-amber-300 font-black uppercase">
                👑 Fiado de Mateus ({deudaPendienteFieAdminVista > 0 ? `Debe Bs ${deudaPendienteFieAdminVista.toFixed(0)}` : "Al día"})
              </p>
              <p className="text-xl font-black text-white mt-1">Bs {fiadoDeMateusAdminVista.toFixed(2)}</p>
              <p className="text-[10px] text-gray-300 mt-0.5">
                Prov: <b className="text-orange-300">Bs {pagadoAProveedoresExternosAdminVista.toFixed(1)}</b> · Matrices:{" "}
                <b className="text-purple-300">Bs {gastoEnMatricesAdminVista.toFixed(1)}</b>
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] text-orange-300 font-black uppercase">🚚 Prov. & Matrices (Míos)</p>
              <p className="text-xl font-black text-white mt-1">
                Bs {(pagadoAProveedoresExternosAdminVista + gastoEnMatricesAdminVista).toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">
                Prov: <b className="text-orange-300">Bs {pagadoAProveedoresExternosAdminVista.toFixed(1)}</b> · Matrices:{" "}
                <b className="text-purple-300">Bs {gastoEnMatricesAdminVista.toFixed(1)}</b>
              </p>
            </>
          )}
        </div>

        <div className="bg-[#111A10] border border-cyan-500/40 rounded-2xl p-4">
          <p className="text-[10px] text-cyan-300 font-bold uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Previsión (30d)
          </p>
          <p className="text-2xl font-black text-cyan-300 mt-1">Bs {previsionMensualProfit.toFixed(2)}</p>
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00]/60 rounded-2xl p-4">
          <p className="text-[10px] text-[#66FF00] font-bold uppercase">Saldo Billetera</p>
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

      {/* ========================================================================= */}
      {/* ESTADÍSTICAS DE REVENDEDORES: CON SELECTOR DE REVENDEDOR Y TABLA RANKING  */}
      {/* ========================================================================= */}
      {verEstadisticasRevendedores && (
        <div className="bg-[#111A10] border-2 border-purple-500/40 rounded-3xl p-5 space-y-4 shadow-lg animate-modal">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-purple-300 uppercase flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" /> Estadísticas de Revendedores ({nombreAdminEnVista})
              </h3>
              <p className="text-[11px] text-gray-400">
                Elige ver el Total General o selecciona a uno de tus revendedores para ver su rendimiento.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={revendedorSeleccionadoStatsId}
                onChange={(e) => setRevendedorSeleccionadoStatsId(e.target.value)}
                className="bg-[#070B06] border border-purple-400 rounded-xl px-3 py-1.5 text-xs text-purple-200 font-bold"
              >
                <option value="todos">📊 Todos los Revendedores ({revendedoresDelAdminVista.length})</option>
                {revendedoresDelAdminVista.map((r) => (
                  <option key={r.id} value={r.id}>
                    🤝 {r.nombre} — 📞 {r.telefono}
                  </option>
                ))}
              </select>

              {[
                { id: "dia", label: "Hoy" },
                { id: "semana", label: "Esta Semana" },
                { id: "mes", label: "Este Mes" },
                { id: "todo", label: "Histórico" }
              ].map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setPeriodoGraficaRev(op.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    periodoGraficaRev === op.id
                      ? "bg-purple-500 text-white border-purple-400"
                      : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                  }`}
                >
                  {op.label}
                </button>
              ))}
              <button onClick={() => setVerEstadisticasRevendedores(false)} className="text-gray-400 hover:text-white ml-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              onClick={() => setModoMetricaRevendedores("para_mi")}
              className={`p-3.5 rounded-2xl border cursor-pointer ${
                modoMetricaRevendedores === "para_mi" ? "bg-[#142611] border-2 border-[#66FF00]" : "bg-[#070B06] border-[#233820]"
              }`}
            >
              <p className="text-[10px] font-black uppercase text-[#66FF00]">
                🟢 1. Profit Generado para Mí ({totalVentasRevFiltro} vtas)
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
                🟣 2. Ganancia Neta del Revendedor
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

          {geoRev.seleccionado && (
            <div className="bg-[#070B06] border border-purple-500/50 rounded-2xl p-3 flex flex-wrap justify-between items-center gap-2 text-xs">
              <span className="font-mono font-bold text-white">{formatearFechaDMA(geoRev.seleccionado.fecha)}</span>
              <span>Ventas: <b>{geoRev.seleccionado.ventas}</b></span>
              <span className="text-[#66FF00] font-black">
                🟢 Profit p/Admin: Bs {Number(geoRev.seleccionado.gananciaParaAdmin ?? geoRev.seleccionado.ganancia).toFixed(2)}
              </span>
              <span className="text-purple-300 font-black">
                🟣 Ganancia Revendedor: Bs {Number(geoRev.seleccionado.gananciaDeEllos ?? geoRev.seleccionado.ganancia).toFixed(2)}
              </span>
            </div>
          )}

          {geoRev.puntos.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-gray-500">
              Sin ventas de revendedores en este filtro.
            </div>
          ) : (
            <div className="relative w-full overflow-x-auto">
              <svg viewBox={`0 0 ${geoRev.svgWidth} ${geoRev.svgHeight}`} className="w-full h-52 select-none overflow-visible">
                <defs>
                  <linearGradient id="revStockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={modoMetricaRevendedores === "para_mi" ? "#66FF00" : "#A855F7"} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={modoMetricaRevendedores === "para_mi" ? "#66FF00" : "#A855F7"} stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {geoRev.rutaArea && <path d={geoRev.rutaArea} fill="url(#revStockGrad)" />}
                {geoRev.rutaReal && (
                  <path
                    d={geoRev.rutaReal}
                    fill="none"
                    stroke={modoMetricaRevendedores === "para_mi" ? "#66FF00" : "#C084FC"}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                )}
                {geoRev.rutaPred && (
                  <path d={geoRev.rutaPred} fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="round" />
                )}
                {geoRev.puntos.map((p) => (
                  <g
                    key={p.fecha}
                    onMouseEnter={() => setPuntoActivoRevIdx(p.idx)}
                    onClick={() => setPuntoActivoRevIdx(p.idx)}
                    className="cursor-pointer"
                  >
                    <circle cx={p.x} cy={p.yGan} r="14" fill="transparent" />
                    <circle
                      cx={p.x}
                      cy={p.yGan}
                      r="4.5"
                      fill={p.esPrediccion ? "#22D3EE" : modoMetricaRevendedores === "para_mi" ? "#66FF00" : "#C084FC"}
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
                      y={geoRev.svgHeight - 6}
                      textAnchor="middle"
                      fill="#9CA3AF"
                      fontSize="9"
                    >
                      {formatearFechaDMA(p.fecha).slice(0, 5)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL BONO SEMANAL: MUESTRA QUIÉN ES CADA PUESTO + PORCENTAJES + TABLA    */}
      {/* ========================================================================= */}
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
                  onClick={desmarcarPagosBonoSemana}
                  className="px-3 py-1.5 rounded-xl bg-amber-950/60 text-amber-300 border border-amber-500/50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Desmarcar Pagos
                </button>
                <button onClick={() => setModalBonoAbierto(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CONFIGURAR TOP 1 / TOP 2 / TOP 3 Y PORCENTAJES */}
            <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex gap-1.5">
                {[
                  { n: 1, texto: "🥇 Solo Top 1" },
                  { n: 2, texto: "🥈 Top 2" },
                  { n: 3, texto: "🥉 Top 3" }
                ].map((op) => (
                  <button
                    key={op.n}
                    type="button"
                    onClick={() => {
                      setCantidadGanadoresTop(op.n);
                      localStorage.setItem("moss_top_count", String(op.n));
                    }}
                    className={`px-3 py-1.5 rounded-xl font-extrabold border cursor-pointer ${
                      cantidadGanadoresTop === op.n
                        ? "bg-amber-400 text-black border-amber-400"
                        : "bg-[#111A10] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    {op.texto}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-amber-300 font-bold">#1 (%):</span>
                <input
                  type="number"
                  step="0.5"
                  value={pctTop1}
                  onChange={(e) => {
                    setPctTop1(e.target.value);
                    localStorage.setItem("moss_pct_bono_1", e.target.value);
                  }}
                  className="w-12 bg-[#111A10] border border-amber-400 rounded-lg p-1 text-center text-white font-black"
                />
                {cantidadGanadoresTop >= 2 && (
                  <>
                    <span className="text-gray-300 font-bold">#2 (%):</span>
                    <input
                      type="number"
                      step="0.5"
                      value={pctTop2}
                      onChange={(e) => {
                        setPctTop2(e.target.value);
                        localStorage.setItem("moss_pct_bono_2", e.target.value);
                      }}
                      className="w-12 bg-[#111A10] border border-gray-400 rounded-lg p-1 text-center text-white font-black"
                    />
                  </>
                )}
                {cantidadGanadoresTop >= 3 && (
                  <>
                    <span className="text-orange-300 font-bold">#3 (%):</span>
                    <input
                      type="number"
                      step="0.5"
                      value={pctTop3}
                      onChange={(e) => {
                        setPctTop3(e.target.value);
                        localStorage.setItem("moss_pct_bono_3", e.target.value);
                      }}
                      className="w-12 bg-[#111A10] border border-orange-400 rounded-lg p-1 text-center text-white font-black"
                    />
                  </>
                )}
              </div>
            </div>

            {/* GANADORES DEL TOP 3 CON SU NOMBRE, TELÉFONO, VENTAS Y PROFIT GENERADO */}
            <div className="space-y-2.5">
              {ganadoresActivosPodio.length === 0 ? (
                <p className="text-xs text-gray-400 bg-[#070B06] p-4 rounded-xl text-center">
                  Aún no hay ventas de revendedores entre el Lunes {formatearFechaDMA(lunesSemanaActualISO)} y el Domingo {formatearFechaDMA(domingoSemanaActualISO)}.
                </p>
              ) : (
                ganadoresActivosPodio.map((g) => (
                  <div
                    key={g.id}
                    className="bg-[#070B06] border border-amber-400/60 rounded-2xl p-3.5 flex flex-wrap justify-between items-center gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-black text-[11px]">
                          {g.puesto === 1 ? "🥇 Puesto #1" : g.puesto === 2 ? "🥈 Puesto #2" : "🥉 Puesto #3"} ({g.ventasSemana} vtas)
                        </span>
                        <span className="text-white font-black text-sm">
                          {g.nombre}
                        </span>
                        <span className="text-[#66FF00] font-mono">
                          📞 {g.telefono}
                        </span>
                      </div>

                      <p className="text-gray-300 text-[11px]">
                        Me generó de Profit: <b className="text-[#66FF00]">Bs {g.gananciaNetaParaAdmin.toFixed(2)}</b> · Ganancia de él:{" "}
                        <b className="text-purple-300">Bs {g.gananciaDelRevendedorSemana.toFixed(2)}</b>
                      </p>

                      <p className="text-amber-300 font-black text-sm">
                        Bono {g.pctAplicado}%: Bs {g.bonoCalculado.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMostrarCartelBonoEnPortal(g)}
                        className={`px-3 py-2 rounded-xl font-bold border flex items-center gap-1 cursor-pointer ${
                          g.mostrar_bono_semanal
                            ? "bg-purple-600 text-white border-purple-400"
                            : "bg-[#111A10] text-gray-300 border-[#2A4226]"
                        }`}
                        title="Mostrar cartel de felicidades en el portal del revendedor"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        {g.mostrar_bono_semanal ? "Cartel Activo" : "Avisar en Portal"}
                      </button>

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
                  </div>
                ))
              )}
            </div>

            {/* RANKING COMPLETO DE TODOS LOS REVENDEDORES EN LA SEMANA */}
            <div className="pt-3 border-t border-[#233820] space-y-2">
              <h4 className="text-xs font-black uppercase text-gray-300">
                📊 Tabla Completa de Revendedores esta Semana ({rankingSemanalBono.length})
              </h4>
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {rankingSemanalBono.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[#070B06] border border-[#1E331A] rounded-xl p-2.5 flex flex-wrap justify-between items-center gap-2 text-xs"
                  >
                    <div>
                      <b className="text-white">#{r.puesto} {r.nombre}</b>{" "}
                      <span className="text-gray-400 font-mono">({r.telefono})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span><b>{r.ventasSemana}</b> vtas</span>
                      <span className="text-[#66FF00] font-bold">
                        Me generó: Bs {r.gananciaNetaParaAdmin.toFixed(2)}
                      </span>
                      <span className="text-purple-300 font-bold">
                        Ganó él: Bs {r.gananciaDelRevendedorSemana.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* HISTORIAL DE BONOS PAGADOS */}
            {historialBonosPagados.length > 0 && (
              <div className="pt-3 border-t border-[#233820] space-y-2">
                <h4 className="text-xs font-black uppercase text-gray-400">
                  📜 Historial de Bonos Pagados ({historialBonosPagados.length})
                </h4>
                <div className="max-h-36 overflow-y-auto space-y-1.5">
                  {historialBonosPagados.map((b) => (
                    <div
                      key={b.id}
                      className="bg-[#070B06] border border-[#1E331A] rounded-xl p-2 flex justify-between items-center text-xs"
                    >
                      <span className="truncate">
                        <b className="text-amber-300">{b.descripcion || b.tipo}</b> · {formatearFechaDMA(b.fecha)}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-white">Bs {Math.abs(Number(b.monto)).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await supabase.from("movimientos_yolo").delete().eq("id", b.id);
                            await recargarTodo();
                          }}
                          className="text-gray-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}