"use client";
import React, { useState } from "react";
import {
  supabase,
  formatearFechaDMA,
  obtenerFechaBoliviaISO,
  sumarDiasBoliviaISO
} from "@/config";
import {
  generarMensajeEntrega,
  generarMensajeRenovacionCorto
} from "@/utils/mensajesMoss";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
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
  PlusCircle
} from "lucide-react";

export default function PortalRevendedor({
  revendedor,
  suscripciones = [],
  matrices = [],
  plataformasList = [],
  recargarTodo,
  notificar,
  registrarErrorSistema
}) {
  const [tabRev, setTabRev] = useState("mis_clientes");
  const [busqueda, setBusqueda] = useState("");

  // Modal para anotar o editar los datos del cliente final del revendedor
  const [subAnotar, setSubAnotar] = useState(null);
  const [nomFinal, setNomFinal] = useState("");
  const [telFinal, setTelFinal] = useState("");
  const [precioFinal, setPrecioFinal] = useState("");

  // Modal para cuando el revendedor saca un perfil directo de una Matriz tuya
  const [matrizVender, setMatrizVender] = useState(null);
  const [nomVentaStock, setNomVentaStock] = useState("");
  const [telVentaStock, setTelVentaStock] = useState("");
  const [precioVentaStock, setPrecioVentaStock] = useState("");
  const [mesesStock, setMesesStock] = useState(1);
  const [guardandoStock, setGuardandoStock] = useState(false);

  // Modal de Mensaje listo
  const [mensajeModal, setMensajeModal] = useState(null);

  // Filtrar únicamente las ventas que pertenecen a este revendedor
  const misVentas = suscripciones.filter((s) => {
    if (s.en_papelera) return false;
    if (s.tipo_comprador !== "revendedor") return false;
    return s.revendedor_id === revendedor.id || s.telefono_cliente === revendedor.telefono;
  });

  // Cálculos financieros propios del revendedor
  const totalCobradoClientes = misVentas.reduce(
    (acc, s) => acc + Number(s.precio_venta_revendedor || 0),
    0
  );
  const totalCostoAdmin = misVentas.reduce(
    (acc, s) => acc + Number(s.precio_venta || 0),
    0
  );
  const miGananciaNeta = totalCobradoClientes - totalCostoAdmin;
  const deudaPendienteAdmin = misVentas
    .filter((s) => s.pagado_al_admin === false)
    .reduce((acc, s) => acc + Number(s.precio_venta || 0), 0);

  const calcularDias = (fechaCorte) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const corte = new Date(fechaCorte + "T00:00:00");
    return Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
  };

  const misRenovaciones = misVentas.filter(
    (s) => s.estado === "Activa" && calcularDias(s.fecha_corte) <= 3
  );

  const obtenerPrecioRevendedorPlat = (nombrePlat) => {
    const p = plataformasList.find((x) => x.nombre === nombrePlat);
    return Number(p?.precioRevendedor ?? 15);
  };

  const abrirModalAnotarCliente = (s) => {
    setSubAnotar(s);
    setNomFinal(s.nombre_cliente_final || "");
    setTelFinal(s.telefono_cliente_final || "");
    setPrecioFinal(
      s.precio_venta_revendedor && Number(s.precio_venta_revendedor) > 0
        ? s.precio_venta_revendedor
        : ""
    );
  };

  const guardarDatosClienteFinal = async (e) => {
    e.preventDefault();
    if (!nomFinal.trim() || !telFinal.trim() || precioFinal === "") {
      return notificar("Completa el nombre, teléfono y a cuánto se lo vendiste", "error");
    }
    try {
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
      notificar("¡Datos de tu cliente y ganancia actualizados!");
    } catch (err) {
      registrarErrorSistema("Guardar Cliente de Revendedor", err.message, revendedor.nombre);
      notificar("Error al guardar: " + err.message, "error");
    }
  };

  // CUANDO EL REVENDEDOR SACA UNA CUENTA DE TU MATRIZ DIRECTAMENTE
  const venderPerfilDeMatriz = async (e) => {
    e.preventDefault();
    if (!matrizVender) return;
    if (!nomVentaStock.trim() || !telVentaStock.trim() || precioVentaStock === "") {
      return notificar("Completa los datos de tu cliente y tu precio de venta", "error");
    }

    const libres = (matrizVender.perfiles_matriz || [])
      .filter((p) => !p.ocupado && !p.caido)
      .sort((a, b) =>
        a.es_extra_final !== b.es_extra_final
          ? a.es_extra_final
            ? 1
            : -1
          : a.numero_slot - b.numero_slot
      );

    const slot = libres[0];
    if (!slot) return notificar("Ya no quedan perfiles libres en esta matriz", "error");

    setGuardandoStock(true);
    try {
      const costoUnitarioRev = obtenerPrecioRevendedorPlat(matrizVender.plataforma);
      const costoTotalParaRev = costoUnitarioRev * Number(mesesStock);
      const diasTotales = Number(mesesStock) === 12 ? 365 : Number(mesesStock) * 30;
      const hoyISO = obtenerFechaBoliviaISO();
      const fechaCorte = sumarDiasBoliviaISO(diasTotales, hoyISO);

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
            pagado_al_admin: false, // Queda pendiente de cobro para Mateus
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

      // Ocupar el perfil en la matriz
      await supabase
        .from("perfiles_matriz")
        .update({ ocupado: true })
        .eq("id", slot.id);

      // Enviar Alerta / Notificación de Cobro al Admin (Mateus)
      await supabase.from("notificaciones_sistema").insert([
        {
          tipo: "venta_revendedor",
          titulo: `🛒 ${revendedor.nombre} sacó ${matrizVender.plataforma} del Stock`,
          mensaje: `Correo: ${matrizVender.correo} (${slot.nombre_perfil}) para su cliente ${nomVentaStock.trim()}. Cobrar Bs ${costoTotalParaRev.toFixed(2)}.`,
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

  return (
    <div className="space-y-6">
      {/* TARJETAS FINANCIERAS DEL REVENDEDOR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Mis Ventas (Cobrado)</p>
          <p className="text-2xl font-black text-white mt-1">Bs {totalCobradoClientes.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">{misVentas.length} cuentas activas</p>
        </div>

        <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4">
          <p className="text-[11px] text-gray-400 uppercase font-bold">Mi Costo Base (MOSS)</p>
          <p className="text-2xl font-black text-orange-300 mt-1">Bs {totalCostoAdmin.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">Precio mayorista</p>
        </div>

        <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-2xl p-4">
          <p className="text-[11px] text-[#66FF00] uppercase font-extrabold">Mi Ganancia Neta</p>
          <p className={`text-2xl font-black mt-1 ${miGananciaNeta >= 0 ? "text-[#66FF00]" : "text-red-400"}`}>
            Bs {miGananciaNeta.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-400">Libre para ti</p>
        </div>

        <div className="bg-[#111A10] border border-amber-500/50 rounded-2xl p-4">
          <p className="text-[11px] text-amber-300 uppercase font-bold">Por Pagar a Admin</p>
          <p className="text-2xl font-black text-amber-400 mt-1">Bs {deudaPendienteAdmin.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">De perfiles sacados de Stock</p>
        </div>
      </div>

      {/* PESTAÑAS DEL REVENDEDOR */}
      <div className="flex flex-wrap gap-2 bg-[#0E170D] p-2 rounded-2xl border border-[#264023]">
        <button
          onClick={() => setTabRev("mis_clientes")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
            tabRev === "mis_clientes" ? "bg-[#66FF00] text-black" : "text-gray-300"
          }`}
        >
          <FolderSearch className="w-4 h-4" /> Mis Cuentas y Clientes ({misVentas.length})
        </button>

        {revendedor.puede_ver_matrices && (
          <button
            onClick={() => setTabRev("stock_disponible")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
              tabRev === "stock_disponible" ? "bg-[#66FF00] text-black" : "text-gray-300"
            }`}
          >
            <Layers className="w-4 h-4" /> Sacar Cuenta de Stock
          </button>
        )}

        <button
          onClick={() => setTabRev("renovaciones")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
            tabRev === "renovaciones" ? "bg-[#66FF00] text-black" : "text-gray-300"
          }`}
        >
          <BellRing className="w-4 h-4" /> Mis Renovaciones ({misRenovaciones.length})
        </button>
      </div>

      {/* PESTAÑA 1: MIS CUENTAS Y ANOTAR CLIENTE FINAL */}
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
                              ⏳ Falta pagar a Admin (Bs {s.precio_venta})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-900/50 text-green-300">
                              ✓ Pagado a Admin
                            </span>
                          )}

                          {faltaAnotar && (
                            <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> ¡Anota aquí los datos de tu cliente!
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-white pt-1">
                          Cliente Final:{" "}
                          {s.nombre_cliente_final ? (
                            <span className="text-[#66FF00]">
                              {s.nombre_cliente_final} (📞 {s.telefono_cliente_final})
                            </span>
                          ) : (
                            <span className="text-amber-400 italic">Sin anotar aún</span>
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
                          Vence: {formatearFechaDMA(s.fecha_corte)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1E331A]">
                      <button
                        onClick={() => abrirModalAnotarCliente(s)}
                        className="px-3.5 py-1.5 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {faltaAnotar ? "Anotar mi Cliente y Precio" : "Editar mi Cliente / Precio"}
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
                        <MessageSquare className="w-3.5 h-3.5" /> Copiar Mensaje para mi Cliente
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: MATRICES DISPONIBLES (SOLO SI EL ADMIN LE DIO PERMISO) */}
      {tabRev === "stock_disponible" && revendedor.puede_ver_matrices && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matrices
            .filter((m) => !m.en_papelera && m.estado === "Activa")
            .map((matriz) => {
              const perfiles = (matriz.perfiles_matriz || []).sort(
                (a, b) => a.numero_slot - b.numero_slot
              );
              const libres = perfiles.filter((p) => !p.ocupado && !p.caido);
              const precioMayorista = obtenerPrecioRevendedorPlat(matriz.plataforma);

              return (
                <div
                  key={matriz.id}
                  className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                        {matriz.plataforma}
                      </span>
                      <span className="ml-2 text-xs text-orange-300 font-bold">
                        Tu Costo: Bs {precioMayorista}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
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
                        <PlusCircle className="w-4 h-4" /> Vender 1 Cupo ({libres.length} libres)
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500 font-bold">Llena</span>
                    )}
                  </div>

                  {/* PERFILES: SOLO VE LOS NOMBRES DE SUS PROPIOS CLIENTES; LOS DE OTROS SALEN PRIVADOS */}
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
                        <div
                          key={p.id}
                          className={`p-2 rounded-xl border text-xs flex items-center gap-2 ${
                            esMio
                              ? "bg-[#1A2E17] border-[#66FF00]"
                              : p.ocupado || p.caido
                              ? "bg-[#070B06] border-gray-800 opacity-60"
                              : "bg-[#122010] border-[#66FF00]/40"
                          }`}
                        >
                          {esMio ? (
                            <UserCheck className="w-4 h-4 text-[#66FF00] shrink-0" />
                          ) : p.ocupado || p.caido ? (
                            <Lock className="w-4 h-4 text-gray-500 shrink-0" />
                          ) : (
                            <User className="w-4 h-4 text-[#66FF00] shrink-0" />
                          )}

                          <div className="min-w-0">
                            <p className="font-bold text-white text-[11px] truncate">
                              {p.nombre_perfil}
                            </p>
                            {esMio ? (
                              <>
                                <p className="text-[10px] text-[#66FF00] font-bold truncate">
                                  {subOcupante.nombre_cliente_final || "Tu Cliente"}
                                </p>
                                <p className="text-[9px] text-gray-300 font-mono truncate">
                                  {subOcupante.telefono_cliente_final || ""}
                                </p>
                              </>
                            ) : p.ocupado || p.caido ? (
                              <p className="text-[10px] text-gray-500">Ocupado</p>
                            ) : (
                              <p className="text-[10px] text-[#66FF00]">● Disponible</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* PESTAÑA 3: RENOVACIONES DE LOS CLIENTES DEL REVENDEDOR */}
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
                dias < 0
                  ? `Venció hace ${Math.abs(dias)}d`
                  : dias === 0
                  ? "¡Vence HOY!"
                  : `Vence en ${dias}d`;
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
                      Cuenta: {s.correo_cuenta} ({s.nombre_perfil}) · Vence:{" "}
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
                    <Copy className="w-3.5 h-3.5" /> Copiar Aviso de Renovación
                  </button>
                </div>
              );
            })
          )}
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
                Anotar Datos de tu Cliente ({subAnotar.plataforma})
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
              <button
                type="button"
                onClick={() => setSubAnotar(null)}
                className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer"
              >
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
              Costo de revendedor:{" "}
              <b>Bs {obtenerPrecioRevendedorPlat(matrizVender.plataforma)} / mes</b>. Al confirmar se enviará aviso al administrador para que luego realices el pago.
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
              <button
                type="button"
                onClick={() => setMatrizVender(null)}
                className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoStock}
                className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer"
              >
                {guardandoStock ? "Asignando..." : "Obtener Datos de Cuenta"}
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