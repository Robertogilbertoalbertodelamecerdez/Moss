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
  BarChart3,
  TrendingUp,
  Award,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock
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

  const [periodo, setPeriodo] = useState("dia");
  const [fechaEspecifica, setFechaEspecifica] = useState(hoyISO);
  const [mesEspecifico, setMesEspecifico] = useState(mesActualISO);
  const [anioEspecifico, setAnioEspecifico] = useState(anioActualISO);

  const [filtroTipoComprador, setFiltroTipoComprador] = useState("todos");
  const [revendedorSeleccionado, setRevendedorSeleccionado] = useState("todos");

  // Función que calcula cuánta Ganancia Neta te dejó una venta a ti como Admin
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

  // CÁLCULO DEL MEJOR REVENDEDOR DE LA SEMANA Y SU BONO DEL 5% SOBRE TU GANANCIA NETA
  const rankingSemanalBono = useMemo(() => {
    const mapa = {};
    revendedores.forEach((r) => {
      mapa[r.id] = {
        ...r,
        ventasSemana: 0,
        ingresoSemana: 0,
        gananciaNetaParaAdmin: 0,
        bono5Porciento: 0
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
          target.bono5Porciento = Math.max(0, target.gananciaNetaParaAdmin * 0.05);
        }
      });

    return Object.values(mapa).sort((a, b) =>
      b.ventasSemana !== a.ventasSemana
        ? b.ventasSemana - a.ventasSemana
        : b.gananciaNetaParaAdmin - a.gananciaNetaParaAdmin
    );
  }, [revendedores, suscripciones, matrices, hace7DiasISO, hoyISO]);

  const ganadorSemana = rankingSemanalBono[0] && rankingSemanalBono[0].ventasSemana > 0 ? rankingSemanalBono[0] : null;

  const toggleVisibilidadBono = async (revObj) => {
    const nuevoValor = !revObj.mostrar_bono_semanal;
    await supabase
      .from("revendedores")
      .update({
        mostrar_bono_semanal: nuevoValor,
        monto_bono_semanal: Number(revObj.bono5Porciento.toFixed(2)),
        ganancia_generada_semana: Number(revObj.gananciaNetaParaAdmin.toFixed(2))
      })
      .eq("id", revObj.id);
    await recargarTodo();
    notificar(
      nuevoValor
        ? `Bono del 5% ahora visible en el portal de ${revObj.nombre}`
        : `Bono ocultado del portal de ${revObj.nombre}`
    );
  };

  const togglePagoBonoSemanal = async (revObj) => {
    const nuevoPago = !revObj.bono_semanal_pagado;
    await supabase
      .from("revendedores")
      .update({
        bono_semanal_pagado: nuevoPago,
        monto_bono_semanal: Number(revObj.bono5Porciento.toFixed(2))
      })
      .eq("id", revObj.id);

    if (nuevoPago && revObj.bono5Porciento > 0) {
      await supabase.from("movimientos_yolo").insert([
        {
          tipo: "Bono Revendedor 5%",
          monto: -Math.abs(Number(revObj.bono5Porciento.toFixed(2))),
          afecta_ganancia_neta: true,
          descripcion: `Pago Bono Semanal 5% a mejor revendedor (${revObj.nombre})`
        }
      ]);
    }
    await recargarTodo();
    notificar(nuevoPago ? "Bono marcado como Pagado y descontado de tu saldo" : "Marcado como No Pagado");
  };

  // Ventas filtradas y ordenadas con la última registrada arriba (por creado_en)
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

  const rankingPlataformas = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((s) => {
      if (!mapa[s.plataforma]) mapa[s.plataforma] = { nombre: s.plataforma, cantidad: 0, monto: 0 };
      mapa[s.plataforma].cantidad += 1;
      mapa[s.plataforma].monto += Number(s.precio_venta || 0);
    });
    return Object.values(mapa).sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasFiltradas]);

  const datosPorDia = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((s) => {
      const f = extraerFechaLocalISO(s.fecha_venta);
      if (!mapa[f]) mapa[f] = { fecha: f, ventas: 0, ingreso: 0, ganancia: 0 };
      mapa[f].ventas += 1;
      mapa[f].ingreso += Number(s.precio_venta || 0);
      mapa[f].ganancia += calcularGananciaAdminDeVenta(s);
    });
    return Object.values(mapa).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-14);
  }, [ventasFiltradas, matrices]);

  const maxIngresoDia = Math.max(...datosPorDia.map((d) => Math.max(d.ingreso, d.ganancia, 1)), 1);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* PANEL EXCLUSIVO ADMIN: MEJOR REVENDEDOR DE LA SEMANA (BONO 5% GANANCIA)   */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-[#1A2912] via-[#131F0E] to-[#0D160B] border-2 border-amber-400/70 rounded-3xl p-5 space-y-3 shadow-lg">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-black text-white text-sm sm:text-base">
                Control de Bono Semanal (5% de la Ganancia Neta que te generó el #1 de los últimos 7 días)
              </h3>
              <p className="text-[11px] text-gray-400">
                Esto es privado para ti. Solo se muestra al revendedor si activas el botón "Mostrar en su Portal".
              </p>
            </div>
          </div>
        </div>

        {!ganadorSemana ? (
          <p className="text-xs text-gray-400 bg-[#070B06] p-3 rounded-xl">
            Aún no hay ventas de revendedores en los últimos 7 días ({formatearFechaDMA(hace7DiasISO)} al {formatearFechaDMA(hoyISO)}).
          </p>
        ) : (
          <div className="bg-[#070B06] border border-amber-400/50 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4">
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-400 text-black uppercase">
                🥇 #1 de la Semana: {ganadorSemana.nombre} ({ganadorSemana.ventasSemana} ventas)
              </span>
              <p className="text-xs text-gray-300 pt-1">
                Te pagó en total: <b>Bs {ganadorSemana.ingresoSemana.toFixed(2)}</b> · Ganancia Neta real que te dejó a ti:{" "}
                <b className="text-[#66FF00]">Bs {ganadorSemana.gananciaNetaParaAdmin.toFixed(2)}</b>
              </p>
              <p className="text-sm font-black text-amber-300">
                🎁 Bono 5% que le corresponde: Bs {ganadorSemana.bono5Porciento.toFixed(2)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleVisibilidadBono(ganadorSemana)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 cursor-pointer ${
                  ganadorSemana.mostrar_bono_semanal
                    ? "bg-[#66FF00] text-black border-[#66FF00]"
                    : "bg-[#111A10] text-gray-300 border-gray-700"
                }`}
              >
                {ganadorSemana.mostrar_bono_semanal ? (
                  <>
                    <Eye className="w-4 h-4" /> Visible para {ganadorSemana.nombre} (Ocultar)
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" /> Oculto (Mostrar en su Portal)
                  </>
                )}
              </button>

              <button
                onClick={() => togglePagoBonoSemanal(ganadorSemana)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 cursor-pointer ${
                  ganadorSemana.bono_semanal_pagado
                    ? "bg-green-900/50 text-green-300 border-green-500"
                    : "bg-amber-400 text-black border-amber-400"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {ganadorSemana.bono_semanal_pagado ? "✓ Bono Pagado (Revertir)" : "Marcar Bono como Pagado"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BARRA DE FILTROS DE TIEMPO Y COMPRADOR */}
      <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#66FF00]" /> Estadísticas y Auditoría (Hora Bolivia)
            </h2>
            <p className="text-xs text-gray-400">
              Hoy en Santa Cruz: <b className="text-[#66FF00]">{formatearFechaDMA(hoyISO)}</b>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "dia", label: "Por Día" },
              { id: "mes", label: "Por Mes" },
              { id: "anio", label: "Por Año" },
              { id: "todo", label: "Histórico Total" }
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
        </div>
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 font-bold uppercase">Ingresos por Ventas</p>
          <p className="text-2xl font-black text-white mt-1">Bs {totalVendidoPeriodo.toFixed(2)}</p>
        </div>
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 font-bold uppercase">Ganancia Neta Ventas</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">Bs {gananciaVentasPeriodo.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">Neto c/Matrices: Bs {gananciaNetaContablePeriodo.toFixed(2)}</p>
        </div>
        <div className="bg-[#111A10] border-2 border-[#66FF00]/60 rounded-2xl p-4">
          <p className="text-[11px] text-[#66FF00] font-bold uppercase">Saldo Actual {nombreBilletera}</p>
          <p className="text-2xl font-black text-white mt-1">Bs {saldoTotalBilletera.toFixed(2)}</p>
        </div>
      </div>

      {/* GRÁFICA POR DÍA + TOP PLATAFORMAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Gráfica de Ventas y Ganancias por Día
          </h3>
          {datosPorDia.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-500">
              Sin ventas registradas en este filtro.
            </div>
          ) : (
            <div className="h-52 flex items-end gap-2 pt-6 pb-2 overflow-x-auto border-b border-[#1E331A]">
              {datosPorDia.map((d) => {
                const alturaIngreso = Math.max(8, Math.round((d.ingreso / maxIngresoDia) * 140));
                const alturaGanancia = Math.max(6, Math.round((Math.max(0, d.ganancia) / maxIngresoDia) * 140));
                return (
                  <div key={d.fecha} className="flex-1 min-w-[48px] flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[#66FF00] font-extrabold">Bs {d.ganancia.toFixed(0)}</span>
                    <div className="w-full flex items-end justify-center gap-1 h-36">
                      <div style={{ height: `${alturaIngreso}px` }} className="w-3.5 bg-[#2D5A27] rounded-t-md" />
                      <div style={{ height: `${alturaGanancia}px` }} className="w-3.5 bg-[#66FF00] rounded-t-md" />
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{formatearFechaDMA(d.fecha).slice(0, 5)}</span>
                    <span className="text-[9px] text-gray-500">{d.ventas} vta(s)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
            <Award className="w-4 h-4" /> Cuentas Más Vendidas
          </h3>
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
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
      {/* REGISTRO EN ORDEN DE HORA (ÚLTIMA VENTA ARRIBA) + PRECIO DEL REVENDEDOR   */}
      {/* ========================================================================= */}
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
    </div>
  );
}