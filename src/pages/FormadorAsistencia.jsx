// src/pages/FormadorPage.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";

// Opciones para los campos de asistencia (día 1-6)
const OPCIONES_ASISTENCIA = [
  "ASISTIÓ", "FALTA", "DESERTÓ", "TARDANZA", "NO SE PRESENTÓ", "RETIRADO", "NO APROBO ROLE PLAY"
];

// Opciones para segmento y certificación
const OPCIONES_SEGMENTO = ["A", "B", "C"];
const OPCIONES_CERTIFICA = ["SI", "NO"];

// Opciones para motivo de baja (agrupadas)
const OPCIONES_MOTIVO_BAJA = {
  "← DESERCIÓN →": [
    "DISTANCIA AL SITE", "ENFERMEDAD FAMILIAR", "ENFERMEDAD PROPIA", "HORARIOS",
    "MEJOR OFERTA LABORAL", "MOTIVOS PERSONALES - NO ESPECIFICA",
    "NO LE GUSTA EL PRODUCTO", "NO ES LO QUE DESEA", "SIN RESPUESTA"
  ],
  "← RETIRO →": [
    "USUARIOS BLOQUEADOS", "NO TIENE HABILIDAD COMERCIAL",
    "PROBLEMAS DE ACTITUD", "BLACK LIST SALESLAND"
  ]
};

// ──────────────────────────────────────────────────────────────────────────────
// CAMPOS EDITABLES EN EL MODAL DE EDICIÓN MASIVA
// ❌ NO EDITABLES: usuario (DNI), nombre, fecha_ingreso, celular, correo
// ✅ EDITABLES: Todos los demás campos de la tabla usuarios
// ──────────────────────────────────────────────────────────────────────────────
const BULK_FIELDS = [
  { key: 'rol', label: 'Rol', type: 'select', options: ['usuario', 'Formador', 'Administrador'] },
  { key: 'estado', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo'] },
  { key: 'grupo_nombre', label: 'Grupo', type: 'text' },
  { key: 'qr_id', label: 'QR ID', type: 'text' },
  { key: 'segmento_prefiltro', label: 'Segmento Prefiltro', type: 'select', options: OPCIONES_SEGMENTO },
  { key: 'certifica', label: 'Certifica', type: 'select', options: OPCIONES_CERTIFICA },
  { key: 'segmento_certificado', label: 'Segmento Certificado', type: 'select', options: OPCIONES_SEGMENTO },
  { key: 'fecha_baja', label: 'Fecha Baja', type: 'date' },
  { key: 'motivo_baja', label: 'Motivo Baja', type: 'motivo_baja' },
  // Días 1-6 de asistencia
  ...[1,2,3,4,5,6].map(d => ({
    key: `dia_${d}`,
    label: `Día ${d}`,
    type: 'select',
    options: OPCIONES_ASISTENCIA
  }))
];

export default function FormadorPage({ user, onLogout }) {
  // Estados principales del componente
  const [campañas, setCampañas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [seleccion, setSeleccion] = useState({ campana_id: "", dia: "", grupo_id: "", curso_id: "" });
  const [activos, setActivos] = useState([]);
  const [gruposConCursos, setGruposConCursos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [filtroGrupoActivo, setFiltroGrupoActivo] = useState("todos");
  
  // Estados para Dotación
  const [usuariosDotacion, setUsuariosDotacion] = useState([]);
  const [gruposDisponibles, setGruposDisponibles] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const REGISTROS_POR_PAGINA = 10;
  
  // Estados para edición por fila individual
  const [filaEditando, setFilaEditando] = useState(null);
  const [valoresEditables, setValoresEditables] = useState({});
  
  // ──────────────────────────────────────────────────────────────────────────────
  // ESTADOS PARA EDICIÓN MASIVA CON MODAL
  // ──────────────────────────────────────────────────────────────────────────────
  const [selectedItems, setSelectedItems] = useState([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(() =>
    Object.fromEntries(BULK_FIELDS.map(f => [f.key, '']))
  );
  const [bulkApply, setBulkApply] = useState(() =>
    Object.fromEntries(BULK_FIELDS.map(f => [f.key, false]))
  );
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  
  // Estados para QR
  const [escaneandoQR, setEscaneandoQR] = useState(false);
  const [mensajeQR, setMensajeQR] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // Estado para malla de capacitación
  const [mallaActiva, setMallaActiva] = useState("Portabilidad");
  const fechaHoy = new Date().toISOString().split("T")[0];
  const fechaHoyFormateada = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // MALLAS DE CAPACITACIÓN
  const mallasDeCapacitacion = {
    Portabilidad: [
      ["Espera Grupal", "00:30:00", "REPASO DÍA 1", "00:30:00", "REPASO DÍA 3", "00:30:00", "NEXUM Y CRM", "00:30:00"],
      ["Charla Selección", "01:30:00", "DINAMICA 2", "00:30:00", "DINAMICA 3", "01:00:00", "TALLER DE TIPIFICACIONES", "01:00:00"],
      ["Consulta RUC - Examen Psicológico", "00:30:00", "DIRECCIONES", "00:30:00", "ESTRUCTURA DE LLAMADA", "01:00:00", "REPASO GENERAL", "00:30:00"],
      ["Presentación General", "00:20:00", "PROCESO DELIVERY", "01:00:00", "TALLER DE SPEECH DE VENTA", "01:00:00", "EXAMEN FINAL", "00:30:00"],
      ["DÍNAMICA 1 - Rompe Hielo", "00:30:00", "Examen 2", "00:30:00", "TALLER DE ARGUMENTACIÓN", "00:30:00", "BREAK", "00:30:00"],
      ["Charla ISO", "00:30:00", "CICLO DE FACTURACION", "01:00:00", "BREAK", "00:30:00", "CHARLA DE CALIDAD", "01:00:00"],
      ["Examen ISO", "00:20:00", "BREAK", "00:30:00", "TALLER DE MANEJO DE OBJECIONES", "01:00:00", "CHARLA DE BACKOFFICE", "01:00:00"],
      ["Break", "00:30:00", "EXAMEN PRÁCTICO CICLOS DE FACTURACIÓN", "01:00:00", "APLICATIVOS DE GESTIÓN", "01:00:00", "ROLL PLAY FINAL", "02:00:00"],
      ["Producto Portabilidad", "01:50:00", "DITO - APP", "01:00:00", "EXAMEN 3 APLICATIVOS DE GESTIÓN", "00:30:00", "", ""],
      ["Examen 1", "00:30:00", "Examen 4", "00:30:00", "", "", "", ""],
    ],
    Blindaje: [
      ["Bienvenida y Normas", "00:30:00", "Repaso Día 1", "00:30:00", "Repaso Día 3", "00:30:00", "CRM Básico", "00:30:00"],
      ["Charla de Seguridad", "01:00:00", "Dinámica 2", "00:30:00", "Dinámica 3", "01:00:00", "Taller de Tipificaciones", "01:00:00"],
      ["Consulta RUC - Examen Psicológico", "00:30:00", "Direcciones", "00:30:00", "Estructura de Llamada", "01:00:00", "Repaso General", "00:30:00"],
      ["Presentación General", "00:20:00", "Proceso de Blindaje", "01:00:00", "Taller de Speech de Venta", "01:00:00", "Examen Final", "00:30:00"],
      ["Dinámica 1 - Rompe Hielo", "00:30:00", "Examen 2", "00:30:00", "Taller de Argumentación", "00:30:00", "Break", "00:30:00"],
      ["Charla ISO", "00:30:00", "Ciclo de Facturación", "01:00:00", "Break", "00:30:00", "Charla de Calidad", "01:00:00"],
      ["Examen ISO", "00:20:00", "Break", "00:30:00", "Taller de Manejo de Objeciones", "01:00:00", "Charla de Backoffice", "01:00:00"],
      ["Break", "00:30:00", "Examen Práctico", "01:00:00", "Aplicativos de Gestión", "01:00:00", "Roll Play Final", "02:00:00"],
      ["Producto Blindaje", "01:50:00", "App Blindaje", "01:00:00", "Examen 3 Aplicativos", "00:30:00", "", ""],
      ["Examen 1", "00:30:00", "Examen 4", "00:30:00", "", "", "", ""],
    ],
  };

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
    cargarUsuariosDotacion();
  }, []);

  // Mostrar mensaje temporal
  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  // Cargar datos generales
  const cargarDatos = async () => {
    setLoading(true);
    try {
      await Promise.all([cargarCampañas(), cargarActivos()]);
    } catch (err) {
      console.error("Error en la carga general:", err);
      mostrarMensaje("error", "Error al cargar datos iniciales");
    } finally {
      setLoading(false);
    }
  };

  // Cargar campañas
  const cargarCampañas = async () => {
    try {
      const { data, error } = await supabase.from("campañas").select("*");
      if (error) throw error;
      setCampañas(data || []);
    } catch (error) {
      console.error("Error al cargar campañas:", error);
      mostrarMensaje("error", "Error al cargar campañas");
    }
  };

  // Cargar grupos por campaña
  const cargarGrupos = async (campana_id) => {
    if (!campana_id) return;
    setLoading(true);
    try {
      const { data: gruposData, error } = await supabase
        .from("grupos").select("*").eq("campana_id", campana_id);
      if (error) throw error;
      const gruposConConteo = await Promise.all(
        (gruposData || []).map(async (g) => {
          try {
            const { count } = await supabase
              .from("usuarios")
              .select("*", { count: "exact", head: true })
              .eq("grupo_nombre", g.nombre)
              .eq("rol", "usuario")
              .eq("estado", "Activo");
            return { ...g, activos: count || 0, id: Number(g.id), nombre: String(g.nombre || "").trim() };
          } catch {
            return { ...g, activos: 0, id: Number(g.id), nombre: String(g.nombre || "").trim() };
          }
        })
      );
      setGrupos(gruposConConteo);
    } catch (err) {
      console.error("Error al cargar grupos:", err);
      mostrarMensaje("error", "Error al cargar grupos");
    } finally {
      setLoading(false);
    }
  };

  // Cargar cursos
  const cargarCursos = async (campana_id, dia, grupo_id) => {
    if (!campana_id || !dia || !grupo_id) return;
    setLoading(true);
    try {
      let query = supabase.from("cursos").select("*")
        .eq("campana_id", campana_id).eq("dia", dia).eq("estado", "Activo");
      if (grupo_id) {
        const grupoIdNum = Number(grupo_id);
        if (!isNaN(grupoIdNum)) query = query.or(`grupo_id.is.null,grupo_id.eq.${grupoIdNum}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setCursos(data || []);
    } catch (err) {
      console.error("Error al cargar cursos:", err);
      mostrarMensaje("error", "Error al cargar cursos");
    } finally {
      setLoading(false);
    }
  };

  // Cargar cursos activos
  const cargarActivos = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("cursos_activados")
        .select(`id, curso_id, campana_id, grupo_id, fecha, activo, cursos(titulo, duracion_minutos), grupos(nombre), campañas(nombre)`)
        .eq("formador_id", user.id)
        .order("fecha", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) { setActivos([]); setGruposConCursos([]); return; }
      const activosConConteo = await Promise.all(
        data.map(async (activado) => {
          try {
            const { count } = await supabase
              .from("cursos_asesores")
              .select("*", { count: "exact", head: true })
              .eq("curso_activado_id", activado.id);
            return { ...activado, asesores_count: count || 0 };
          } catch { return { ...activado, asesores_count: 0 }; }
        })
      );
      setActivos(activosConConteo);
      const gruposMap = {};
      activosConConteo.forEach((a) => {
        const grupoId = a.grupo_id;
        if (grupoId) {
          if (!gruposMap[grupoId]) gruposMap[grupoId] = { grupo: a.grupos, cursos: [] };
          gruposMap[grupoId].cursos.push(a);
        }
      });
      setGruposConCursos(Object.values(gruposMap));
    } catch (err) {
      console.error("Error al cargar cursos activos:", err);
      mostrarMensaje("error", "Error al cargar cursos activos");
    }
  };

  // Cargar usuarios de dotación
  const cargarUsuariosDotacion = async () => {
    setLoading(true);
    try {
      const { data: usuarios, error } = await supabase
        .from("usuarios")
        .select(`id, usuario, rol, nombre, estado, grupo_nombre, qr_id, segmento_prefiltro, certifica, segmento_certificado, dia_1, dia_2, dia_3, dia_4, dia_5, dia_6, fecha_baja, motivo_baja`)
        .eq("rol", "usuario")
        .order("nombre", { ascending: true });
      if (error) throw error;
      setUsuariosDotacion(usuarios || []);
      const gruposSet = new Set((usuarios || []).map(u => u.grupo_nombre).filter(g => g && typeof g === 'string'));
      setGruposDisponibles(Array.from(gruposSet).sort());
    } catch (err) {
      console.error("Error al cargar dotación:", err);
      mostrarMensaje("error", "Error al cargar usuarios");
      setUsuariosDotacion([]);
      setGruposDisponibles([]);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // FUNCIONES DE EDICIÓN MASIVA CON MODAL
  // ──────────────────────────────────────────────────────────────────────────────

  // Abrir modal de edición masiva
  const openBulkModal = () => {
    if (selectedItems.length === 0) {
      mostrarMensaje("warning", "⚠️ Selecciona al menos un registro para editar");
      return;
    }
    // Resetear formulario del modal
    setBulkForm(Object.fromEntries(BULK_FIELDS.map(f => [f.key, ''])));
    setBulkApply(Object.fromEntries(BULK_FIELDS.map(f => [f.key, false])));
    setIsBulkModalOpen(true);
  };

  // Cerrar modal
  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setSelectedItems([]);
  };

  // Actualizar valor de campo en el formulario del modal
  const setBulkField = (key, value) => {
    setBulkForm(prev => ({ ...prev, [key]: value }));
  };

  // Toggle checkbox "Aplicar" para un campo
  const toggleBulkApply = (key, checked) => {
    setBulkApply(prev => ({ ...prev, [key]: checked }));
  };

  // Guardar cambios masivos
  const saveBulkModal = async () => {
    // Validar que haya al menos un campo marcado para aplicar
    const camposParaAplicar = Object.entries(bulkApply).filter(([_, v]) => v);
    if (camposParaAplicar.length === 0) {
      mostrarMensaje("warning", "⚠️ Marca 'Aplicar' en al menos un campo para guardar");
      return;
    }

    setIsSavingBulk(true);
    try {
      // 1. Obtener registros actuales para calcular diffs
      const { data: currentRecords, error: fetchError } = await supabase
        .from("usuarios")
        .select("*")
        .in("id", selectedItems);
      if (fetchError) throw fetchError;

      // 2. Construir payload solo con campos marcados como "Aplicar"
      const payload = {};
      BULK_FIELDS.forEach(field => {
        if (bulkApply[field.key]) {
          let value = bulkForm[field.key];
          // Convertir vacío a null para campos que lo permitan
          if (value === '' && ['segmento_prefiltro', 'certifica', 'segmento_certificado', 'fecha_baja', 'motivo_baja', ...[1,2,3,4,5,6].map(d => `dia_${d}`)].includes(field.key)) {
            value = null;
          }
          payload[field.key] = value;
        }
      });

      // 3. Actualizar registros en Supabase
      const { error: updateError } = await supabase
        .from("usuarios")
        .update(payload)
        .in("id", selectedItems);
      if (updateError) throw updateError;

      // 4. Calcular diffs para logging
      const diffs = (currentRecords || []).map(rec => {
        const changes = {};
        Object.keys(payload).forEach(field => {
          const oldValue = rec[field];
          const newValue = payload[field];
          if (oldValue !== newValue) {
            changes[field] = { from: oldValue, to: newValue };
          }
        });
        if (Object.keys(changes).length > 0) {
          return { record_id: rec.id?.substring(0, 8), usuario: rec.usuario, changes };
        }
        return null;
      }).filter(d => d !== null);

      // 5. Registrar log de cambios (opcional, si tienes sistema de logs)
      if (diffs.length > 0 && user?.usuario) {
        // Aquí podrías llamar a tu función de logging si la tienes implementada
        console.log("Cambios aplicados:", { usuario: user.usuario, records: selectedItems.length, diffs });
      }

      // 6. Actualizar estado local y mostrar mensaje de éxito
      setUsuariosDotacion(prev =>
        prev.map(u => selectedItems.includes(u.id) ? { ...u, ...payload } : u)
      );
      
      mostrarMensaje("success", `✅ Cambios aplicados a ${selectedItems.length} registro(s)`);
      closeBulkModal();
      await cargarUsuariosDotacion(); // Recargar para asegurar consistencia

    } catch (err) {
      console.error("Error en edición masiva:", err);
      mostrarMensaje("error", `❌ Error al guardar: ${err.message}`);
    } finally {
      setIsSavingBulk(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // FUNCIONES DE EDICIÓN INDIVIDUAL POR FILA (EXISTENTES)
  // ──────────────────────────────────────────────────────────────────────────────

  const iniciarEdicion = (usuario) => {
    const campos = {};
    for (let i = 1; i <= 6; i++) campos[`dia_${i}`] = usuario[`dia_${i}`] || "";
    campos.segmento_prefiltro = usuario.segmento_prefiltro || "";
    campos.certifica = usuario.certifica || "";
    campos.segmento_certificado = usuario.segmento_certificado || "";
    campos.fecha_baja = usuario.fecha_baja || "";
    campos.motivo_baja = usuario.motivo_baja || "";
    setValoresEditables(campos);
    setFilaEditando(usuario.id);
  };

  const cancelarEdicion = () => {
    setFilaEditando(null);
    setValoresEditables({});
  };

  const handleInputChange = (campo, valor) => {
    setValoresEditables(prev => ({ ...prev, [campo]: valor }));
  };

  const guardarCambiosFila = async (userId) => {
    setLoading(true);
    try {
      const cambios = {};
      for (let i = 1; i <= 6; i++) {
        const key = `dia_${i}`;
        if (valoresEditables[key] !== undefined) cambios[key] = valoresEditables[key] === "" ? null : valoresEditables[key];
      }
      ['segmento_prefiltro', 'certifica', 'segmento_certificado', 'fecha_baja', 'motivo_baja'].forEach(campo => {
        if (valoresEditables[campo] !== undefined) cambios[campo] = valoresEditables[campo] === "" ? null : valoresEditables[campo];
      });
      const { error } = await supabase.from("usuarios").update(cambios).eq("id", userId);
      if (error) throw error;
      setUsuariosDotacion(prev => prev.map(u => u.id === userId ? { ...u, ...cambios } : u));
      setFilaEditando(null);
      setValoresEditables({});
      mostrarMensaje("success", "✅ Cambios guardados");
    } catch (err) {
      console.error("Error al guardar cambios:", err);
      mostrarMensaje("error", "❌ Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const actualizarEstadoUsuario = async (userId, nuevoEstado) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("usuarios").update({ estado: nuevoEstado }).eq("id", userId);
      if (error) throw error;
      setUsuariosDotacion(prev => prev.map(u => u.id === userId ? { ...u, estado: nuevoEstado } : u));
      mostrarMensaje("success", "✅ Estado actualizado");
    } catch (err) {
      console.error("Error al actualizar estado:", err);
      mostrarMensaje("error", "Error al actualizar estado");
    } finally {
      setLoading(false);
    }
  };

  const renderBadgeAsistencia = (estado) => {
    if (!estado) return <span className="text-gray-500 text-xs">—</span>;
    const config = {
      "ASISTIÓ": { icon: "✅", color: "bg-green-500/20 text-green-100" },
      "FALTA": { icon: "❌", color: "bg-red-500/20 text-red-100" },
      "TARDANZA": { icon: "⏱️", color: "bg-yellow-500/20 text-yellow-900" },
      "DESERTÓ": { icon: "🚪", color: "bg-purple-500/20 text-purple-100" },
      "NO SE PRESENTÓ": { icon: "🕳️", color: "bg-gray-700 text-gray-300" },
      "RETIRADO": { icon: "🚶‍♂️", color: "bg-orange-500/20 text-orange-900" },
      "NO APROBO ROLE PLAY": { icon: "📉", color: "bg-blue-500/20 text-blue-100" },
    };
    const { icon, color } = config[estado] || { icon: "?", color: "bg-gray-500/20 text-gray-300" };
    return <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] font-medium ${color}`}>{icon}</span>;
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // FUNCIONES DE DESCARGA CSV Y FILTROS
  // ──────────────────────────────────────────────────────────────────────────────

  const descargarCSV = () => {
    let usuariosFiltrados = [...usuariosDotacion];
    if (filtroGrupo !== "todos") usuariosFiltrados = usuariosFiltrados.filter(u => u.grupo_nombre === filtroGrupo);
    if (filtroEstado !== "todos") usuariosFiltrados = usuariosFiltrados.filter(u => u.estado === filtroEstado);
    if (busqueda.trim() !== "") {
      const termino = busqueda.toLowerCase().trim();
      usuariosFiltrados = usuariosFiltrados.filter(u =>
        (u.nombre && u.nombre.toLowerCase().includes(termino)) ||
        (u.usuario && u.usuario.toLowerCase().includes(termino))
      );
    }
    if (usuariosFiltrados.length === 0) {
      mostrarMensaje("warning", "⚠️ No hay datos para descargar");
      return;
    }
    const headers = ["Nombre", "Usuario", "Rol", "Grupo", "Estado", "Segmento Prefiltro", "Certifica", "Segmento Certificado", "Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6", "Fecha Baja", "Motivo Baja"];
    const csvRows = [headers.join(",")];
    usuariosFiltrados.forEach(u => {
      const row = [
        `"${u.nombre || ''}"`, `"${u.usuario || ''}"`, u.rol || '', u.grupo_nombre || '', u.estado || '',
        u.segmento_prefiltro || '', u.certifica || '', u.segmento_certificado || '',
        u.dia_1 || '', u.dia_2 || '', u.dia_3 || '', u.dia_4 || '', u.dia_5 || '', u.dia_6 || '',
        u.fecha_baja || '', `"${u.motivo_baja || ''}"`
      ];
      csvRows.push(row.join(","));
    });
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `dotacion_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    mostrarMensaje("success", `✅ Descargado ${usuariosFiltrados.length} registros`);
  };

  // Filtrado y paginación de usuarios
  const { usuariosPaginados, totalPaginas, totalFiltrados } = useMemo(() => {
    let filtrados = [...usuariosDotacion];
    if (filtroGrupo !== "todos") filtrados = filtrados.filter(u => u.grupo_nombre === filtroGrupo);
    if (filtroEstado !== "todos") filtrados = filtrados.filter(u => u.estado === filtroEstado);
    if (busqueda.trim() !== "") {
      const termino = busqueda.toLowerCase().trim();
      filtrados = filtrados.filter(u =>
        (u.nombre && u.nombre.toLowerCase().includes(termino)) ||
        (u.usuario && u.usuario.toLowerCase().includes(termino))
      );
    }
    const total = filtrados.length;
    const desde = (paginaActual - 1) * REGISTROS_POR_PAGINA;
    const hasta = desde + REGISTROS_POR_PAGINA;
    return {
      usuariosPaginados: filtrados.slice(desde, hasta),
      totalPaginas: Math.ceil(total / REGISTROS_POR_PAGINA) || 1,
      totalFiltrados: total
    };
  }, [usuariosDotacion, filtroGrupo, filtroEstado, busqueda, paginaActual]);

  const gruposUnicosActivos = useMemo(() => {
    const ids = [...new Set(activos.map(a => a.grupo_id).filter(id => id !== null))];
    return ids.map(id => {
      const grupo = activos.find(a => a.grupo_id === id)?.grupos;
      return { id, nombre: grupo?.nombre || `Grupo ${id}` };
    });
  }, [activos]);

  const activosFiltrados = useMemo(() => {
    if (filtroGrupoActivo === "todos") return activos;
    return activos.filter(a => a.grupo_id == filtroGrupoActivo);
  }, [activos, filtroGrupoActivo]);

  const gruposConCursosFiltrados = useMemo(() => {
    const map = {};
    activosFiltrados.forEach(a => {
      const gid = a.grupo_id;
      if (gid) {
        if (!map[gid]) map[gid] = { grupo: a.grupos, cursos: [] };
        map[gid].cursos.push(a);
      }
    });
    return Object.values(map);
  }, [activosFiltrados]);

  const actividadesPorDia = useMemo(() => {
    const dias = { 1: [], 2: [], 3: [], 4: [] };
    const mallaActual = mallasDeCapacitacion[mallaActiva] || mallasDeCapacitacion.Portabilidad;
    mallaActual.forEach(row => {
      if (row[0] && row[1]) dias[1].push({ actividad: row[0], tiempo: row[1] });
      if (row[2] && row[3]) dias[2].push({ actividad: row[2], tiempo: row[3] });
      if (row[4] && row[5]) dias[3].push({ actividad: row[4], tiempo: row[5] });
      if (row[6] && row[7]) dias[4].push({ actividad: row[6], tiempo: row[7] });
    });
    return dias;
  }, [mallaActiva]);

  // Handlers para filtros y selección
  const handleCampanaChange = async (campana_id) => {
    setSeleccion({ campana_id, dia: "", grupo_id: "", curso_id: "" });
    setGrupos([]); setCursos([]);
    if (campana_id) await cargarGrupos(campana_id);
  };

  const handleDiaChange = async (dia) => {
    setSeleccion({ ...seleccion, dia, grupo_id: "", curso_id: "" });
    setGrupos([]); setCursos([]);
    if (dia && seleccion.campana_id) await cargarGrupos(seleccion.campana_id);
  };

  const handleGrupoChange = async (grupo_id) => {
    setSeleccion({ ...seleccion, grupo_id, curso_id: "" });
    setCursos([]);
    if (grupo_id && seleccion.campana_id && seleccion.dia) {
      await cargarCursos(seleccion.campana_id, seleccion.dia, grupo_id);
    }
  };

  const toggleGroup = (groupId) => {
    const numericGroupId = Number(groupId);
    setExpandedGroupId(prev => prev === numericGroupId ? null : numericGroupId);
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      const allIds = usuariosPaginados.map(item => item.id);
      setSelectedItems(allIds);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Activar curso
  const activarCurso = async () => {
    const { campana_id, dia, grupo_id, curso_id } = seleccion;
    if (!campana_id || !dia || !grupo_id || !curso_id) {
      mostrarMensaje("error", "⚠️ Debes seleccionar campaña, día, grupo y curso");
      return;
    }
    setLoading(true);
    try {
      const { data: existe } = await supabase.from("cursos_activados").select("*")
        .eq("fecha", fechaHoy).eq("campana_id", campana_id).eq("grupo_id", grupo_id).eq("curso_id", curso_id).maybeSingle();
      if (existe) { mostrarMensaje("error", "⚠️ Este curso ya está activado"); return; }
      const { data: activacion, error } = await supabase.from("cursos_activados").insert([{ campana_id, grupo_id, curso_id, fecha: fechaHoy, activo: true, formador_id: user.id }]).select().single();
      if (error) throw error;
      const { data: grupo } = await supabase.from("grupos").select("nombre").eq("id", grupo_id).single();
      const { data: asesores } = await supabase.from("usuarios").select("id").eq("rol", "usuario").eq("grupo_nombre", grupo.nombre).eq("estado", "Activo");
      if (asesores?.length > 0) {
        await supabase.from("cursos_asesores").insert(asesores.map(u => ({ curso_activado_id: activacion.id, asesor_id: u.id })));
        mostrarMensaje("success", `✅ Curso activado y asignado a ${asesores.length} asesores`);
      } else {
        mostrarMensaje("success", "✅ Curso activado");
      }
      await cargarActivos();
      await cargarGrupos(seleccion.campana_id);
      setSeleccion({ ...seleccion, curso_id: "" });
    } catch (err) {
      console.error("Error al activar curso:", err);
      mostrarMensaje("error", "❌ Error al activar curso");
    } finally {
      setLoading(false);
    }
  };

  const desactivarCurso = async (id) => {
    if (!window.confirm("¿Desactivar este curso? Se eliminarán las asignaciones.")) return;
    setLoading(true);
    try {
      await supabase.from("cursos_asesores").delete().eq("curso_activado_id", id);
      await supabase.from("cursos_activados").delete().eq("id", id);
      mostrarMensaje("success", "🗑️ Curso desactivado");
      await cargarActivos();
    } catch (err) {
      console.error("Error al desactivar:", err);
      mostrarMensaje("error", "❌ Error al desactivar");
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ──────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-teal-900 overflow-hidden">
      {/* Estilos para partículas de fondo */}
      <style>{`
        .bg-particles::before, .bg-particles::after {
          content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background-repeat: repeat;
        }
        .bg-particles::before {
          background-image: radial-gradient(circle at 20% 50%, rgba(147,51,234,0.15) 1px, transparent 1px), radial-gradient(circle at 80% 30%, rgba(79,70,229,0.1) 1px, transparent 1px);
          background-size: 40px 40px, 60px 60px; animation: particlesFloat 12s ease-in-out infinite alternate;
        }
        .bg-particles::after {
          background-image: radial-gradient(circle at 50% 80%, rgba(147,51,234,0.08) 1px, transparent 1px);
          background-size: 80px 80px; filter: blur(0.5px); animation: particlesPulse 18s ease-in-out infinite alternate;
        }
        @keyframes particlesFloat { 0% { opacity: 0.25; transform: translateY(0) translateX(0); } 100% { opacity: 0.45; transform: translateY(-10px) translateX(5px); } }
        @keyframes particlesPulse { 0% { opacity: 0.15; } 100% { opacity: 0.35; } }
        .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-600 via-blue-900 to-teal-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Panel del Formador</h1>
            <p className="text-xs text-blue-200">📅 {fechaHoyFormateada}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-blue-100">
              <span className="w-2 h-2 bg-teal-300 rounded-full animate-pulse"></span>
              <span>{user?.name || "Formador"}</span>
            </div>
            <button onClick={onLogout} className="px-3 py-1.5 text-xs font-semibold bg-white/10 border border-white/30 text-white rounded-lg hover:bg-white/20 transition">Cerrar sesión</button>
          </div>
        </div>
      </header>

      {/* Mensajes */}
      {mensaje.texto && (
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 pt-4">
          <div className={`p-4 rounded-lg shadow-sm border-l-4 animate-in slide-in-from-top duration-500 ${
            mensaje.tipo === "success" ? "bg-green-500/20 border-l-green-400 text-green-200" :
            mensaje.tipo === "error" ? "bg-red-500/20 border-l-red-400 text-red-200" :
            "bg-blue-500/20 border-l-blue-400 text-blue-200"
          }`}>
            <p className="text-sm">{mensaje.texto}</p>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Sección izquierda: Activar Curso */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl shadow-purple-500/5 p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-xl text-white flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 p-2 rounded-lg border border-indigo-500/30">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                </span>
                Activar Curso
              </h2>
              {loading && <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Campaña</label>
              <select className="w-full bg-white/10 border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition text-sm text-white"
                value={seleccion.campana_id} onChange={(e) => handleCampanaChange(e.target.value)} disabled={loading}>
                <option value="" className="bg-slate-800">Selecciona una campaña</option>
                {campañas.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.nombre}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Día de capacitación</label>
              <select className="w-full bg-white/10 border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition text-sm text-white disabled:bg-gray-700"
                value={seleccion.dia} onChange={(e) => handleDiaChange(e.target.value)} disabled={!seleccion.campana_id || loading}>
                <option value="" className="bg-slate-800">Selecciona un día</option>
                {[1,2,3,4,5,6].map(d => <option key={d} value={d} className="bg-slate-800">Día {d}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Grupo</label>
              <select className="w-full bg-white/10 border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition text-sm text-white disabled:bg-gray-700"
                value={seleccion.grupo_id} onChange={(e) => handleGrupoChange(e.target.value)} disabled={!seleccion.dia || loading}>
                <option value="" className="bg-slate-800">Selecciona un grupo</option>
                {grupos.map(g => <option key={g.id} value={g.id} className="bg-slate-800">{g.nombre} ({g.activos || 0} asesores)</option>)}
              </select>
            </div>
            
            {cursos.length > 0 && (
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="bg-indigo-500/20 text-indigo-300 p-1 rounded border border-indigo-500/30">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.036-.687-.101-1.016A5 5 0 0010 11z" clipRule="evenodd" /></svg>
                  </span>
                  Malla de cursos (Día {seleccion.dia}) <span className="text-sm font-normal text-gray-400">({cursos.length} cursos)</span>
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {cursos.map((c, index) => (
                    <div key={c.id} className="flex items-center justify-between bg-white/10 p-2 rounded-md shadow-sm text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 bg-indigo-500/20 text-indigo-300 rounded-full text-[0.6rem] font-bold border border-indigo-500/30">{index + 1}</span>
                        <span className="font-medium text-gray-200 truncate max-w-[120px] md:max-w-[180px]">{c.titulo}</span>
                      </div>
                      <span className="text-xs text-gray-400">{c.duracion_minutos} min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Curso a activar</label>
              <select className="w-full bg-white/10 border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition text-sm text-white disabled:bg-gray-700"
                value={seleccion.curso_id} onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })} disabled={!cursos.length || loading}>
                <option value="" className="bg-slate-800">Selecciona el curso a activar</option>
                {cursos.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.titulo} - {c.duracion_minutos} min</option>)}
              </select>
            </div>
            
            <button onClick={activarCurso} disabled={!seleccion.curso_id || loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-indigo-500/20 transition-all font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              {loading ? "Activando..." : "✨ Activar curso de hoy"}
            </button>
          </div>

          {/* Sección derecha: Cursos Activos */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl shadow-purple-500/5 p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <h2 className="font-semibold text-xl text-white flex items-center gap-2">
                <span className="bg-green-500/20 text-green-300 p-2 rounded-lg border border-green-500/30">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                </span>
                Cursos Activos (Todos los días)
              </h2>
              <select value={filtroGrupoActivo} onChange={(e) => setFiltroGrupoActivo(e.target.value)}
                className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent">
                <option value="todos" className="bg-slate-800">Todos los grupos</option>
                {gruposUnicosActivos.map(g => <option key={g.id} value={g.id} className="bg-slate-800">{g.nombre}</option>)}
              </select>
            </div>
            
            {gruposConCursosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 text-gray-500">📭</div>
                <p className="text-gray-400 text-sm mb-1">No hay cursos activos</p>
                <p className="text-xs text-gray-500">Activa un curso para asignarlo a un grupo</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
                {gruposConCursosFiltrados.map((grupoData) => {
                  const grupo = grupoData.grupo;
                  const cursosDelGrupo = grupoData.cursos;
                  const groupId = Number(cursosDelGrupo[0]?.grupo_id);
                  const isExpanded = expandedGroupId === groupId;
                  return (
                    <div key={groupId} className="border border-white/20 rounded-lg overflow-hidden bg-white/5">
                      <div onClick={() => toggleGroup(groupId)} className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-500/20 text-indigo-300 p-1.5 rounded-full text-xs font-bold border border-indigo-500/30">{cursosDelGrupo.length}</span>
                          <h3 className="font-semibold text-gray-100">{grupo?.nombre || "Sin nombre"} ({cursosDelGrupo[0]?.fecha?.split('T')[0]})</h3>
                        </div>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-white/20 p-4 space-y-3">
                          {cursosDelGrupo.map((a) => (
                            <div key={a.id} className="border border-white/20 rounded-lg p-3 hover:shadow-md transition-all bg-white/10">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-100 mb-1">{a.cursos?.titulo || "Curso sin título"}</h3>
                                  <div className="flex flex-col gap-0.5 text-xs text-gray-400">
                                    <div className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.036-.687-.101-1.016A5 5 0 0010 11z" clipRule="evenodd" /></svg><span>{a.cursos?.duracion_minutos || 0} min</span></div>
                                    <div className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" /></svg><span>{a.campañas?.nombre || "Sin campaña"}</span></div>
                                    <div className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="font-medium text-green-400">{a.asesores_count || 0} asesores asignados</span></div>
                                  </div>
                                </div>
                                <button onClick={() => desactivarCurso(a.id)} disabled={loading} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 ml-2" title="Desactivar curso">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN: TABLA DE DOTACIÓN CON EDICIÓN MASIVA */}
      <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl shadow-purple-500/5 p-6">
          <h2 className="font-semibold text-xl text-white mb-4 flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-300 p-2 rounded-lg border border-blue-500/30">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            </span>
            Tabla de Dotación (Usuarios)
          </h2>
          
          {/* Barra de acciones: Descargar CSV + Botón Edición Masiva */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button onClick={descargarCSV} disabled={loading || totalFiltrados === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Descargar CSV ({totalFiltrados})
            </button>
            
            {/* ✅ BOTÓN PARA ABRIR MODAL DE EDICIÓN MASIVA */}
            {selectedItems.length > 0 && (
              <button onClick={openBulkModal} disabled={loading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Editar Seleccionados ({selectedItems.length})
              </button>
            )}
            
            <div className="text-xs text-gray-400 ml-auto">Mostrando {usuariosPaginados.length} de {totalFiltrados} usuarios</div>
          </div>
          
          {/* Filtros de la tabla */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Filtrar por Grupo</label>
              <select value={filtroGrupo} onChange={(e) => { setFiltroGrupo(e.target.value); setPaginaActual(1); }}
                className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent">
                <option value="todos" className="bg-slate-800">Todos los grupos</option>
                {gruposDisponibles.map(grupo => <option key={grupo} value={grupo} className="bg-slate-800">{grupo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Filtrar por Estado</label>
              <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
                className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent">
                <option value="todos" className="bg-slate-800">Todos los estados</option>
                <option value="Activo" className="bg-slate-800">Activo</option>
                <option value="Inactivo" className="bg-slate-800">Inactivo</option>
              </select>
            </div>
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs font-medium text-gray-300 mb-1">Buscar por nombre o usuario</label>
              <input type="text" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
                placeholder="Ej: Juan Pérez o jperz123"
                className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent placeholder-gray-400" />
            </div>
          </div>
          
          {/* Tabla de usuarios */}
          {loading && !usuariosDotacion.length ? (
            <div className="text-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-gray-400 text-xs">Cargando dotación...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">
                        <input type="checkbox" checked={selectedItems.length === usuariosPaginados.length && usuariosPaginados.length > 0}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="h-3.5 w-3.5 cursor-pointer text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                          title="Seleccionar todos en esta página" />
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Nombre</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Usuario</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Rol</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Grupo</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Seg. Prefiltro</th>
                      {[1,2,3,4,5,6].map(d => <th key={d} className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Día {d}</th>)}
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Certifica</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Seg. Certificado</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Fecha Baja</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Motivo Baja</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usuariosPaginados.length > 0 ? (
                      usuariosPaginados.map((u) => (
                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          {/* Checkbox de selección */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            <input type="checkbox" checked={selectedItems.includes(u.id)} onChange={() => handleSelectItem(u.id)}
                              className="h-3.5 w-3.5 cursor-pointer text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-100">{u.nombre}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">{u.usuario}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              u.rol === 'Administrador' ? 'bg-purple-500/20 text-purple-300' :
                              u.rol === 'Formador' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                            }`}>{u.rol}</span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">{u.grupo_nombre || '-'}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              u.estado === 'Activo' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                            }`}>{u.estado}</span>
                          </td>
                          
                          {/* segmento_prefiltro */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === u.id ? (
                              <select value={valoresEditables.segmento_prefiltro || ""} onChange={(e) => handleInputChange("segmento_prefiltro", e.target.value)}
                                className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400">
                                <option value="">—</option>
                                {OPCIONES_SEGMENTO.map(op => <option key={op} value={op} className="bg-slate-800">{op}</option>)}
                              </select>
                            ) : <span className="text-gray-300 text-xs">{u.segmento_prefiltro || "—"}</span>}
                          </td>
                          
                          {/* Días 1-6 */}
                          {[1,2,3,4,5,6].map(d => {
                            const key = `dia_${d}`;
                            const esEditable = filaEditando === u.id;
                            return (
                              <td key={key} className="px-2 py-2 whitespace-nowrap text-center">
                                {esEditable ? (
                                  <select value={valoresEditables[key] || ""} onChange={(e) => handleInputChange(key, e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400">
                                    <option value="">—</option>
                                    {OPCIONES_ASISTENCIA.map(op => <option key={op} value={op} className="bg-slate-800">{op}</option>)}
                                  </select>
                                ) : <div className="flex justify-center">{renderBadgeAsistencia(u[key])}</div>}
                              </td>
                            );
                          })}
                          
                          {/* certifica */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === u.id ? (
                              <select value={valoresEditables.certifica || ""} onChange={(e) => handleInputChange("certifica", e.target.value)}
                                className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400">
                                <option value="">—</option>
                                {OPCIONES_CERTIFICA.map(op => <option key={op} value={op} className="bg-slate-800">{op}</option>)}
                              </select>
                            ) : <span className="text-gray-300 text-xs">{u.certifica || "—"}</span>}
                          </td>
                          
                          {/* segmento_certificado */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === u.id ? (
                              <select value={valoresEditables.segmento_certificado || ""} onChange={(e) => handleInputChange("segmento_certificado", e.target.value)}
                                className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400">
                                <option value="">—</option>
                                {OPCIONES_SEGMENTO.map(op => <option key={op} value={op} className="bg-slate-800">{op}</option>)}
                              </select>
                            ) : <span className="text-gray-300 text-xs">{u.segmento_certificado || "—"}</span>}
                          </td>
                          
                          {/* fecha_baja */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === u.id ? (
                              <input type="date" value={valoresEditables.fecha_baja || ""} onChange={(e) => handleInputChange("fecha_baja", e.target.value)}
                                className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400" />
                            ) : <span className="text-gray-300 text-xs">{u.fecha_baja || "—"}</span>}
                          </td>
                          
                          {/* motivo_baja */}
                          <td className="px-2 py-2 whitespace-nowrap text-center max-w-[150px]">
                            {filaEditando === u.id ? (
                              <select value={valoresEditables.motivo_baja || ""} onChange={(e) => handleInputChange("motivo_baja", e.target.value)}
                                className="w-full bg-white border border-gray-300 text-gray-800 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400">
                                <option value="">— Seleccionar —</option>
                                {Object.entries(OPCIONES_MOTIVO_BAJA).map(([grupo, motivos]) => (
                                  <optgroup key={grupo} label={grupo}>
                                    {motivos.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                            ) : <span className="text-gray-300 text-xs truncate block" title={u.motivo_baja}>{u.motivo_baja || "—"}</span>}
                          </td>
                          
                          {/* Acciones */}
                          <td className="px-2 py-2 whitespace-nowrap">
                            {filaEditando === u.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => guardarCambiosFila(u.id)} disabled={loading}
                                  className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px] hover:bg-green-500/30 disabled:opacity-50">Guardar</button>
                                <button onClick={cancelarEdicion}
                                  className="px-1.5 py-0.5 bg-gray-500/20 text-gray-300 rounded text-[10px] hover:bg-gray-500/30">Cancelar</button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button onClick={() => iniciarEdicion(u)}
                                  className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] hover:bg-blue-500/30">Editar</button>
                                <button onClick={() => actualizarEstadoUsuario(u.id, u.estado === 'Activo' ? 'Inactivo' : 'Activo')} disabled={loading}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                    u.estado === 'Activo' ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                  } disabled:opacity-50`}>
                                  {u.estado === 'Activo' ? 'Inact.' : 'Activo'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="17" className="px-4 py-6 text-center text-gray-400 text-xs">No se encontraron usuarios con ese filtro.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaActual === 1 || loading}
                    className="px-3 py-1.5 bg-white/10 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition">← Anterior</button>
                  <span className="text-gray-300 text-xs">Página {paginaActual} de {totalPaginas}</span>
                  <button onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas || loading}
                    className="px-3 py-1.5 bg-white/10 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition">Siguiente →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL DE EDICIÓN MASIVA */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={closeBulkModal} />
          
          {/* Modal */}
          <div className="relative w-full md:max-w-4xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Header del modal */}
            <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5M4 13l6 6M14 3l7 7" /></svg>
                <h3 className="font-semibold">Edición Masiva • {selectedItems.length} registro(s) seleccionado(s)</h3>
              </div>
              <button onClick={closeBulkModal} className="text-white/80 hover:text-white" title="Cerrar">✕</button>
            </div>
            
            {/* Instrucciones */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-[11px] text-gray-600">
                💡 <strong>Instrucciones:</strong> Marca la casilla <strong>"Aplicar"</strong> en cada campo que deseas actualizar. Los campos no marcados NO serán modificados.
              </p>
            </div>
            
            {/* Body del modal - Campos editables */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto flex-1">
              {BULK_FIELDS.map((field) => (
                <div key={field.key} className="flex items-start gap-2 p-2 border border-gray-200 rounded-lg">
                  {/* Checkbox "Aplicar" */}
                  <input type="checkbox" checked={!!bulkApply[field.key]} onChange={(e) => toggleBulkApply(field.key, e.target.checked)}
                    className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" title="Aplicar este campo" />
                  
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-medium text-gray-700 mb-1">{field.label}</label>
                    
                    {/* SELECT */}
                    {field.type === 'select' && (
                      <select value={bulkForm[field.key] ?? ''} onChange={(e) => setBulkField(field.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-white">
                        <option value="">--Seleccionar--</option>
                        {field.options.map(opt => <option key={opt} value={opt} className="bg-slate-800">{opt}</option>)}
                      </select>
                    )}
                    
                    {/* TEXT */}
                    {field.type === 'text' && (
                      <input type="text" value={bulkForm[field.key] ?? ''} onChange={(e) => setBulkField(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
                    )}
                    
                    {/* DATE */}
                    {field.type === 'date' && (
                      <input type="date" value={(bulkForm[field.key] ?? '')?.slice(0, 10)} onChange={(e) => setBulkField(field.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
                    )}
                    
                    {/* MOTIVO_BAJA con optgroup */}
                    {field.type === 'motivo_baja' && (
                      <select value={bulkForm.motivo_baja ?? ''} onChange={(e) => setBulkField('motivo_baja', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-white">
                        <option value="">— Seleccionar —</option>
                        {Object.entries(OPCIONES_MOTIVO_BAJA).map(([grupo, motivos]) => (
                          <optgroup key={grupo} label={grupo}>
                            {motivos.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer del modal */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="text-[11px] text-gray-600">
                Campos marcados como <strong>Aplicar</strong> serán actualizados en <strong>{selectedItems.length}</strong> registro(s).
              </div>
              <div className="flex gap-2">
                <button onClick={closeBulkModal} disabled={isSavingBulk}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={saveBulkModal} disabled={isSavingBulk}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-lg hover:opacity-90 transition-opacity text-xs font-medium disabled:opacity-50 flex items-center gap-2">
                  {isSavingBulk ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* FIN MODAL DE EDICIÓN MASIVA */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}

      {/* SECCIÓN: MALLA DE CAPACITACIÓN */}
      <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl shadow-purple-500/5 p-6">
          <h2 className="font-semibold text-xl text-white mb-4 flex items-center gap-2">
            <span className="bg-amber-500/20 text-amber-300 p-2 rounded-lg border border-amber-500/30">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0v2a2 2 0 11-4 0v-2zm8 0a2 2 0 114 0v2a2 2 0 11-4 0v-2z" clipRule="evenodd" /></svg>
            </span>
            Malla de Capacitación
          </h2>
          
          {/* Pestañas de mallas */}
          <div className="flex space-x-2 mb-4 border-b border-white/20 pb-2 overflow-x-auto hide-scrollbar">
            {Object.keys(mallasDeCapacitacion).map((nombreMalla) => (
              <button key={nombreMalla} onClick={() => setMallaActiva(nombreMalla)}
                className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                  mallaActiva === nombreMalla ? "bg-white/20 text-amber-300 border-b-2 border-amber-400" : "text-gray-300 hover:bg-white/10"
                }`}>
                {nombreMalla}
              </button>
            ))}
          </div>
          
          {/* Contenido de la malla */}
          <div className="flex overflow-x-auto gap-6 pb-4 hide-scrollbar" style={{ scrollSnapType: 'x mandatory' }}>
            {[1, 2, 3, 4].map(dia => (
              <div key={dia} className="bg-white/5 rounded-xl border border-white/10 shadow-lg p-4 w-64 flex-shrink-0 snap-start" style={{ minWidth: '16rem' }}>
                <div className="text-center mb-3">
                  <h3 className="font-bold text-lg text-amber-300">Día {dia}</h3>
                  <div className="w-12 h-0.5 bg-amber-500/30 mx-auto mt-1"></div>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {actividadesPorDia[dia]?.length > 0 ? (
                    actividadesPorDia[dia].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start bg-white/5 rounded-lg p-2 hover:bg-white/10 transition">
                        <span className="text-gray-200 text-sm font-medium">{item.actividad}</span>
                        <span className="text-gray-400 text-xs bg-black/20 px-2 py-0.5 rounded whitespace-nowrap">{item.tiempo}</span>
                      </div>
                    ))
                  ) : <div className="text-gray-500 text-center text-sm py-4">Sin actividades</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-2"><p className="text-xs text-gray-500">Desliza horizontalmente para ver más días</p></div>
        </div>
      </div>

      {/* Elementos ocultos para QR */}
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
