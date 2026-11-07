"use client";
import React, { useState, useMemo } from "react";
import {
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  extraerFechaLocalISO
} from "@/config";
import {
  BarChart3,
  TrendingUp,
  Award,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

export default function ModuloEstadisticas({
  suscripciones = [],
  movimientosYolo = [],
  revendedores = [],
  nombreBilletera = "Yolo"
}) {
  const hoyISO = obtenerFechaBoliviaISO();
  const mesActualISO = hoyISO.slice(0, 7); // YYYY-MM en hora de Bolivia
  const anioActualISO = hoyISO.slice(0, 4); // YYYY en hora de Bolivia

  const [periodo, setPeriodo] = useState("dia"); // 'dia' | 'mes' | 'anio' | 'todo'
  const [fechaEspecifica, setFechaEspecifica] = useState(hoyISO);
  const [mesEspecifico, setMesEspecifico] = useState(mesActualISO);
  const [anioEspecifico, setAnioEspecifico] = useState(anioActualISO);

  const [filtroTipoComprador, setFiltroTipoComprador] = useState("todos");
  const [revendedorSeleccionado, setRevendedorSeleccionado] = useState("todos");

  // Filtrar ventas activas según período en hora de Bolivia
  const ventasFiltradas = useMemo(() => {
    return suscripciones.filter((s) => {
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
    });
  }, [suscripciones, periodo, fechaEspecifica, mesEspecifico, anioEspecifico, filtroTipoComprador, revendedorSeleccionado, revendedores]);

  // Filtrar movimientos convirtiendo su timestamp UTC a fecha local de Bolivia
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
  const costoDirectoPeriodo = ventasFiltradas.reduce((acc, s) => acc + Number(s.costo_proveedor || 0), 0);
  const gananciaVentasPeriodo = totalVendidoPeriodo - costoDirectoPeriodo;

  const gananciaNetaContablePeriodo = movimientosFiltrados
    .filter((m) => m.afecta_ganancia_neta)
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const saldoTotalBilletera = movimientosYolo.reduce((acc, m) => acc + Number(m.monto || 0), 0);

  // Top Plataformas más vendidas
  const rankingPlataformas = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((s) => {
      if (!mapa[s.plataforma]) mapa[s.plataforma] = { nombre: s.plataforma, cantidad: 0, monto: 0 };
      mapa[s.plataforma].cantidad += 1;
      mapa[s.plataforma].monto += Number(s.precio_venta || 0);
    });
    return Object.values(mapa).sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasFiltradas]);

  // Gráfica por Día
  const datosPorDia = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((s) => {
      const f = extraerFechaLocalISO(s.fecha_venta);
      if (!mapa[f]) mapa[f] = { fecha: f, ventas: 0, ingreso: 0, ganancia: 0 };
      mapa[f].ventas += 1;
      mapa[f].ingreso += Number(s.precio_venta || 0);
      mapa[f].ganancia += Number(s.precio_venta || 0) - Number(s.costo_proveedor || 0);
    });
    return Object.values(mapa).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-14);
  }, [ventasFiltradas]);

  const maxIngresoDia = Math.max(...datosPorDia.map((d) => Math.max(d.ingreso, d.ganancia, 1)), 1);

  // Ranking de Revendedores
  const rankingRevendedores = useMemo(() => {
    const mapa = {};
    revendedores.forEach((r) => {
      mapa[r.id] = { id: r.id, nombre: r.nombre, telefono: r.telefono, ventas: 0, generado: 0, ganancia: 0 };
    });

    suscripciones
      .filter((s) => !s.en_papelera && s.tipo_comprador === "revendedor")
      .forEach((s) => {
        const f = extraerFechaLocalISO(s.fecha_venta);
        if (periodo === "dia" && f !== fechaEspecifica) return;
        if (periodo === "mes" && !f.startsWith(mesEspecifico)) return;
        if (periodo === "anio" && !f.startsWith(anioEspecifico)) return;

        let target = mapa[s.revendedor_id];
        if (!target) {
          const porTel = Object.values(mapa).find((r) => r.telefono === s.telefono_cliente);
          if (porTel) target = porTel;
        }
        if (!target) {
          const keyTemp = s.telefono_cliente || s.nombre_cliente;
          if (!mapa[keyTemp]) {
            mapa[keyTemp] = {
              id: keyTemp,
              nombre: s.nombre_cliente,
              telefono: s.telefono_cliente,
              ventas: 0,
              generado: 0,
              ganancia: 0
            };
          }
          target = mapa[keyTemp];
        }
        target.ventas += 1;
        target.generado += Number(s.precio_venta || 0);
        target.ganancia += Number(s.precio_venta || 0) - Number(s.costo_proveedor || 0);
      });

    return Object.values(mapa).sort((a, b) => b.generado - a.generado);
  }, [revendedores, suscripciones, periodo, fechaEspecifica, mesEspecifico, anioEspecifico]);

  return (
    <div className="space-y-6">
      {/* BARRA DE FILTROS DE TIEMPO Y TIPO DE COMPRADOR */}
      <div className="bg-[#111A10] border-2 border-[#66FF00]/50 rounded-3xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#66FF00]" /> Centro de Estadísticas MOSS (Hora Bolivia)
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

        {/* FILTRO CLIENTES VS REVENDEDORES */}
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

      {/* RESUMEN DE TARJETAS DEL PERÍODO */}
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
          <p className="text-[11px] text-gray-400 font-bold uppercase">Ganancia de Ventas</p>
          <p className="text-2xl font-black text-[#66FF00] mt-1">Bs {gananciaVentasPeriodo.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">Neto c/Matrices: Bs {gananciaNetaContablePeriodo.toFixed(2)}</p>
        </div>
        <div className="bg-[#111A10] border-2 border-[#66FF00]/60 rounded-2xl p-4">
          <p className="text-[11px] text-[#66FF00] font-bold uppercase">Saldo Actual {nombreBilletera}</p>
          <p className="text-2xl font-black text-white mt-1">Bs {saldoTotalBilletera.toFixed(2)}</p>
        </div>
      </div>

      {/* GRÁFICA DE VENTAS Y GANANCIAS POR DÍA + TOP PLATAFORMAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Gráfica de Ventas y Ganancias por Día
            </h3>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-gray-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2D5A27] inline-block" /> Ingreso Bruto
              </span>
              <span className="flex items-center gap-1 text-[#66FF00] font-bold">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#66FF00] inline-block" /> Ganancia
              </span>
            </div>
          </div>

          {datosPorDia.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-500">
              Sin ventas registradas en este filtro de fechas.
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
                      <div
                        style={{ height: `${alturaIngreso}px` }}
                        className="w-3.5 bg-[#2D5A27] rounded-t-md transition-all"
                        title={`Ingreso: Bs ${d.ingreso}`}
                      />
                      <div
                        style={{ height: `${alturaGanancia}px` }}
                        className="w-3.5 bg-[#66FF00] rounded-t-md shadow-[0_0_10px_rgba(102,255,0,0.4)] transition-all"
                        title={`Ganancia: Bs ${d.ganancia}`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{formatearFechaDMA(d.fecha).slice(0, 5)}</span>
                    <span className="text-[9px] text-gray-500">{d.ventas} vta(s)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RANKING DE PLATAFORMAS MÁS VENDIDAS */}
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
            <Award className="w-4 h-4" /> Cuentas Más Vendidas
          </h3>

          {rankingPlataformas.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">Sin datos en este período.</p>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {rankingPlataformas.map((p, idx) => {
                const maxCant = rankingPlataformas[0]?.cantidad || 1;
                const pct = Math.round((p.cantidad / maxCant) * 100);
                return (
                  <div key={p.nombre} className="space-y-1 text-xs">
                    <div className="flex justify-between font-bold">
                      <span className="text-white">
                        #{idx + 1} {p.nombre}
                      </span>
                      <span className="text-[#66FF00]">
                        {p.cantidad} cta(s) · Bs {p.monto.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#070B06] rounded-full overflow-hidden">
                      <div className="h-full bg-[#66FF00]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RENDIMIENTO POR REVENDEDOR */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
            <Users className="w-4 h-4" /> Producción y Ranking de Revendedores
          </h3>
          <span className="text-xs text-gray-400">Toca un revendedor para filtrar sus ventas</span>
        </div>

        {rankingRevendedores.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            Aún no tienes revendedores registrados o ventas a revendedores en este período.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {rankingRevendedores.map((r, i) => (
              <div
                key={r.id}
                onClick={() => {
                  setFiltroTipoComprador("revendedor");
                  setRevendedorSeleccionado(r.id);
                }}
                className="bg-[#070B06] border border-[#1E331A] hover:border-[#66FF00] rounded-2xl p-3.5 flex justify-between items-center cursor-pointer transition"
              >
                <div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#66FF00]/20 text-[#66FF00]">
                    #{i + 1} Revendedor
                  </span>
                  <p className="font-bold text-white text-sm mt-1">{r.nombre}</p>
                  <p className="text-xs text-gray-400 font-mono">📞 {r.telefono}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[#66FF00]">{r.ventas} ventas</p>
                  <p className="text-xs font-bold text-white">Total: Bs {r.generado.toFixed(2)}</p>
                  <p className="text-[11px] text-gray-400">Ganancia: Bs {r.ganancia.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORIAL DE MOVIMIENTOS DEL PERÍODO */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-black text-[#66FF00] uppercase flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Movimientos de {nombreBilletera} en este Período ({movimientosFiltrados.length})
        </h3>
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {movimientosFiltrados.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">No hay movimientos en esta fecha.</p>
          ) : (
            movimientosFiltrados.map((m) => {
              const positivo = Number(m.monto) >= 0;
              return (
                <div key={m.id} className="bg-[#070B06] border border-[#1E331A] rounded-xl p-2.5 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    {positivo ? (
                      <ArrowUpRight className="w-4 h-4 text-[#66FF00] shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold text-white">{m.tipo}: </span>
                      <span className="text-gray-300">{m.descripcion}</span>
                      <span className="ml-2 text-[10px] text-gray-500">
                        ({formatearFechaDMA(m.fecha)})
                      </span>
                    </div>
                  </div>
                  <span className={`font-black shrink-0 ${positivo ? "text-[#66FF00]" : "text-red-400"}`}>
                    {positivo ? `+Bs ${Number(m.monto).toFixed(2)}` : `-Bs ${Math.abs(Number(m.monto)).toFixed(2)}`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}