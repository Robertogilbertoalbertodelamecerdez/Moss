"use client";
import React, { useState, useEffect } from "react";
import { supabase, PLATAFORMAS, formatearFechaDMA } from "@/config";
import { extraerDatosProveedor } from "@/utils/extractorProveedor";
import {
  Plus,
  KeyRound,
  Unlock,
  AlertTriangle,
  Trash2,
  Edit3,
  Check,
  X,
  Share2,
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
  const [clientesAfectados, setClientesAfectados] = useState([]);

  const [editandoPinId, setEditandoPinId] = useState(null);
  const [nuevoPinTexto, setNuevoPinTexto] = useState("");
  const [nuevoNombrePerfil, setNuevoNombrePerfil] = useState("");

  useEffect(() => {
    setFechaCompra(new Date().toISOString().split("T")[0]);
  }, []);

  const guardarNuevoProveedor = async (e) => {
    e.preventDefault();
    if (!nuevoProvNombre.trim() || !nuevoProvTelefono.trim()) {
      return notificar("Ingresa nombre y número del proveedor", "error");
    }
    const { data, error } = await supabase
      .from("proveedores")
      .insert([{
        nombre: nuevoProvNombre.trim(),
        telefono: nuevoProvTelefono.trim()
      }])
      .select()
      .single();

    if (error) return notificar("Error: " + error.message, "error");

    setNuevoProvNombre("");
    setNuevoProvTelefono("");
    setModalNuevoProv(false);
    await recargarTodo();
    if (data) setProveedorId(data.id);
    notificar("Proveedor registrado con éxito");
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
    notificar("Datos extraídos del mensaje");
  };

  const pegarPortapapelesMatriz = async () => {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) procesarTextoMatriz(texto);
    } catch {
      notificar("Pega el mensaje directamente en el recuadro", "error");
    }
  };

  const generarPinAleatorio = () => Math.floor(1000 + Math.random() * 9000).toString();

  const crearMatriz = async (e) => {
    e.preventDefault();
    if (!correo || costoTotal === "") {
      return notificar("Completa correo y costo de la matriz", "error");
    }
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
        if (esNetflix && i === 6) {
          perfilesInsertar.push({
            matriz_id: nuevaMatriz.id,
            numero_slot: 6,
            nombre_perfil: "Perfil 1 (Extra)",
            pin: "2020",
            es_extra_final: true,
            ocupado: false
          });
        } else {
          perfilesInsertar.push({
            matriz_id: nuevaMatriz.id,
            numero_slot: i,
            nombre_perfil: `Perfil ${i}`,
            pin: generarPinAleatorio(),
            es_extra_final: false,
            ocupado: false
          });
        }
      }

      await supabase.from("perfiles_matriz").insert(perfilesInsertar);

      if (Number(costoTotal) > 0) {
        await supabase.from("movimientos_yolo").insert([{
          tipo: "Costo Matriz",
          monto: -Math.abs(Number(costoTotal)),
          afecta_ganancia_neta: true,
          descripcion: `Compra matriz ${plataforma} (${correo.trim()})${provObj ? ` a ${provObj.nombre}` : ""}`,
          referencia_id: nuevaMatriz.id
        }]);
      }

      setTextoProveedorMatriz("");
      setCorreo("");
      setPassword("");
      setCostoTotal("");
      setModalNuevaMatriz(false);
      await recargarTodo();
      notificar(`Matriz ${plataforma} creada en Stock`);
    } catch (err) {
      notificar("Error: " + err.message, "error");
    } finally {
      setCargando(false);
    }
  };

  const liberarStockProximoAVencer = async (matriz) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const subsEnMatriz = suscripciones.filter(
      (s) => s.matriz_id === matriz.id && s.estado === "Activa" && !s.en_papelera
    );

    const subsLiberar = subsEnMatriz.filter((s) => {
      const corte = new Date(s.fecha_corte + "T00:00:00");
      const diffDias = Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
      return diffDias <= 2;
    });

    if (subsLiberar.length === 0) {
      return notificar("No hay perfiles en esta matriz con ≤ 2 días", "error");
    }

    for (const sub of subsLiberar) {
      if (sub.perfil_id) {
        await supabase.from("perfiles_matriz").update({ ocupado: false }).eq("id", sub.perfil_id);
      }
      await supabase.from("suscripciones").update({ perfil_id: null }).eq("id", sub.id);
    }

    await recargarTodo();
    notificar(`Se liberaron ${subsLiberar.length} perfil(es) para revender`);
  };

  const abrirModalCambioPass = (matriz) => {
    setMatrizCambioPass(matriz);
    setNuevaPass(matriz.password);
    const activos = suscripciones.filter(
      (s) => s.matriz_id === matriz.id && s.estado === "Activa" && !s.en_papelera
    );
    setClientesAfectados(activos);
  };

  const guardarNuevaPassMatriz = async () => {
    if (!nuevaPass.trim()) return;
    await supabase
      .from("matrices_stock")
      .update({ password: nuevaPass.trim() })
      .eq("id", matrizCambioPass.id);

    await supabase
      .from("suscripciones")
      .update({ password_cuenta: nuevaPass.trim() })
      .eq("matriz_id", matrizCambioPass.id)
      .eq("estado", "Activa");

    await recargarTodo();
    notificar("Contraseña actualizada en matriz y clientes");
  };

  const marcarMatrizCaida = async (matriz) => {
    const nuevoEstado = matriz.estado === "Caida" ? "Activa" : "Caida";
    await supabase.from("matrices_stock").update({ estado: nuevoEstado }).eq("id", matriz.id);
    if (nuevoEstado === "Caida") {
      await supabase
        .from("suscripciones")
        .update({ estado: "Caida" })
        .eq("matriz_id", matriz.id)
        .eq("estado", "Activa");
    }
    await recargarTodo();
    notificar(nuevoEstado === "Caida" ? "Matriz y clientes marcados como Caídos" : "Matriz reactivada");
  };

  const eliminarMatrizPapelera = async (matriz) => {
    await supabase.from("matrices_stock").update({ en_papelera: true }).eq("id", matriz.id);
    await supabase.from("movimientos_yolo").delete().eq("referencia_id", matriz.id);
    await recargarTodo();
    notificar("Matriz enviada a la papelera");
  };

  const guardarEdicionPerfil = async (perfilId) => {
    await supabase
      .from("perfiles_matriz")
      .update({ pin: nuevoPinTexto, nombre_perfil: nuevoNombrePerfil })
      .eq("id", perfilId);
    setEditandoPinId(null);
    await recargarTodo();
    notificar("Perfil y PIN actualizados");
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
      const coincideMatriz =
        (m.correo || "").toLowerCase().includes(q) ||
        (m.plataforma || "").toLowerCase().includes(q) ||
        (m.nombre_proveedor || "").toLowerCase().includes(q);

      const clientesDentroDeEstaMatriz = suscripciones.filter(
        (s) => s.matriz_id === m.id && !s.en_papelera
      );
      const coincideClienteOcupante = clientesDentroDeEstaMatriz.some(
        (s) =>
          (s.telefono_cliente || "").toLowerCase().includes(q) ||
          (s.nombre_cliente || "").toLowerCase().includes(q)
      );

      if (!coincideMatriz && !coincideClienteOcupante) return false;
    }

    return true;
  });

  return (
    <div className="space-y-5">
      {/* CABECERA */}
      <div className="bg-gradient-to-r from-[#162914] to-[#0E180D] border border-[#66FF00]/40 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#66FF00]" /> Matrices en Stock ({matricesActivas.length})
          </h2>
          <p className="text-xs text-gray-300 mt-0.5">
            Filtra por plataforma o escribe el número de un cliente para encontrar en qué matriz está su perfil.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalNuevoProv(true)}
            className="px-4 py-3 bg-[#1A2B18] hover:bg-[#253D22] text-[#66FF00] border border-[#66FF00]/40 font-extrabold text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> + Nuevo Proveedor
          </button>

          <button
            type="button"
            onClick={() => setModalNuevaMatriz(true)}
            className="px-6 py-3 bg-gradient-to-r from-[#66FF00] to-[#4CE600] hover:brightness-110 text-black font-black text-xs sm:text-sm rounded-2xl shadow-[0_0_25px_rgba(102,255,0,0.4)] flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5" /> + NUEVA MATRIZ
          </button>
        </div>
      </div>

      {/* BARRA DE BUSCADOR + PESTAÑAS POR PLATAFORMA */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#66FF00] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar matriz por número de cliente (ej: 77012345), nombre de cliente, correo de matriz o proveedor..."
            value={busquedaStock}
            onChange={(e) => setBusquedaStock(e.target.value)}
            className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-[#66FF00] outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setFiltroPlatStock("Todas")}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
              filtroPlatStock === "Todas"
                ? "bg-[#66FF00] text-black border-[#66FF00]"
                : "bg-[#070B06] text-gray-300 border-[#2A4226]"
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
                type="button"
                onClick={() => setFiltroPlatStock(p.nombre)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  filtroPlatStock === p.nombre
                    ? "bg-[#66FF00] text-black border-[#66FF00]"
                    : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                }`}
              >
                {p.nombre} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* GRILLA DE MATRICES */}
      {matricesFiltradas.length === 0 ? (
        <div className="bg-[#111A10] border border-[#233820] rounded-3xl p-10 text-center text-gray-400 text-sm">
          No se encontraron matrices con ese filtro o búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matricesFiltradas.map((matriz) => {
            const perfiles = (matriz.perfiles_matriz || []).sort((a, b) => a.numero_slot - b.numero_slot);
            const libres = perfiles.filter((p) => !p.ocupado).length;
            const diasVida = calcularDiasRestantes(matriz.fecha_corte_matriz);

            return (
              <div
                key={matriz.id}
                className={`bg-[#111A10] border rounded-2xl p-4 space-y-3 shadow-md ${
                  matriz.estado === "Caida"
                    ? "border-red-500/80"
                    : diasVida <= 3
                    ? "border-yellow-500/80"
                    : "border-[#233820]"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#66FF00]/20 text-[#66FF00] border border-[#66FF00]/40">
                      {matriz.plataforma}
                    </span>
                    {matriz.nombre_proveedor && (
                      <span className="ml-2 px-2 py-0.5 text-[11px] rounded bg-gray-800 text-gray-300">
                        Prov: {matriz.nombre_proveedor} {matriz.telefono_proveedor ? `(${matriz.telefono_proveedor})` : ""}
                      </span>
                    )}
                    {matriz.estado === "Caida" && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">
                        MATRIZ CAÍDA
                      </span>
                    )}
                    <h3 className="font-bold text-base mt-1 break-all">{matriz.correo}</h3>
                    <p className="text-xs text-gray-400">
                      Clave: <span className="text-white font-mono">{matriz.password || "N/A"}</span> · Costo: Bs {matriz.costo_total}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      libres > 0 ? "bg-[#66FF00]/15 text-[#66FF00]" : "bg-gray-800 text-gray-400"
                    }`}>
                      {libres} / {perfiles.length} Libres
                    </span>
                    <p className={`text-xs mt-1 font-semibold ${diasVida <= 3 ? "text-yellow-400" : "text-gray-400"}`}>
                      Vence en {diasVida}d ({formatearFechaDMA(matriz.fecha_corte_matriz)})
                    </p>
                  </div>
                </div>

                {/* PERFILES */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#1E331A]">
                  {perfiles.map((p) => {
                    const subOcupante = suscripciones.find(
                      (s) => s.perfil_id === p.id && s.estado === "Activa" && !s.en_papelera
                    );
                    const resaltaPorBusqueda =
                      busquedaStock.trim() !== "" &&
                      subOcupante &&
                      ((subOcupante.telefono_cliente || "").includes(busquedaStock.trim()) ||
                        (subOcupante.nombre_cliente || "").toLowerCase().includes(busquedaStock.toLowerCase().trim()));

                    return (
                      <div
                        key={p.id}
                        className={`p-2 rounded-xl border text-xs flex flex-col justify-between ${
                          resaltaPorBusqueda
                            ? "bg-[#223B1E] border-2 border-[#66FF00] text-white"
                            : p.ocupado
                            ? "bg-[#070B06] border-gray-800 text-gray-400"
                            : "bg-[#162614] border-[#66FF00]/40 text-white"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold truncate">{p.nombre_perfil}</span>
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
                              <button onClick={() => setEditandoPinId(null)} className="text-red-400">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-[11px] text-gray-300 mt-0.5">
                              PIN: <span className="font-mono text-[#66FF00]">{p.pin}</span>
                            </p>
                            {p.ocupado ? (
                              <div className="mt-1">
                                <p className="text-[10px] text-orange-400 font-bold truncate">
                                  {subOcupante ? subOcupante.nombre_cliente : "Ocupado"}
                                </p>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    {subOcupante ? subOcupante.telefono_cliente : ""}
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

                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1E331A]">
                  <button
                    onClick={() => liberarStockProximoAVencer(matriz)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1A2B18] hover:bg-[#253D22] text-xs text-[#66FF00] border border-[#66FF00]/30 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Liberar Stock (≤ 2 días)
                  </button>

                  <button
                    onClick={() => abrirModalCambioPass(matriz)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1A2B18] hover:bg-[#253D22] text-xs text-white cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Cambiar Clave
                  </button>

                  <button
                    onClick={() => marcarMatrizCaida(matriz)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 text-xs text-red-300 border border-red-800/50 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> {matriz.estado === "Caida" ? "Reactivar" : "Marcar Caída"}
                  </button>

                  <button
                    onClick={() => eliminarMatrizPapelera(matriz)}
                    className="ml-auto p-1.5 rounded-lg bg-gray-900 hover:bg-red-950 text-gray-400 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VENTANA EMERGENTE: REGISTRAR NUEVA MATRIZ */}
      {modalNuevaMatriz && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={crearMatriz}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-[0_0_60px_rgba(102,255,0,0.25)] max-h-[92vh] overflow-y-auto animate-modal"
          >
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <h2 className="text-lg font-black text-[#66FF00] flex items-center gap-2">
                <Plus className="w-5 h-5" /> Registrar Nueva Matriz en Stock
              </h2>
              <button
                type="button"
                onClick={() => setModalNuevaMatriz(false)}
                className="p-1.5 rounded-xl bg-[#070B06] text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0B120A] border border-[#233820] rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#66FF00] flex items-center gap-1.5">
                  <Truck className="w-4 h-4" /> Proveedor de esta Matriz
                </label>
                <button
                  type="button"
                  onClick={() => setModalNuevoProv(true)}
                  className="px-3 py-1 bg-[#1A2B18] hover:bg-[#253D22] text-[#66FF00] border border-[#66FF00]/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> + Nuevo Proveedor
                </button>
              </div>

              <select
                value={proveedorId || proveedores[0]?.id || ""}
                onChange={(e) => setProveedorId(e.target.value)}
                className="w-full bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs"
              >
                {proveedores.length === 0 && <option value="">-- Sin proveedor --</option>}
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — 📞 {p.telefono}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-[#0B120A] border border-[#2A4226] rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#66FF00] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Autocompletar pegando mensaje del proveedor
                </label>
                <button
                  type="button"
                  onClick={pegarPortapapelesMatriz}
                  className="px-3 py-1 bg-[#66FF00] text-black font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" /> Pegar Portapapeles
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="Pega aquí el mensaje de la cuenta completa..."
                value={textoProveedorMatriz}
                onChange={(e) => procesarTextoMatriz(e.target.value)}
                className="w-full bg-[#070B06] border border-[#233820] rounded-lg p-2 text-xs text-gray-200 focus:border-[#66FF00] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400">Plataforma</label>
                <select
                  value={plataforma}
                  onChange={(e) => handleSelectPlataforma(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white"
                >
                  {plataformasList.map((p) => (
                    <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Costo Cuenta Completa (Bs)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 45"
                  value={costoTotal}
                  onChange={(e) => setCostoTotal(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">Correo de la Cuenta *</label>
                <input
                  type="text"
                  placeholder="correo@dominio.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">Contraseña</label>
                <input
                  type="text"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">
                  Total Cupos {plataforma === "Netflix" && Number(capacidad) === 6 ? "(Incluye 6to PIN 2020)" : ""}
                </label>
                <input
                  type="number"
                  value={capacidad}
                  onChange={(e) => setCapacidad(e.target.value)}
                  className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">
                    Compra ({formatearFechaDMA(fechaCompra)})
                  </label>
                  <input
                    type="date"
                    value={fechaCompra}
                    onChange={(e) => setFechaCompra(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Días Duración</label>
                  <input
                    type="number"
                    value={diasDuracion}
                    onChange={(e) => setDiasDuracion(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalNuevaMatriz(false)}
                className="px-5 py-3 bg-gray-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="flex-1 py-3 bg-[#66FF00] hover:bg-[#52cc00] text-black font-black rounded-xl text-xs sm:text-sm cursor-pointer"
              >
                {cargando ? "Guardando..." : "Guardar Matriz y Descontar Saldo"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VENTANA EMERGENTE: REGISTRAR NUEVO PROVEEDOR */}
      {modalNuevoProv && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <form
            onSubmit={guardarNuevoProveedor}
            className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_50px_rgba(102,255,0,0.3)] animate-modal"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[#66FF00] flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Registrar Proveedor
              </h3>
              <button type="button" onClick={() => setModalNuevoProv(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-400">Nombre del Proveedor</label>
              <input
                type="text"
                placeholder="Ej: Destre"
                value={nuevoProvNombre}
                onChange={(e) => setNuevoProvNombre(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Número de Teléfono / WhatsApp</label>
              <input
                type="text"
                placeholder="Ej: 69490298"
                value={nuevoProvTelefono}
                onChange={(e) => setNuevoProvTelefono(e.target.value)}
                className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2.5 text-sm text-white"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModalNuevoProv(false)} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-[#66FF00] text-black rounded-xl text-xs font-extrabold cursor-pointer">
                Guardar Proveedor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CAMBIO DE CONTRASEÑA */}
      {matrizCambioPass && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-5 max-w-md w-full space-y-4 animate-modal">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[#66FF00]">Cambiar Contraseña de Matriz</h3>
              <button onClick={() => setMatrizCambioPass(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-300">Cuenta: {matrizCambioPass.correo}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevaPass}
                onChange={(e) => setNuevaPass(e.target.value)}
                className="flex-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white"
              />
              <button
                onClick={guardarNuevaPassMatriz}
                className="px-4 py-2 bg-[#66FF00] text-black font-bold rounded-xl text-xs cursor-pointer"
              >
                Actualizar
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pt-2 border-t border-[#1E331A]">
              <p className="text-xs font-semibold text-gray-400">
                Clientes activos en esta matriz ({clientesAfectados.length}):
              </p>
              {clientesAfectados.map((c) => {
                const msg = `Hola ${c.nombre_cliente}, se actualizó la contraseña de tu cuenta *${c.plataforma}*.\n📧 Correo: ${c.correo_cuenta}\n🔑 Nueva Contraseña: ${nuevaPass}\n👤 Perfil: ${c.nombre_perfil} (PIN: ${c.pin_perfil || "Sin PIN"})`;
                return (
                  <div key={c.id} className="flex justify-between items-center bg-[#070B06] p-2 rounded-xl text-xs">
                    <div>
                      <p className="font-bold">{c.nombre_cliente}</p>
                      <p className="text-gray-400">{c.telefono_cliente} · {c.nombre_perfil}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg);
                          notificar("Aviso copiado al portapapeles");
                        }}
                        className="p-1.5 bg-[#1A2B18] text-[#66FF00] rounded-lg"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({ text: msg });
                          } else {
                            window.open(`https://wa.me/${c.telefono_cliente.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                          }
                        }}
                        className="p-1.5 bg-[#66FF00] text-black rounded-lg font-bold"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}