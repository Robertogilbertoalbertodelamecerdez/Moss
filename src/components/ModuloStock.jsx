"use client";
import React, { useState, useEffect } from "react";
import { supabase, PLATAFORMAS, formatearFechaDMA } from "@/config";
import { extraerDatosProveedor } from "@/utils/extractorProveedor";
import {
  generarMensajeCambioCredencial,
  generarMensajeEntrega,
  enviarWhatsappDirecto
} from "@/utils/mensajesMoss";
import {
  KeyRound,
  AlertTriangle,
  Edit3,
  X,
  Copy,
  Layers,
  Search,
  User,
  UserCheck,
  UserX,
  Send,
  RefreshCcw,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";

export default function ModuloStock({
  esSuperAdmin = true,
  adminKeyActual = "admin",
  subAdmins = [],
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

  // Pestaña para que Mateus vea sus propias matrices o las matrices creadas por Marcus/Sub-Admins en otro apartado
  const [vistaPropietarioStock, setVistaPropietarioStock] = useState(adminKeyActual);

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

  const [matrizReemplazarCompleta, setMatrizReemplazarCompleta] = useState(null);
  const [nuevoCorreoMatrizReemp, setNuevoCorreoMatrizReemp] = useState("");
  const [nuevaPassMatrizReemp, setNuevaPassMatrizReemp] = useState("");
  const [textoCrudoMatrizReemp, setTextoCrudoMatrizReemp] = useState("");

  const [perfilModal, setPerfilModal] = useState(null);
  const [nombrePerfilEdit, setNombrePerfilEdit] = useState("");
  const [pinPerfilEdit, setPinPerfilEdit] = useState("");
  const [passMatrizEnPerfilEdit, setPassMatrizEnPerfilEdit] = useState("");

  const [modoReemplazoEnPersonita, setModoReemplazoEnPersonita] = useState(false);
  const [origenReempPersonita, setOrigenReempPersonita] = useState("stock");
  const [matrizDestinoReempId, setMatrizDestinoReempId] = useState("");
  const [correoProvReempPersonita, setCorreoProvReempPersonita] = useState("");
  const [passProvReempPersonita, setPassProvReempPersonita] = useState("");
  const [perfilProvReempPersonita, setPerfilProvReempPersonita] = useState("");
  const [pinProvReempPersonita, setPinProvReempPersonita] = useState("");

  const [mensajeReemplazoListo, setMensajeReemplazoListo] = useState(null);

  useEffect(() => {
    setFechaCompra(new Date().toISOString().split("T")[0]);
  }, []);

  const abrirModalPersonita = (perfil, matriz, subOcupante) => {
    setPerfilModal({ perfil, matriz, subOcupante });
    setNombrePerfilEdit(perfil.nombre_perfil || "");
    setPinPerfilEdit(perfil.pin || "");
    setPassMatrizEnPerfilEdit(matriz.password || "");
    setModoReemplazoEnPersonita(false);
    setCorreoProvReempPersonita("");
    setPassProvReempPersonita("");
    setPerfilProvReempPersonita(perfil.nombre_perfil || "1 Dispositivo");
    setPinProvReempPersonita("");
  };

  const ejecutarReemplazoDesdePersonita = async () => {
    if (!perfilModal?.subOcupante) return;
    const sub = perfilModal.subOcupante;

    let nuevosDatos = {
      estado: "Activa",
      fue_reemplazada: true,
      fecha_corte: sub.fecha_corte,
      fecha_venta: sub.fecha_venta,
      dias_totales: sub.dias_totales,
      meses_contratados: sub.meses_contratados,
      precio_venta: sub.precio_venta
    };

    if (origenReempPersonita === "stock") {
      const mat = matrices.find((m) => m.id === matrizDestinoReempId);
      if (!mat) return notificar("Selecciona la matriz de destino", "error");
      const libres = (mat.perfiles_matriz || [])
        .filter((p) => !p.ocupado && !p.caido)
        .sort((a, b) => a.numero_slot - b.numero_slot);
      const slot = libres[0];
      if (!slot) return notificar("Esa matriz no tiene perfiles libres", "error");

      await supabase
        .from("perfiles_matriz")
        .update({ ocupado: false, caido: true })
        .eq("id", perfilModal.perfil.id);
      await supabase
        .from("perfiles_matriz")
        .update({ ocupado: true, caido: false })
        .eq("id", slot.id);

      nuevosDatos = {
        ...nuevosDatos,
        origen: "stock",
        matriz_id: mat.id,
        perfil_id: slot.id,
        correo_cuenta: mat.correo,
        password_cuenta: mat.password,
        nombre_perfil: slot.nombre_perfil,
        pin_perfil: slot.pin
      };
    } else {
      if (!correoProvReempPersonita.trim()) return notificar("Escribe el correo de reemplazo", "error");
      await supabase
        .from("perfiles_matriz")
        .update({ ocupado: false, caido: true })
        .eq("id", perfilModal.perfil.id);

      nuevosDatos = {
        ...nuevosDatos,
        origen: "proveedor",
        matriz_id: null,
        perfil_id: null,
        correo_cuenta: correoProvReempPersonita.trim(),
        password_cuenta: passProvReempPersonita.trim(),
        nombre_perfil: perfilProvReempPersonita.trim() || "1 Dispositivo",
        pin_perfil: pinProvReempPersonita.trim()
      };
    }

    const { data: actualizada, error } = await supabase
      .from("suscripciones")
      .update(nuevosDatos)
      .eq("id", sub.id)
      .select()
      .single();

    if (error) return notificar("Error: " + error.message, "error");

    const msg = generarMensajeEntrega(
      actualizada.nombre_cliente,
      actualizada.telefono_cliente,
      [
        {
          plataforma: actualizada.plataforma,
          tipoCuenta: actualizada.tipo_cuenta || "1 Dispositivo",
          correoFinal: actualizada.correo_cuenta,
          passFinal: actualizada.password_cuenta,
          perfilFinal: actualizada.nombre_perfil,
          pinFinal: actualizada.pin_perfil,
          meses: actualizada.meses_contratados || 1,
          diasTotales: actualizada.dias_totales || 30,
          fechaCorte: actualizada.fecha_corte,
          precioVenta: actualizada.precio_venta
        }
      ],
      "",
      "REEMPLAZO DE CUENTA",
      actualizada.tipo_comprador === "revendedor"
    );

    setPerfilModal(null);
    setMensajeReemplazoListo(msg);
    await recargarTodo();
    notificar("¡Cliente reemplazado y marcado como Reemplazo!");
  };

  const ejecutarReemplazoMatrizCompleta = async (e) => {
    e.preventDefault();
    if (!matrizReemplazarCompleta || !nuevoCorreoMatrizReemp.trim()) {
      return notificar("Ingresa el nuevo correo para la matriz", "error");
    }

    await supabase
      .from("matrices_stock")
      .update({
        correo: nuevoCorreoMatrizReemp.trim(),
        password: nuevaPassMatrizReemp.trim(),
        estado: "Activa"
      })
      .eq("id", matrizReemplazarCompleta.id);

    await supabase
      .from("perfiles_matriz")
      .update({ caido: false })
      .eq("matriz_id", matrizReemplazarCompleta.id);

    await supabase
      .from("suscripciones")
      .update({
        correo_cuenta: nuevoCorreoMatrizReemp.trim(),
        password_cuenta: nuevaPassMatrizReemp.trim(),
        fue_reemplazada: true,
        estado: "Activa"
      })
      .eq("matriz_id", matrizReemplazarCompleta.id)
      .in("estado", ["Activa", "Caida"]);

    setMatrizReemplazarCompleta(null);
    await recargarTodo();
    notificar("¡Matriz reemplazada!");
  };

  const guardarEdicionPerfilModal = async (e) => {
    e.preventDefault();
    if (!perfilModal) return;

    await supabase
      .from("perfiles_matriz")
      .update({
        pin: pinPerfilEdit.trim(),
        nombre_perfil: nombrePerfilEdit.trim()
      })
      .eq("id", perfilModal.perfil.id);

    await supabase
      .from("suscripciones")
      .update({
        pin_perfil: pinPerfilEdit.trim(),
        nombre_perfil: nombrePerfilEdit.trim()
      })
      .eq("perfil_id", perfilModal.perfil.id)
      .eq("estado", "Activa");

    if (passMatrizEnPerfilEdit.trim() !== (perfilModal.matriz.password || "")) {
      await supabase
        .from("matrices_stock")
        .update({ password: passMatrizEnPerfilEdit.trim() })
        .eq("id", perfilModal.matriz.id);

      await supabase
        .from("suscripciones")
        .update({ password_cuenta: passMatrizEnPerfilEdit.trim() })
        .eq("matriz_id", perfilModal.matriz.id)
        .eq("estado", "Activa");
    }

    await recargarTodo();
    notificar("Datos guardados");
  };

  const guardarNuevoProveedor = async (e) => {
    e.preventDefault();
    if (!nuevoProvNombre.trim() || !nuevoProvTelefono.trim()) {
      return notificar("Completa nombre y teléfono", "error");
    }
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
    notificar("Proveedor registrado y compartido");
  };

  const handleSelectPlataforma = (nombrePlat) => {
    setPlataforma(nombrePlat);
    const found = plataformasList.find((p) => p.nombre === nombrePlat);
    if (found) setCapacidad(found.perfilesDefault || 5);
  };

  const procesarTextoMatriz = (texto) => {
    setTextoProveedorMatriz(texto);
    const extraido = extraerDatosProveedor(texto, plataformasList);
    if (extraido.correo) setCorreo(extraido.correo);
    if (extraido.password) setPassword(extraido.password);
    notificar("Correo y clave extraídos");
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
          admin_propietario: adminKeyActual,
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
          admin_propietario: adminKeyActual,
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
      notificar("Matriz creada en tu Stock");
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
    notificar("Contraseña actualizada en toda la matriz");
  };

  const marcarMatrizCaida = async (matriz) => {
    const nuevoEstado = matriz.estado === "Caida" ? "Activa" : "Caida";
    await supabase.from("matrices_stock").update({ estado: nuevoEstado }).eq("id", matriz.id);
    if (nuevoEstado === "Caida") {
      await supabase.from("suscripciones").update({ estado: "Caida" }).eq("matriz_id", matriz.id).eq("estado", "Activa");
    } else {
      await supabase.from("perfiles_matriz").update({ caido: false }).eq("matriz_id", matriz.id);
    }
    await recargarTodo();
    notificar(nuevoEstado === "Caida" ? "Matriz marcada como Caída" : "Matriz resuelta");
  };

  const calcularDiasRestantes = (fechaCorte) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const corte = new Date(fechaCorte + "T00:00:00");
    return Math.ceil((corte - hoy) / (1000 * 60 * 60 * 24));
  };

  // Filtra las matrices según el apartado elegido (Mis Matrices vs Matrices de Marcus/Sub-Admins)
  const matricesActivas = matrices.filter((m) => {
    if (m.en_papelera) return false;
    const owner = m.admin_propietario || "admin";
    if (esSuperAdmin) {
      return owner === vistaPropietarioStock;
    }
    // Marcus ve sus propias matrices y también las de Mateus para poder vender o gestionar
    return vistaPropietarioStock === "todas" ? true : owner === vistaPropietarioStock;
  });

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
      {/* BARRA DE APARTADOS DE STOCK: MIS MATRICES (MATEUS) VS MATRICES DE MARCUS */}
      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#66FF00]" /> Apartado de Matrices:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVistaPropietarioStock("admin")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
              vistaPropietarioStock === "admin"
                ? "bg-[#66FF00] text-black border-[#66FF00]"
                : "bg-[#070B06] text-gray-300 border-[#2A4226]"
            }`}
          >
            📦 Matrices de Mateus ({matrices.filter((m) => !m.en_papelera && (m.admin_propietario || "admin") === "admin").length})
          </button>

          {subAdmins.map((sa) => (
            <button
              key={sa.id}
              type="button"
              onClick={() => setVistaPropietarioStock(sa.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                vistaPropietarioStock === sa.id
                  ? "bg-amber-400 text-black border-amber-400"
                  : "bg-[#070B06] text-amber-300 border-amber-500/40"
              }`}
            >
              🤝 Matrices de {sa.nombre} ({matrices.filter((m) => !m.en_papelera && m.admin_propietario === sa.id).length})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#162914] to-[#0E180D] border border-[#66FF00]/40 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#66FF00]" /> Matrices en este Apartado ({matricesActivas.length})
          </h2>
          <p className="text-xs text-gray-300">
            Proveedores sincronizados. Toca cualquier personita para ver datos, cambiar PIN o dar reemplazo.
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

      <div className="bg-[#111A10] border border-[#233820] rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#66FF00] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar matriz por teléfono, cliente, correo o proveedor..."
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matricesFiltradas.map((matriz) => {
          const perfiles = (matriz.perfiles_matriz || []).sort((a, b) => a.numero_slot - b.numero_slot);
          const libres = perfiles.filter((p) => !p.ocupado && !p.caido).length;
          const diasVida = calcularDiasRestantes(matriz.fecha_corte_matriz);

          return (
            <div
              key={matriz.id}
              className={`bg-[#111A10] border rounded-2xl p-4 space-y-3 ${
                matriz.estado === "Caida" ? "border-2 border-red-500 bg-red-950/15" : "border-[#233820]"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#66FF00]/20 text-[#66FF00]">
                    {matriz.plataforma}
                  </span>
                  {matriz.nombre_proveedor && (
                    <span className="ml-2 px-2 py-0.5 text-[10px] rounded bg-gray-800 text-gray-300">
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#1E331A]">
                {perfiles.map((p) => {
                  const subOcupante = suscripciones.find(
                    (s) => s.perfil_id === p.id && !s.en_papelera && s.estado !== "Reembolsada"
                  );

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => abrirModalPersonita(p, matriz, subOcupante)}
                      className={`p-2.5 rounded-2xl border text-left transition flex items-center gap-2 cursor-pointer ${
                        p.caido
                          ? "bg-red-950/60 border-red-500"
                          : p.ocupado
                          ? "bg-[#070B06] border-[#2A4226] hover:border-[#66FF00]"
                          : "bg-[#142412] border-[#66FF00]/40 hover:border-[#66FF00]"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                          p.caido
                            ? "bg-red-900/70 border-red-400 text-red-200"
                            : p.ocupado
                            ? "bg-orange-500/15 border-orange-400/50 text-orange-300"
                            : "bg-[#66FF00]/20 border-[#66FF00] text-[#66FF00]"
                        }`}
                      >
                        {p.caido ? <UserX className="w-4 h-4" /> : p.ocupado ? <UserCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-white truncate">
                          {p.nombre_perfil} {p.pin ? <span className="text-[#66FF00] font-mono">(PIN {p.pin})</span> : ""}
                        </p>
                        {p.caido ? (
                          <p className="text-[10px] text-red-400 font-extrabold">⚠️ Caído (Reemplazar)</p>
                        ) : p.ocupado && subOcupante ? (
                          <>
                            <p className="text-[10px] text-orange-300 font-bold truncate">
                              {subOcupante.nombre_cliente}
                            </p>
                            <p className="text-[10px] text-[#66FF00] font-mono truncate">
                              📞 {subOcupante.telefono_cliente}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-[#66FF00] font-semibold">● Libre</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1E331A]">
                <button
                  onClick={() => {
                    setMatrizCambioPass(matriz);
                    setNuevaPass(matriz.password);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-extrabold text-white flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Cambiar Clave / Aviso
                </button>

                <button
                  onClick={() => {
                    setMatrizReemplazarCompleta(matriz);
                    setNuevoCorreoMatrizReemp(matriz.correo);
                    setNuevaPassMatrizReemp(matriz.password);
                    setTextoCrudoMatrizReemp("");
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-black text-black flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> 🔄 Dar Reemplazo Matriz
                </button>

                <button
                  onClick={() => setMatrizEditar(matriz)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1A2B18] text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#66FF00]" /> Editar
                </button>

                <button
                  onClick={() => marcarMatrizCaida(matriz)}
                  className="px-2.5 py-1.5 rounded-lg bg-red-950/60 text-xs text-red-300 border border-red-800/50 flex items-center gap-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {matriz.estado === "Caida" ? "Quitar Caída" : "Marcar Caída"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL REEMPLAZAR MATRIZ COMPLETA */}
      {matrizReemplazarCompleta && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={ejecutarReemplazoMatrizCompleta}
            className="bg-[#111A10] border-2 border-amber-400 rounded-3xl p-6 max-w-md w-full space-y-4 animate-modal"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-amber-400 text-base">
                🔄 Reemplazar Matriz {matrizReemplazarCompleta.plataforma}
              </h3>
              <button type="button" onClick={() => setMatrizReemplazarCompleta(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              rows={2}
              placeholder="Pegar mensaje del proveedor para autocompletar..."
              value={textoCrudoMatrizReemp}
              onChange={(e) => {
                setTextoCrudoMatrizReemp(e.target.value);
                const ext = extraerDatosProveedor(e.target.value, plataformasList);
                if (ext.correo) setNuevoCorreoMatrizReemp(ext.correo);
                if (ext.password) setNuevaPassMatrizReemp(ext.password);
              }}
              className="w-full bg-[#070B06] border border-[#233820] rounded-xl p-2 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Nuevo Correo de la Matriz *"
              value={nuevoCorreoMatrizReemp}
              onChange={(e) => setNuevoCorreoMatrizReemp(e.target.value)}
              className="w-full bg-[#070B06] border border-amber-400 rounded-xl p-2.5 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Nueva Contraseña *"
              value={nuevaPassMatrizReemp}
              onChange={(e) => setNuevaPassMatrizReemp(e.target.value)}
              className="w-full bg-[#070B06] border border-amber-400 rounded-xl p-2.5 text-xs text-white"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setMatrizReemplazarCompleta(null)} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-amber-400 text-black rounded-xl text-xs font-black cursor-pointer">
                Confirmar Reemplazo de Matriz
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE PERSONITA */}
      {perfilModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-[#233820] pb-3">
              <div>
                <h3 className="font-black text-[#66FF00] text-base">
                  {perfilModal.matriz.plataforma} — {perfilModal.perfil.nombre_perfil}
                </h3>
                <p className="text-[11px] text-gray-400">{perfilModal.matriz.correo}</p>
              </div>
              <button onClick={() => setPerfilModal(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#070B06] border border-[#233820] rounded-2xl p-3.5 space-y-2">
              {perfilModal.subOcupante ? (
                <>
                  <p className="text-sm font-black text-white">
                    {perfilModal.subOcupante.nombre_cliente} ({perfilModal.subOcupante.tipo_comprador === "revendedor" ? "🤝 Revendedor" : "👤 Cliente"})
                  </p>
                  <p className="text-xs text-[#66FF00] font-mono">
                    📞 {perfilModal.subOcupante.telefono_cliente} · Vence: {formatearFechaDMA(perfilModal.subOcupante.fecha_corte)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setModoReemplazoEnPersonita(!modoReemplazoEnPersonita)}
                    className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-black font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCcw className="w-4 h-4" /> 🔄 Dar Reemplazo a este Cliente
                  </button>
                </>
              ) : (
                <p className="text-xs text-[#66FF00] font-semibold">● Perfil libre (PIN: {pinPerfilEdit})</p>
              )}
            </div>

            {modoReemplazoEnPersonita && perfilModal.subOcupante ? (
              <div className="bg-[#0B120A] border-2 border-amber-400 rounded-2xl p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrigenReempPersonita("stock")}
                    className={`py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      origenReempPersonita === "stock"
                        ? "bg-[#66FF00] text-black border-[#66FF00]"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Otra Matriz (Stock)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrigenReempPersonita("proveedor")}
                    className={`py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      origenReempPersonita === "proveedor"
                        ? "bg-amber-400 text-black border-amber-400"
                        : "bg-[#070B06] text-gray-300 border-[#2A4226]"
                    }`}
                  >
                    Proveedor (A Mano)
                  </button>
                </div>

                {origenReempPersonita === "stock" ? (
                  <select
                    value={matrizDestinoReempId}
                    onChange={(e) => setMatrizDestinoReempId(e.target.value)}
                    className="w-full bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white"
                  >
                    <option value="">-- Seleccionar Matriz con cupo libre --</option>
                    {matrices
                      .filter(
                        (m) =>
                          !m.en_papelera &&
                          m.estado === "Activa" &&
                          (m.perfiles_matriz || []).some((p) => !p.ocupado && !p.caido)
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.plataforma} — {m.correo}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nuevo Correo *"
                      value={correoProvReempPersonita}
                      onChange={(e) => setCorreoProvReempPersonita(e.target.value)}
                      className="bg-[#070B06] border border-amber-400 rounded-lg p-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Nueva Clave"
                      value={passProvReempPersonita}
                      onChange={(e) => setPassProvReempPersonita(e.target.value)}
                      className="bg-[#070B06] border border-amber-400 rounded-lg p-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Perfil"
                      value={perfilProvReempPersonita}
                      onChange={(e) => setPerfilProvReempPersonita(e.target.value)}
                      className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="PIN"
                      value={pinProvReempPersonita}
                      onChange={(e) => setPinProvReempPersonita(e.target.value)}
                      className="bg-[#070B06] border border-[#2A4226] rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={ejecutarReemplazoDesdePersonita}
                  className="w-full py-2.5 bg-amber-400 text-black font-black rounded-xl text-xs cursor-pointer"
                >
                  Confirmar Reemplazo y Obtener Mensaje
                </button>
              </div>
            ) : (
              <form onSubmit={guardarEdicionPerfilModal} className="space-y-3">
                <div>
                  <label className="text-xs text-purple-300 font-bold">Contraseña de la Matriz:</label>
                  <input
                    type="text"
                    value={passMatrizEnPerfilEdit}
                    onChange={(e) => setPassMatrizEnPerfilEdit(e.target.value)}
                    className="w-full mt-1 bg-[#070B06] border border-purple-500 rounded-xl p-2 text-xs text-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Nombre Perfil</label>
                    <input
                      type="text"
                      value={nombrePerfilEdit}
                      onChange={(e) => setNombrePerfilEdit(e.target.value)}
                      className="w-full mt-1 bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#66FF00] font-bold">📌 PIN del Perfil</label>
                    <input
                      type="text"
                      value={pinPerfilEdit}
                      onChange={(e) => setPinPerfilEdit(e.target.value)}
                      className="w-full mt-1 bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-xs text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full py-2.5 bg-[#66FF00] text-black font-black rounded-xl text-xs cursor-pointer">
                  Guardar Cambios (Clave / Perfil / PIN)
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-[#1E331A] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const telRev =
                      perfilModal.subOcupante?.tipo_comprador === "revendedor"
                        ? perfilModal.subOcupante.telefono_cliente
                        : "";
                    const msg = generarMensajeCambioCredencial(
                      "Contraseña de la cuenta",
                      perfilModal.matriz.plataforma,
                      perfilModal.matriz.correo,
                      passMatrizEnPerfilEdit,
                      nombrePerfilEdit,
                      pinPerfilEdit,
                      telRev
                    );
                    navigator.clipboard.writeText(msg);
                    notificar("¡Aviso de Contraseña copiado!");
                  }}
                  className="py-2.5 px-2 bg-purple-600 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Copiar Aviso Clave
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const telRev =
                      perfilModal.subOcupante?.tipo_comprador === "revendedor"
                        ? perfilModal.subOcupante.telefono_cliente
                        : "";
                    const msg = generarMensajeCambioCredencial(
                      "Contraseña de la cuenta",
                      perfilModal.matriz.plataforma,
                      perfilModal.matriz.correo,
                      passMatrizEnPerfilEdit,
                      nombrePerfilEdit,
                      pinPerfilEdit,
                      telRev
                    );
                    enviarWhatsappDirecto(perfilModal.subOcupante?.telefono_cliente || "", msg);
                  }}
                  className="py-2.5 px-2 bg-[#66FF00] text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Enviar Clave WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MENSAJE DE REEMPLAZO LISTO */}
      {mensajeReemplazoListo && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-[#66FF00] rounded-3xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#66FF00] font-black text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Reemplazo para {mensajeReemplazoListo.cliente}
              </h3>
              <button onClick={() => setMensajeReemplazoListo(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              readOnly
              rows={9}
              value={mensajeReemplazoListo.completo}
              className="w-full bg-[#070B06] border border-[#2A4226] rounded-2xl p-3 text-xs text-gray-200 font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mensajeReemplazoListo.completo);
                  notificar("¡Mensaje copiado!");
                }}
                className="py-3 bg-[#1A2B18] text-[#66FF00] border border-[#66FF00]/50 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Copiar Mensaje
              </button>
              <button
                onClick={() => enviarWhatsappDirecto(mensajeReemplazoListo.telefono, mensajeReemplazoListo.completo)}
                className="py-3 bg-[#66FF00] text-black rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" /> 📲 Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAMBIO DE CLAVE GENERAL */}
      {matrizCambioPass && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111A10] border-2 border-purple-500 rounded-3xl p-5 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-purple-300">Cambiar Contraseña y Enviar Aviso</h3>
              <button onClick={() => setMatrizCambioPass(null)} className="text-gray-400">
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
          </div>
        </div>
      )}

      {/* MODAL EDITAR MATRIZ */}
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
            <textarea rows={2} placeholder="Pega aquí mensaje del proveedor..." value={textoProveedorMatriz} onChange={(e) => procesarTextoMatriz(e.target.value)} className="w-full bg-[#070B06] border border-[#233820] rounded-lg p-2 text-xs text-white" />
            <div className="grid grid-cols-2 gap-2">
              <select value={plataforma} onChange={(e) => handleSelectPlataforma(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs">
                {plataformasList.map((p) => (<option key={p.nombre} value={p.nombre}>{p.nombre}</option>))}
              </select>
              <input type="number" step="0.01" placeholder="Costo Total (Bs)" value={costoTotal} onChange={(e) => setCostoTotal(e.target.value)} className="bg-[#070B06] border border-[#66FF00] rounded-xl p-2 text-white text-xs font-bold" />
              <input type="text" placeholder="Correo *" value={correo} onChange={(e) => setCorreo(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-white text-xs" />
              <input type="text" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[#070B06] border border-[#2A4226] rounded-xl p-2 text-xs text-white" />
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
            <h3 className="font-black text-[#66FF00]">Registrar Proveedor Compartido</h3>
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