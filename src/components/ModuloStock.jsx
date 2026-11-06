"use client";
import React, { useState, useEffect } from "react";
import { supabase, PLATAFORMAS, formatearFechaDMA } from "@/config";
import { extraerDatosProveedor } from "@/utils/extractorProveedor";
import { generarMensajeCambioCredencial } from "@/utils/mensajesMoss";
import {
  Plus,
  KeyRound,
  Unlock,
  AlertTriangle,
  Trash2,
  Edit3,
  Check,
  X,
  Copy,
  Sparkles,
  ClipboardPaste,
  UserPlus,
  Truck,
  Layers,
  Search
} from "lucide-react";

export default function ModuloStock({
  matrices = [],
  suscripciones = [],
  proveedores = [],
  plataformasList = PLATAFORMAS,
  recargarTodo,
  notificar
}) {
  const [modalNuevaMatriz, setModalNuevaMatriz] = useState(false);
  const [modalNuevoProv, setModalNuevoProv] = useState(false);
  const [matrizEditar, setMatrizEditar] = useState(null);

  const [busquedaStock, setBusquedaStock] = useState("");
  const [filtroPlatStock, setFiltroPlatStock] = useState("Todas");

  const [plataforma, setPlataforma] = useState("Netflix");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [costoTotal, setCostoTotal] = useState("");
  const [capacidad, setCapacidad] = useState(6);
  const [diasDuracion, setDiasDuracion] = useState(30);
  const [fechaCompra, setFechaCompra] = useState("");
  const [textoProveedorMatriz, setTextoProveedorMatriz] = useState("");
  const [cargando, setCargando] = useState(false);

  const [proveedorId, setProveedorId] = useState("");
  const [nuevoProvNombre, setNuevoProvNombre] = useState("");
  const [nuevoProvTelefono, setNuevoProvTelefono] = useState("");

  const [matrizCambioPass, setMatrizCambioPass] = useState(null);
  const [nuevaPass, setNuevaPass] = useState("");

  const [editandoPinId, setEditandoPinId] = useState(null);
  const [nuevoPinTexto, setNuevoPinTexto] = useState("");
  const [nuevoNombrePerfil, setNuevoNombrePerfil] = useState("");

  useEffect(() => {
    setFechaCompra(new Date().toISOString().split("T")[0]);
  }, []);

  const guardarNuevoProveedor = async (e) => {
    e.preventDefault();
    if (!nuevoProvNombre.trim() || !nuevoProvTelefono.trim()) return notificar("Completa nombre y teléfono", "error");
    const { data, error } = await supabase
      .from("proveedores")
      .insert([{ nombre: nuevoProvNombre.trim(), telefono: nuevoProvTelefono.trim() }])
      .select()
      .single();
    if (error) return notificar("Error: " + error.message, "error");
    setNuevoProvNombre("");
    setNuevoProvTelefono("");
    setModalNuevoProv(false);
    await recargarTodo();
    if (data) setProveedorId(data.id);
    notificar("Proveedor registrado");
  };

  const handleSelectPlataforma = (nombrePlat) => {
    setPlataforma(nombrePlat);
    const found = plataformasList.find((p) => p.nombre === nombrePlat);
    if (found) setCapacidad(found.perfilesDefault || 5);
  };

  const procesarTextoMatriz = (texto) => {
    setTextoProveedorMatriz(texto);
    const extraido = extraerDatosProveedor(texto, plataformasList);
    if (extraido.plataforma) handleSelectPlataforma(extraido.plataforma);
    if (extraido.correo) setCorreo(extraido.correo);
    if (extraido.password) setPassword(extraido.password);
    notificar("Datos extraídos");
  };

  const generarPinAleatorio = () => Math.floor(1000 + Math.random() * 9000).toString();

  const crearMatriz = async (e) => {
    e.preventDefault();
    if (!correo || costoTotal === "") return notificar("Completa correo y costo", "error");
    setCargando(true);
    try {
      const fechaBaseStr = fechaCompra || new Date().toISOString().split("T")[0];
      const fechaBase = new Date(fechaBaseStr + "T12:00:00");
      fechaBase.setDate(fechaBase.getDate() + Number(diasDuracion));
      const fechaCorte = fechaBase.toISOString().split("T")[0];
      const provObj = proveedores.find((p) => p.id === (proveedorId || proveedores[0]?.id));

      const { data: nuevaMatriz, error: errMatriz } = await supabase
        .from("matrices_stock")
        .insert([{
          plataforma,
          correo: correo.trim(),
          password: password.trim(),
          costo_total: Number(costoTotal),
          capacidad_total: Number(capacidad),
          fecha_compra: fechaBaseStr,
          fecha_corte_matriz: fechaCorte,
          proveedor_id: provObj ? provObj.id : null,
          nombre_proveedor: provObj ? provObj.nombre : null,
          telefono_proveedor: provObj ? provObj.telefono : null,
          estado: "Activa"
        }])
        .select()
        .single();

      if (errMatriz) throw errMatriz;

      const esNetflix = plataforma.toLowerCase().includes("netflix") && Number(capacidad) === 6;
      const perfilesInsertar = [];
      for (let i = 1; i <= Number(capacidad); i++) {
        perfilesInsertar.push({
          matriz_id: nuevaMatriz.id,
          numero_slot: i,
          nombre_perfil: esNetflix && i === 6 ? "Perfil 1 (Extra)" : `Perfil ${i}`,
          pin: esNetflix && i === 6 ? "2020" : generarPinAleatorio(),
          es_extra_final: esNetflix && i === 6,
          ocupado: false,
          caido: false
        });
      }
      await supabase.from("perfiles_matriz").insert(perfilesInsertar);

      if (Number(costoTotal) > 0) {
        await supabase.from("movimientos_yolo").insert([{
          tipo: "Costo Matriz",
          monto: -Math.abs(Number(costoTotal)),
          afecta_ganancia_neta: true,
          descripcion: `Compra matriz ${plataforma} (${correo.trim()})`,
          referencia_id: nuevaMatriz.id
        }]);
      }

      setCorreo("");
      setPassword("");
      setCostoTotal("");
      setModalNuevaMatriz(false);
      await recargarTodo();
      notificar("Matriz creada en Stock");
    } catch (err) {
      notificar("Error: " + err.message, "error");
    } finally {
      setCargando(false);
    }
  };

  const guardarEdicionMatriz = async (e) => {
    e.preventDefault();
    const provObj = proveedores.find((p) => p.id === matrizEditar.proveedor_id);
    await supabase
      .from("matrices_stock")
      .update({
        plataforma: matrizEditar.plataforma,
        correo: matrizEditar.correo,
        password: matrizEditar.password,
        costo_total: Number(matrizEditar.costo_total),
        fecha_corte_matriz: matrizEditar.fecha_corte_matriz,
        proveedor_id: provObj ? provObj.id : null,
        nombre_proveedor: provObj ? provObj.nombre : null,
        telefono_proveedor: provObj ? provObj.telefono : null
      })
      .eq("id", matrizEditar.id);

    setMatrizEditar(null);
    await recargarTodo();
    notificar("Matriz actualizada");
  };

  const guardarNuevaPassMatriz = async () => {
    if (!nuevaPass.trim()) return;
    await supabase.from("matrices_stock").update({ password: nuevaPass.trim() }).eq("id", matrizCambioPass.id);
    await supabase
      .from("suscripciones")
      .update({ password_cuenta: nuevaPass.trim() })
      .eq("matriz_id", matrizCambioPass.id)
      .eq("estado", "Activa");
    await recargarTodo();
    notificar("Contraseña actualizada. Usa el botón morado para copiar el aviso corto");
  };

  const guardarEdicionPerfil = async (perfilId) => {
    await supabase
      .from("perfiles_matriz")
      .update({ pin: nuevoPinTexto, nombre_perfil: nuevoNombrePerfil })
      .eq("id", perfilId);
    await supabase
      .from("suscripciones")
      .update({ pin_perfil: nuevoPinTexto, nombre_perfil: nuevoNombrePerfil })
      .eq("perfil_id", perfilId)
      .eq("estado", "Activa");
    setEditandoPinId(null);
    await recargarTodo();
    notificar("Perfil/PIN actualizado");
  };

  const marcarMatrizCaida = async (matriz) => {
    const nuevoEstado = matriz.estado === "Caida" ? "Activa" : "Caida";
    await supabase.from("matrices_stock").update({ estado: nuevoEstado }).eq("id", matriz.id);
    if (nuevoEstado === "Caida") {
      await supabase.from("suscripciones").update({ estado: "Caida" }).eq("matriz_id", matriz.id).eq("estado", "Activa");
    } else {
      // Si el usuario marca la matriz como Resuelta/Reactivada, también limpia los perfiles caídos de esa matriz
      await supabase.from("perfiles_matriz").update({ caido: false }).eq("matriz_id", matriz.id);
    }
    await recargarTodo();
    notificar(nuevoEstado === "Caida" ? "Matriz marcada como Caída" : "Matriz resuelta y perfiles habilitados");
  };

  const calcularDiasRestantes = (fechaCorte) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const corte = new Date(fechaCorte + "T00:00:00");
    return Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
  };

  const matricesActivas = matrices.filter((m) => !m.en_papelera);
  const matricesFiltradas = matricesActivas.filter((m) => {
    if (filtroPlatStock !== "Todas" && m.plataforma !== filtroPlatStock) return false;
    if (busquedaStock.trim() !== "") {
      const q = busquedaStock.toLowerCase().trim();
      const coincideM =
        (m.correo || "").toLowerCase().includes(q) ||
        (m.plataforma || "").toLowerCase().includes(q) ||
        (m.nombre_proveedor || "").toLowerCase().includes(q);
      const clientesDentro = suscripciones.filter((s) => s.matriz_id === m.id && !s.en_papelera);
      const coincideC = clientesDentro.some(
        (s) => (s.telefono_cliente || "").toLowerCase().includes(q) || (s.nombre_cliente || "").toLowerCase().includes(q)
      );
      if (!coincideM && !coincideC) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* CABECERA */}
      <div className="bg-gradient-to-r from-[#162914] to-[#0E180D] border border-[#66FF00]/40 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#66FF00]" /> Matrices en Stock ({matricesActivas.length})
          </h2>
          <p className="text-xs text-gray-300">
            Botones morados para copiar aviso corto de cambio de clave/PIN y control de perfiles caídos.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalNuevoProv(true)}
            className="px-4 py-3 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/40 font-extrabold text-xs rounded-2xl cursor-pointer"
          >
            + Nuevo Proveedor
          </button>
          <button
            onClick={() => setModalNuevaMatriz(true)}
            className="px-6 py-3 bg-[#66FF00] text-black font-black text-xs sm:text-sm rounded-2xl cursor-pointer"
          >
            + NUEVA MATRIZ
          </button>
        </div>
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#66FF00] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar matriz por teléfono de cliente, nombre, correo de matriz o proveedor..."
            value={busquedaStock}
            onChange={(e) => setBusquedaStock(e.target.value)}
            className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl pl-10 pr-4 py-2 text-sm text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroPlatStock("Todas")}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
              filtroPlatStock === "Todas" ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
            }`}
          >
            Todas ({matricesActivas.length})
          </button>
          {plataformasList.map((p) => {
            const count = matricesActivas.filter((m) => m.plataforma === p.nombre).length;
            if (count === 0) return null;
            return (
              <button
                key={p.nombre}
                onClick={() => setFiltroPlatStock(p.nombre)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  filtroPlatStock === p.nombre ? "bg-[#66FF00] text-black border-[#66FF00]" : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                }`}
              >
                {p.nombre} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* GRILLA DE MATRICES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matricesFiltradas.map((matriz) => {
          const perfiles = (matriz.perfiles_matriz || []).sort((a, b) => a.numero_slot - b.numero_slot);
          const libres = perfiles.filter((p) => !p.ocupado && !p.caido).length;
          const diasVida = calcularDiasRestantes(matriz.fecha_corte_matriz);

          return (
            <div
              key={matriz.id}
              className={`bg-[#111A10] border rounded-2xl p-4 space-y-3 ${
                matriz.estado === "Caida" ? "border-red-500" : "border-[#233820]"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                    {matriz.plataforma}
                  </span>
                  {matriz.nombre_proveedor && (
                    <span className="ml-2 px-2 py-0.5 text-[11px] rounded bg-gray-800 text-gray-300">
                      Prov: {matriz.nombre_proveedor}
                    </span>
                  )}
                  <h3 className="font-bold text-base mt-1 break-all">{matriz.correo}</h3>
                  <p className="text-xs text-gray-400">
                    Clave: <span className="text-white font-mono">{matriz.password || "N/A"}</span> · Costo: Bs {matriz.costo_total}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#66FF00]/15 text-[#66FF00]">
                    {libres} / {perfiles.length} Libres
                  </span>
                  <p className="text-xs mt-1 text-gray-400">
                    Vence: {formatearFechaDMA(matriz.fecha_corte_matriz)} ({diasVida}d)
                  </p>
                </div>
              </div>

              {/* PERFILES CON BOTÓN MORADO PARA AVISO DE CAMBIO DE PIN Y CONTROL DE CAÍDOS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#1E331A]">
                {perfiles.map((p) => {
                  const subOcupante = suscripciones.find(
                    (s) => s.perfil_id === p.id && s.estado === "Activa" && !s.en_papelera
                  );

                  return (
                    <div
                      key={p.id}
                      className={`p-2 rounded-xl border text-xs flex flex-col justify-between ${
                        p.caido
                          ? "bg-red-950/50 border-red-500 text-red-200"
                          : p.ocupado
                          ? "bg-[#070B06] border-gray-800 text-gray-400"
                          : "bg-[#162614] border-[#66FF00]/40 text-white"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold truncate">{p.nombre_perfil}</span>
                        <div className="flex items-center gap-1">
                          {/* BOTÓN MORADO PARA COPIAR AVISO CORTO DE CAMBIO DE PIN/CLAVE DE ESTE PERFIL */}
                          <button
                            onClick={() => {
                              const msg = generarMensajeCambioCredencial(
                                "PIN / Contraseña",
                                matriz.plataforma,
                                matriz.correo,
                                matriz.password,
                                p.nombre_perfil,
                                p.pin
                              );
                              navigator.clipboard.writeText(msg);
                              notificar("Aviso corto de cambio copiado (Morado)");
                            }}
                            className="p-1 rounded bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
                            title="Copiar mensaje corto de cambio de PIN/Clave"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setEditandoPinId(p.id);
                              setNuevoPinTexto(p.pin);
                              setNuevoNombrePerfil(p.nombre_perfil);
                            }}
                            className="text-gray-400 hover:text-[#66FF00]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {editandoPinId === p.id ? (
                        <div className="mt-1 space-y-1">
                          <input
                            type="text"
                            value={nuevoNombrePerfil}
                            onChange={(e) => setNuevoNombrePerfil(e.target.value)}
                            className="w-full bg-black border border-[#66FF00] rounded px-1 py-0.5 text-xs text-white"
                          />
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={nuevoPinTexto}
                              onChange={(e) => setNuevoPinTexto(e.target.value)}
                              className="w-full bg-black border border-[#66FF00] rounded px-1 py-0.5 text-xs text-white"
                            />
                            <button onClick={() => guardarEdicionPerfil(p.id)} className="text-[#66FF00]">
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[11px] text-gray-300 mt-0.5">
                            PIN: <span className="font-mono text-[#66FF00]">{p.pin}</span>
                          </p>
                          {p.caido ? (
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] text-red-400 font-extrabold">⚠️ Caído</span>
                              <button
                                onClick={async () => {
                                  await supabase.from("perfiles_matriz").update({ caido: false, ocupado: false }).eq("id", p.id);
                                  await recargarTodo();
                                  notificar("Perfil marcado como Resuelto y Disponible");
                                }}
                                className="px-1.5 py-0.5 bg-[#66FF00] text-black rounded text-[10px] font-extrabold cursor-pointer"
                              >
                                Resuelto
                              </button>
                            </div>
                          ) : p.ocupado ? (
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] text-orange-400 font-bold truncate">
                                {subOcupante ? subOcupante.nombre_cliente : "Ocupado"}
                              </span>
                              <button
                                onClick={async () => {
                                  await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", p.id);
                                  await recargarTodo();
                                  notificar("Perfil liberado");
                                }}
                                className="text-[10px] underline text-gray-400 hover:text-white"
                              >
                                Liberar
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#66FF00] font-semibold mt-1">● Disponible</span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ACCIONES DE LA MATRIZ (INCLUYE BOTÓN MORADO Y EDITAR MATRIZ) */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1E331A]">
                <button
                  onClick={() => {
                    setMatrizCambioPass(matriz);
                    setNuevaPass(matriz.password);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-extrabold text-white flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Cambiar Clave / Copiar Aviso
                </button>

                <button
                  onClick={() => setMatrizEditar(matriz)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1A2B18] text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#66FF00]" /> Editar Matriz
                </button>

                <button
                  onClick={() => marcarMatrizCaida(matriz)}
                  className="px-2.5 py-1.5 rounded-lg bg-red-950/60 text-xs text-red-300 border border-red-800/50 flex items-center gap-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {matriz.estado === "Caida" ? "Marcar Resuelta" : "Marcar Caída"}
                </button>

                <button
                  onClick={async () => {
                    await supabase.from("matrices_stock").update({ en_papelera: true }).eq("id", matriz.id);
                    await supabase.from("movimientos_yolo").delete().eq("referencia_id", matriz.id);
                    await recargarTodo();
                    notificar("Matriz enviada a papelera");
                  }}
                  className="ml-auto p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL CAMBIO DE CLAVE CON BOTÓN MORADO DE AVISO CORTO */}
      {matrizCambioPass && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-purple-500 rounded-3xl p-5 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-purple-300">Cambiar Contraseña y Copiar Aviso Corto</h3>
              <button onClick={() => setMatrizCambioPass(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevaPass}
                onChange={(e) => setNuevaPass(e.target.value)}
                className="flex-1 bg-[#070B06] border border-purple-500 rounded-xl p-2 text-white text-xs"
              />
              <button
                onClick={guardarNuevaPassMatriz}
                className="px-4 py-2 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs cursor-pointer"
              >
                Guardar Clave
              </button>
            </div>

            <button
              onClick={() => {
                const msg = generarMensajeCambioCredencial(
                  "Contraseña",
                  matrizCambioPass.plataforma,
                  matrizCambioPass.correo,
                  nuevaPass,
                  null,
                  null
                );
                navigator.clipboard.writeText(msg);
                notificar("Aviso corto de cambio de contraseña copiado");
              }}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4" /> Copiar Aviso Corto General (Morado)
            </button>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pt-2 border-t border-[#1E331A]">
              <p className="text-[11px] text-gray-400">O copiar aviso corto con el perfil y PIN de cada cliente:</p>
              {suscripciones
                .filter((s) => s.matriz_id === matrizCambioPass.id && s.estado === "Activa" && !s.en_papelera)
                .map((c) => {
                  const msgCliente = generarMensajeCambioCredencial(
                    "Contraseña",
                    c.plataforma,
                    c.correo_cuenta,
                    nuevaPass,
                    c.nombre_perfil,
                    c.pin_perfil
                  );
                  return (
                    <div key={c.id} className="flex justify-between items-center bg-[#070B06] p-2 rounded-xl text-xs">
                      <span>
                        <b>{c.nombre_cliente}</b> ({c.nombre_perfil})
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msgCliente);
                          notificar(`Aviso corto para ${c.nombre_cliente} copiado`);
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" /> Copiar Aviso
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR MATRIZ COMPLETA */}
      {matrizEditar && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <form onSubmit={guardarEdicionMatriz} className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-md w-full space-y-3">
            <h3 className="font-black text-[#66FF00]">Editar Matriz</h3>
            <select
              value={matrizEditar.plataforma}
              onChange={(e) => setMatrizEditar({ ...matrizEditar, plataforma: e.target.value })}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
            >
              {plataformasList.map((p) => (
                <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
              ))}
            </select>
            <input
              type="text"
              value={matrizEditar.correo}
              onChange={(e) => setMatrizEditar({ ...matrizEditar, correo: e.target.value })}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
            />
            <input
              type="text"
              value={matrizEditar.password || ""}
              onChange={(e) => setMatrizEditar({ ...matrizEditar, password: e.target.value })}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
            />
            <input
              type="number"
              step="0.01"
              value={matrizEditar.costo_total}
              onChange={(e) => setMatrizEditar({ ...matrizEditar, costo_total: e.target.value })}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
            />
            <input
              type="date"
              value={matrizEditar.fecha_corte_matriz}
              onChange={(e) => setMatrizEditar({ ...matrizEditar, fecha_corte_matriz: e.target.value })}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
            />
            <select
              value={matrizEditar.proveedor_id || ""}
              onChange={(e) => setMatrizEditar({ ...matrizEditar, proveedor_id: e.target.value })}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
            >
              <option value="">-- Sin Proveedor --</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.telefono})</option>
              ))}
            </select>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setMatrizEditar(null)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="submit" className="flex-1 py-2 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NUEVA MATRIZ */}
      {modalNuevaMatriz && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={crearMatriz} className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-xl w-full space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-black text-[#66FF00]">Registrar Nueva Matriz</h2>
              <button type="button" onClick={() => setModalNuevaMatriz(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <select value={proveedorId || proveedores[0]?.id || ""} onChange={(e) => setProveedorId(e.target.value)} className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs">
              {proveedores.map((p) => (<option key={p.id} value={p.id}>{p.nombre} — 📞 {p.telefono}</option>))}
            </select>
            <textarea rows={2} placeholder="Pega aquí mensaje del proveedor para autocompletar..." value={textoProveedorMatriz} onChange={(e) => procesarTextoMatriz(e.target.value)} className="w-full bg-[#070B06] border border-[#233820] rounded-lg p-2 text-xs text-white" />
            <div className="grid grid-cols-2 gap-2">
              <select value={plataforma} onChange={(e) => handleSelectPlataforma(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs">
                {plataformasList.map((p) => (<option key={p.nombre} value={p.nombre}>{p.nombre}</option>))}
              </select>
              <input type="number" step="0.01" placeholder="Costo Total (Bs)" value={costoTotal} onChange={(e) => setCostoTotal(e.target.value)} className="bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-white text-xs font-bold" />
              <input type="text" placeholder="Correo *" value={correo} onChange={(e) => setCorreo(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs" />
              <input type="text" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs" />
              <input type="number" placeholder="Cupos" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs" />
              <input type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModalNuevaMatriz(false)} className="px-4 py-2.5 bg-gray-800 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="submit" disabled={cargando} className="flex-1 py-2.5 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer">Guardar Matriz</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NUEVO PROVEEDOR */}
      {modalNuevoProv && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[60]">
          <form onSubmit={guardarNuevoProveedor} className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-3">
            <h3 className="font-black text-[#66FF00]">Registrar Proveedor</h3>
            <input type="text" placeholder="Nombre" value={nuevoProvNombre} onChange={(e) => setNuevoProvNombre(e.target.value)} className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white" />
            <input type="text" placeholder="Teléfono" value={nuevoProvTelefono} onChange={(e) => setNuevoProvTelefono(e.target.value)} className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalNuevoProv(false)} className="flex-1 py-2 bg-gray-800 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="submit" className="flex-1 py-2 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}