// src/pages/FormadorAsistencia.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

// Opciones para los campos de asistencia (día 1-7)
const OPCIONES_ASISTENCIA = [
  "ASISTIÓ", "FALTA", "DESERTÓ", "TARDANZA", "NO SE PRESENTÓ", 
  "RETIRADO", "NO APROBO ROLE PLAY", "INYECTADO"
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
// ──────────────────────────────────────────────────────────────────────────────
const BULK_FIELDS = [
  { key: 'estado', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo'] },
  { key: 'segmento_prefiltro', label: 'Segmento Prefiltro', type: 'select', options: OPCIONES_SEGMENTO },
  { key: 'certifica', label: 'Certifica', type: 'select', options: OPCIONES_CERTIFICA },
  { key: 'segmento_certificado', label: 'Segmento Certificado', type: 'select', options: OPCIONES_SEGMENTO },
  { key: 'fecha_baja', label: 'Fecha Baja', type: 'date' },
  { key: 'motivo_baja', label: 'Motivo Baja', type: 'motivo_baja' },
  { key: 'telefono', label: 'Teléfono', type: 'text', placeholder: 'Ej: 987654321' },
  ...[1, 2, 3, 4, 5, 6, 7].map(d => ({
    key: `dia_${d}`,
    label: `Día ${d}`,
    type: 'select',
    options: OPCIONES_ASISTENCIA
  }))
];

// ✅ FUNCIÓN PARA FORMATEAR FECHA SIN PROBLEMAS DE ZONA HORARIA
const formatearFecha = (fechaString) => {
  if (!fechaString) return "—";
  if (fechaString instanceof Date) {
    return fechaString.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  let fecha;
  if (fechaString.includes('-')) {
    const [year, month, day] = fechaString.split('-');
    fecha = new Date(year, month - 1, day);
  } else if (fechaString.includes('/')) {
    const [day, month, year] = fechaString.split('/');
    fecha = new Date(year, month - 1, day);
  } else {
    fecha = new Date(fechaString);
  }
  if (isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// ✅ FUNCIÓN PARA FORMATEAR TELÉFONO
const formatearTelefono = (telefono) => {
  if (!telefono) return "—";
  const limpio = String(telefono).replace(/\D/g, '');
  if (limpio.length === 9) {
    return `${limpio.slice(0, 3)} ${limpio.slice(3, 6)} ${limpio.slice(6)}`;
  }
  return telefono;
};

// ✅ FUNCIÓN PARA LIMPIAR STRINGS (TRIM Y NORMALIZAR)
const limpiarString = (str) => {
  if (!str) return "";
  return String(str).trim().toUpperCase();
};

export default function FormadorAsistencia({ user, onLogout }) {
  const navigate = useNavigate();
  
  // Estados principales
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  
  // Filtros - ✅ VALORES INICIALES CORREGIDOS PARA MOSTRAR TODO
  const [filtroCampana, setFiltroCampana] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroSegmento, setFiltroSegmento] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  
  // ✅ CONTADOR DE REGISTROS TOTALES VS FILTRADOS
  const [totalRegistrosBD, setTotalRegistrosBD] = useState(0);
  
  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const REGISTROS_POR_PAGINA = 15;
  
  // Edición por fila
  const [filaEditando, setFilaEditando] = useState(null);
  const [valoresEditables, setValoresEditables] = useState({});
  
  // Listas para filtros dinámicos
  const [campanasUnicas, setCampanasUnicas] = useState([]);
  const [gruposUnicos, setGruposUnicos] = useState([]);
  const [gruposPorCampana, setGruposPorCampana] = useState({});
  
  // ✅ ESTADO PARA CARGA INICIAL COMPLETA
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  
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
  
  const fechaHoyFormateada = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Cargar datos al montar
  useEffect(() => {
    cargarRegistros();
    cargarFiltrosDinamicos();
  }, []);

  // ✅ Cuando cambia la campaña, resetear filtro de grupo
  useEffect(() => {
    setFiltroGrupo("todos");
    setPaginaActual(1);
  }, [filtroCampana]);

  // Mostrar mensaje temporal
  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  // ✅ CARGAR REGISTROS - CORREGIDO PARA OBTENER TODOS LOS DATOS
  const cargarRegistros = async () => {
    setLoading(true);
    try {
      // ✅ PRIMERO OBTENER EL COUNT TOTAL
      const { count, error: countError } = await supabase
        .from("formacion_seguimiento")
        .select("*", { count: "exact", head: true });
      
      if (countError) {
        console.error("Error al obtener count:", countError);
      } else {
        setTotalRegistrosBD(count || 0);
      }

      // ✅ LUEGO OBTENER TODOS LOS REGISTROS SIN LIMITES
      const { data, error } = await supabase
        .from("formacion_seguimiento")
        .select(`
          id, dni, nombre, campaña, grupo_nombre, estado, fecha_inicio, fecha_termino,
          segmento_prefiltro, dia_1, dia_2, dia_3, dia_4, dia_5, dia_6, dia_7,
          certifica, segmento_certificado, fecha_baja, motivo_baja, telefono,
          created_at, updated_at
        `)
        .order("nombre", { ascending: true });
      
      if (error) throw error;
      
      // ✅ NORMALIZAR DATOS (TRIM EN STRINGS)
      const datosNormalizados = (data || []).map(r => ({
        ...r,
        campaña: r.campaña?.trim() || "",
        grupo_nombre: r.grupo_nombre?.trim() || "",
        estado: r.estado?.trim() || "Inactivo",
        segmento_prefiltro: r.segmento_prefiltro?.trim() || "",
        certifica: r.certifica?.trim() || "",
        segmento_certificado: r.segmento_certificado?.trim() || "",
        motivo_baja: r.motivo_baja?.trim() || "",
        telefono: r.telefono?.trim() || "",
      }));
      
      setRegistros(datosNormalizados);
      setCargaInicialCompleta(true);
      
      // ✅ MOSTRAR MENSAJE INFORMATIVO
      if (datosNormalizados.length < (count || 0)) {
        mostrarMensaje("warning", 
          `⚠️ Mostrando ${datosNormalizados.length} de ${count} registros. 
           Verifica políticas RLS en Supabase.`
        );
      }
    } catch (err) {
      console.error("Error al cargar registros:", err);
      mostrarMensaje("error", `❌ Error al cargar datos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CARGAR VALORES ÚNICOS PARA FILTROS - CORREGIDO
  const cargarFiltrosDinamicos = async () => {
    try {
      // ✅ CAMPAÑAS - INCLUIR VALORES NULL/VACÍOS
      const { data: campanas } = await supabase
        .from("formacion_seguimiento")
        .select("campaña");
      
      if (campanas) {
        const unicas = [...new Set(
          campanas
            .map(c => c.campaña?.trim())
            .filter(Boolean)
        )].sort();
        setCampanasUnicas(unicas);
      }

      // ✅ GRUPOS - AGRUPAR POR CAMPAÑA
      const { data: gruposData } = await supabase
        .from("formacion_seguimiento")
        .select("campaña, grupo_nombre");
      
      if (gruposData) {
        const gruposPorCamp = {};
        gruposData.forEach(item => {
          const campana = item.campaña?.trim();
          const grupo = item.grupo_nombre?.trim();
          if (campana && grupo) {
            if (!gruposPorCamp[campana]) gruposPorCamp[campana] = [];
            if (!gruposPorCamp[campana].includes(grupo)) {
              gruposPorCamp[campana].push(grupo);
            }
          }
        });
        
        Object.keys(gruposPorCamp).forEach(campana => {
          gruposPorCamp[campana].sort();
        });
        
        setGruposPorCampana(gruposPorCamp);
        
        const todosLosGrupos = [...new Set(
          gruposData.map(g => g.grupo_nombre?.trim()).filter(Boolean)
        )].sort();
        setGruposUnicos(todosLosGrupos);
      }
    } catch (err) {
      console.error("Error al cargar filtros:", err);
    }
  };

  // ✅ OBTENER GRUPOS DISPONIBLES SEGÚN LA CAMPAÑA SELECCIONADA
  const getGruposDisponibles = () => {
    if (filtroCampana && gruposPorCampana[filtroCampana]) {
      return gruposPorCampana[filtroCampana];
    }
    return gruposUnicos;
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // FUNCIONES DE EDICIÓN MASIVA CON MODAL
  // ──────────────────────────────────────────────────────────────────────────────
  const openBulkModal = () => {
    if (selectedItems.length === 0) {
      mostrarMensaje("warning", "⚠️ Selecciona al menos un registro para editar");
      return;
    }
    setBulkForm(Object.fromEntries(BULK_FIELDS.map(f => [f.key, ''])));
    setBulkApply(Object.fromEntries(BULK_FIELDS.map(f => [f.key, false])));
    setIsBulkModalOpen(true);
  };

  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setSelectedItems([]);
  };

  const setBulkField = (key, value) => {
    setBulkForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleBulkApply = (key, checked) => {
    setBulkApply(prev => ({ ...prev, [key]: checked }));
  };

  // Guardar cambios masivos
  const saveBulkModal = async () => {
    const camposParaAplicar = Object.entries(bulkApply).filter(([_, v]) => v);
    if (camposParaAplicar.length === 0) {
      mostrarMensaje("warning", "⚠️ Marca 'Aplicar' en al menos un campo para guardar");
      return;
    }
    
    setIsSavingBulk(true);
    try {
      const payload = {};
      BULK_FIELDS.forEach(field => {
        if (bulkApply[field.key]) {
          let value = bulkForm[field.key];
          if (value === '' && [
            'segmento_prefiltro', 'certifica', 'segmento_certificado', 
            'fecha_baja', 'motivo_baja', 'telefono', 
            ...[1, 2, 3, 4, 5, 6, 7].map(d => `dia_${d}`)
          ].includes(field.key)) {
            value = null;
          }
          payload[field.key] = value;
        }
      });

      const { error: updateError } = await supabase
        .from("formacion_seguimiento")
        .update(payload)
        .in("id", selectedItems);
      
      if (updateError) throw updateError;
      
      setRegistros(prev =>
        prev.map(r => selectedItems.includes(r.id) ? { ...r, ...payload } : r)
      );
      
      mostrarMensaje("success", `✅ Cambios aplicados a ${selectedItems.length} registro(s)`);
      closeBulkModal();
      await cargarRegistros();
    } catch (err) {
      console.error("Error en edición masiva:", err);
      mostrarMensaje("error", `❌ Error al guardar: ${err.message}`);
    } finally {
      setIsSavingBulk(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // FUNCIONES DE EDICIÓN INDIVIDUAL POR FILA
  // ──────────────────────────────────────────────────────────────────────────────
  const iniciarEdicion = (registro) => {
    const campos = {};
    for (let i = 1; i <= 7; i++) campos[`dia_${i}`] = registro[`dia_${i}`] || "";
    campos.segmento_prefiltro = registro.segmento_prefiltro || "";
    campos.certifica = registro.certifica || "";
    campos.segmento_certificado = registro.segmento_certificado || "";
    campos.fecha_baja = registro.fecha_baja || "";
    campos.motivo_baja = registro.motivo_baja || "";
    campos.telefono = registro.telefono || "";
    setValoresEditables(campos);
    setFilaEditando(registro.id);
  };

  const cancelarEdicion = () => {
    setFilaEditando(null);
    setValoresEditables({});
  };

  const handleInputChange = (campo, valor) => {
    setValoresEditables(prev => ({ ...prev, [campo]: valor }));
  };

  const guardarCambiosFila = async (registroId) => {
    setLoading(true);
    try {
      const cambios = {};
      for (let i = 1; i <= 7; i++) {
        const key = `dia_${i}`;
        if (valoresEditables[key] !== undefined) {
          cambios[key] = valoresEditables[key] === "" ? null : valoresEditables[key];
        }
      }
      ['segmento_prefiltro', 'certifica', 'segmento_certificado', 'fecha_baja', 'motivo_baja', 'telefono']
        .forEach(campo => {
          if (valoresEditables[campo] !== undefined) {
            cambios[campo] = valoresEditables[campo] === "" ? null : valoresEditables[campo];
          }
        });

      const { error } = await supabase
        .from("formacion_seguimiento")
        .update(cambios)
        .eq("id", registroId);
      
      if (error) throw error;
      
      setRegistros(prev => prev.map(r => r.id === registroId ? { ...r, ...cambios } : r));
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

  // Badges
  const renderBadgeAsistencia = (estado) => {
    if (!estado) return <span className="text-gray-400 text-xs">—</span>;
    const config = {
      "ASISTIÓ": { icon: "✔️", color: "bg-green-50 text-green-700 border border-green-200" },
      "FALTA": { icon: "✖️", color: "bg-red-50 text-red-700 border border-red-200" },
      "TARDANZA": { icon: "⏱️", color: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
      "DESERTÓ": { icon: "🚪", color: "bg-gray-50 text-gray-700 border border-gray-200" },
      "NO SE PRESENTÓ": { icon: "🕳️", color: "bg-gray-50 text-gray-700 border border-gray-200" },
      "RETIRADO": { icon: "🚶‍♂️", color: "bg-orange-50 text-orange-700 border border-orange-200" },
      "NO APROBO ROLE PLAY": { icon: "📉", color: "bg-blue-50 text-blue-700 border border-blue-200" },
      "INYECTADO": { icon: "💉", color: "bg-purple-50 text-purple-700 border border-purple-200" },
    };
    const { icon, color } = config[estado] || { icon: "?", color: "bg-gray-50 text-gray-700 border border-gray-200" };
    return <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${color}`}>{icon}</span>;
  };

  const renderBadgeEstado = (estado) => {
    const isActive = estado === 'Activo';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
        isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
      }`}>
        {estado || 'Inactivo'}
      </span>
    );
  };

  // ✅ FILTRAR Y PAGINAR REGISTROS - CORREGIDO PARA COMPARACIÓN NORMALIZADA
  const { registrosPaginados, totalPaginas, totalFiltrados } = useMemo(() => {
    let filtrados = [...registros];
    
    // ✅ FILTRO CAMPAÑA - COMPARACIÓN NORMALIZADA
    if (filtroCampana) {
      filtrados = filtrados.filter(r => 
        limpiarString(r.campaña) === limpiarString(filtroCampana)
      );
    }
    
    // ✅ FILTRO GRUPO - COMPARACIÓN NORMALIZADA
    if (filtroGrupo !== "todos") {
      filtrados = filtrados.filter(r => 
        limpiarString(r.grupo_nombre) === limpiarString(filtroGrupo)
      );
    }
    
    // ✅ FILTRO ESTADO
    if (filtroEstado !== "todos") {
      filtrados = filtrados.filter(r => 
        limpiarString(r.estado) === limpiarString(filtroEstado)
      );
    }
    
    // ✅ FILTRO SEGMENTO
    if (filtroSegmento !== "todos") {
      filtrados = filtrados.filter(r => 
        limpiarString(r.segmento_prefiltro) === limpiarString(filtroSegmento)
      );
    }
    
    // ✅ BÚSQUEDA POR NOMBRE O DNI
    if (busqueda.trim() !== "") {
      const termino = busqueda.toLowerCase().trim();
      filtrados = filtrados.filter(r =>
        (r.nombre && r.nombre.toLowerCase().includes(termino)) ||
        (r.dni && String(r.dni).includes(termino))
      );
    }
    
    const total = filtrados.length;
    const desde = (paginaActual - 1) * REGISTROS_POR_PAGINA;
    const hasta = desde + REGISTROS_POR_PAGINA;
    const pagina = filtrados.slice(desde, hasta);
    const totalPag = Math.ceil(total / REGISTROS_POR_PAGINA) || 1;
    
    return { registrosPaginados: pagina, totalPaginas: totalPag, totalFiltrados: total };
  }, [registros, filtroCampana, filtroGrupo, filtroEstado, filtroSegmento, busqueda, paginaActual]);

  // Exportar CSV
  const descargarCSV = () => {
    if (registrosPaginados.length === 0) {
      mostrarMensaje("warning", "⚠️ No hay datos para descargar");
      return;
    }
    const headers = [
      "DNI", "Nombre", "Campaña", "Grupo", "Estado", "Teléfono", "Fecha Inicio", "Fecha Término",
      "Segmento Prefiltro", "Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6", "Día 7",
      "Certifica", "Segmento Certificado", "Fecha Baja", "Motivo Baja"
    ];
    const csvRows = [headers.join(",")];
    registrosPaginados.forEach(r => {
      const row = [
        `"${r.dni || ''}"`, `"${r.nombre || ''}"`, r.campaña || '', r.grupo_nombre || '', r.estado || '',
        `"${r.telefono || ''}"`, r.fecha_inicio || '', r.fecha_termino || '', r.segmento_prefiltro || '',
        r.dia_1 || '', r.dia_2 || '', r.dia_3 || '', r.dia_4 || '', r.dia_5 || '', r.dia_6 || '', r.dia_7 || '',
        r.certifica || '', r.segmento_certificado || '', r.fecha_baja || '', `"${r.motivo_baja || ''}"`
      ];
      csvRows.push(row.join(","));
    });
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `formacion_seguimiento_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    mostrarMensaje("success", `✅ Descargado ${registrosPaginados.length} registros`);
  };

  // Actualizar estado del registro
  const toggleEstadoRegistro = async (registroId, estadoActual) => {
    const nuevoEstado = estadoActual === 'Activo' ? 'Inactivo' : 'Activo';
    setLoading(true);
    try {
      const { error } = await supabase
        .from("formacion_seguimiento")
        .update({ estado: nuevoEstado })
        .eq("id", registroId);
      if (error) throw error;
      setRegistros(prev => prev.map(r => r.id === registroId ? { ...r, estado: nuevoEstado } : r));
      mostrarMensaje("success", `✅ Estado cambiado a ${nuevoEstado}`);
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      mostrarMensaje("error", "❌ Error al cambiar estado");
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // SELECCIÓN DE FILAS PARA EDICIÓN MASIVA
  // ──────────────────────────────────────────────────────────────────────────────
  const toggleSelectAll = (checked) => {
    if (checked) {
      const allIds = registrosPaginados.map(item => item.id);
      setSelectedItems(allIds);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/formador")}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              title="Volver al Panel del Formador"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Volver</span>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Seguimiento de Formación</h1>
              <p className="text-xs text-gray-500">📅 {fechaHoyFormateada}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>{user?.name || "Formador"}</span>
            </div>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Mensajes */}
      {mensaje.texto && (
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 pt-4">
          <div className={`p-3 rounded-md shadow-sm border-l-4 ${
            mensaje.tipo === "success" ? "bg-green-50 border-l-green-500 text-green-800" :
            mensaje.tipo === "error" ? "bg-red-50 border-l-red-500 text-red-800" :
            "bg-blue-50 border-l-blue-500 text-blue-800"
          }`}>
            <p className="text-sm">{mensaje.texto}</p>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6">
        {/* Barra de acciones y filtros */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
              <span className="text-blue-600">📋</span>
              Gestión de Asistencia y Seguimiento
            </h2>
            <div className="flex items-center gap-4">
              {/* ✅ CONTADOR DE REGISTROS TOTALES VS FILTRADOS */}
              <div className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                <span className="font-medium">{totalFiltrados}</span> mostrados de{" "}
                <span className="font-medium text-blue-600">{totalRegistrosBD}</span> en BD
              </div>
              <button
                onClick={descargarCSV}
                disabled={loading || totalFiltrados === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar CSV ({totalFiltrados})
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Campaña</label>
              <select
                value={filtroCampana}
                onChange={(e) => { setFiltroCampana(e.target.value); setPaginaActual(1); }}
                className="bg-white border border-gray-300 text-gray-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="">Todas</option>
                {campanasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Grupo</label>
              <select
                value={filtroGrupo}
                onChange={(e) => { setFiltroGrupo(e.target.value); setPaginaActual(1); }}
                className="bg-white border border-gray-300 text-gray-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:opacity-60"
                disabled={!!filtroCampana && getGruposDisponibles().length === 0}
              >
                <option value="todos">Todos</option>
                {getGruposDisponibles().map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {filtroCampana && getGruposDisponibles().length === 0 && (
                <p className="text-[10px] text-gray-500 mt-1">No hay grupos para esta campaña</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
                className="bg-white border border-gray-300 text-gray-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="todos">Todos</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Segmento</label>
              <select
                value={filtroSegmento}
                onChange={(e) => { setFiltroSegmento(e.target.value); setPaginaActual(1); }}
                className="bg-white border border-gray-300 text-gray-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="todos">Todos</option>
                {OPCIONES_SEGMENTO.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Buscar por nombre o DNI</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
                placeholder="Ej: Juan Pérez o 75834921"
                className="w-full bg-white border border-gray-300 text-gray-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder-gray-400"
              />
            </div>
            <button
              onClick={() => {
                setFiltroCampana(""); setFiltroGrupo("todos"); setFiltroEstado("todos");
                setFiltroSegmento("todos"); setBusqueda(""); setPaginaActual(1);
              }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Tabla de Registros */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {loading && !registros.length ? (
            <div className="text-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-gray-600 text-xs">Cargando registros...</p>
            </div>
          ) : (
            <>
              {/* ✅ INDICADOR DE CARGA COMPLETA */}
              {!cargaInicialCompleta && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                  ⏳ Cargando datos completos, por favor espere...
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedItems.length === registrosPaginados.length && registrosPaginados.length > 0}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="h-3.5 w-3.5 cursor-pointer text-blue-600 rounded border-gray-300 focus:ring-blue-600"
                          title="Seleccionar todos en esta página"
                        />
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">DNI</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">Nombre</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">Campaña</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">Grupo</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">Estado</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">Seg. Prefiltro</th>
                      {[1, 2, 3, 4, 5, 6, 7].map(d => (
                        <th key={d} className="px-2 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">Día {d}</th>
                      ))}
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">Certifica</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">Seg. Certificado</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">Fecha Baja</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">Motivo Baja</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">Teléfono</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {registrosPaginados.length > 0 ? (
                      registrosPaginados.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(r.id)}
                              onChange={() => handleSelectItem(r.id)}
                              className="h-3.5 w-3.5 cursor-pointer text-blue-600 rounded border-gray-300 focus:ring-blue-600"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 font-mono">{r.dni}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">{r.nombre}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700">{r.campaña || '-'}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700">{r.grupo_nombre || '-'}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{renderBadgeEstado(r.estado)}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables.segmento_prefiltro || ""}
                                onChange={(e) => handleInputChange("segmento_prefiltro", e.target.value)}
                                className="w-full bg-white border border-gray-300 text-gray-700 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                              >
                                <option value="">—</option>
                                {OPCIONES_SEGMENTO.map(op => <option key={op} value={op}>{op}</option>)}
                              </select>
                            ) : <span className="text-gray-700 text-xs">{r.segmento_prefiltro || "—"}</span>}
                          </td>
                          {[1, 2, 3, 4, 5, 6, 7].map(d => {
                            const key = `dia_${d}`;
                            const esEditable = filaEditando === r.id;
                            return (
                              <td key={key} className="px-2 py-2 whitespace-nowrap text-center">
                                {esEditable ? (
                                  <select
                                    value={valoresEditables[key] || ""}
                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                    className="w-full bg-white border border-gray-300 text-gray-700 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                                  >
                                    <option value="">—</option>
                                    {OPCIONES_ASISTENCIA.map(op => <option key={op} value={op}>{op}</option>)}
                                  </select>
                                ) : <div className="flex justify-center">{renderBadgeAsistencia(r[key])}</div>}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables.certifica || ""}
                                onChange={(e) => handleInputChange("certifica", e.target.value)}
                                className="w-full bg-white border border-gray-300 text-gray-700 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                              >
                                <option value="">—</option>
                                {OPCIONES_CERTIFICA.map(op => <option key={op} value={op}>{op}</option>)}
                              </select>
                            ) : (
                              <span className={`text-xs font-medium ${
                                r.certifica === 'SI' ? 'text-green-700' : r.certifica === 'NO' ? 'text-red-700' : 'text-gray-500'
                              }`}>
                                {r.certifica || "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables.segmento_certificado || ""}
                                onChange={(e) => handleInputChange("segmento_certificado", e.target.value)}
                                className="w-full bg-white border border-gray-300 text-gray-700 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                              >
                                <option value="">—</option>
                                {OPCIONES_SEGMENTO.map(op => <option key={op} value={op}>{op}</option>)}
                              </select>
                            ) : <span className="text-gray-700 text-xs">{r.segmento_certificado || "—"}</span>}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <input
                                type="date"
                                value={valoresEditables.fecha_baja ? valoresEditables.fecha_baja.slice(0, 10) : ""}
                                onChange={(e) => handleInputChange("fecha_baja", e.target.value)}
                                className="w-full bg-white border border-gray-300 text-gray-700 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                              />
                            ) : <span className="text-gray-700 text-xs">{formatearFecha(r.fecha_baja)}</span>}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-center max-w-[150px]">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables.motivo_baja || ""}
                                onChange={(e) => handleInputChange("motivo_baja", e.target.value)}
                                className="w-full bg-white border border-gray-300 text-gray-900 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                              >
                                <option value="">— Seleccionar —</option>
                                {Object.entries(OPCIONES_MOTIVO_BAJA).map(([grupo, motivos]) => (
                                  <optgroup key={grupo} label={grupo}>
                                    {motivos.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                            ) : <span className="text-gray-700 text-xs truncate block" title={r.motivo_baja}>{r.motivo_baja || "—"}</span>}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <input
                                type="tel"
                                value={valoresEditables.telefono || ""}
                                onChange={(e) => handleInputChange("telefono", e.target.value)}
                                placeholder="987654321"
                                className="w-full bg-white border border-gray-300 text-gray-700 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                              />
                            ) : <span className="text-gray-700 text-xs">{formatearTelefono(r.telefono)}</span>}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {filaEditando === r.id ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => guardarCambiosFila(r.id)}
                                  disabled={loading}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] disabled:opacity-50"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={cancelarEdicion}
                                  className="px-2 py-1 border border-gray-300 text-gray-700 rounded text-[10px] hover:bg-gray-50"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => iniciarEdicion(r)}
                                  className="px-2 py-1 border border-gray-300 text-gray-700 rounded text-[10px] hover:bg-gray-50"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => toggleEstadoRegistro(r.id, r.estado)}
                                  disabled={loading}
                                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors border ${
                                    r.estado === 'Activo'
                                      ? 'border-red-300 text-red-700 hover:bg-red-50'
                                      : 'border-green-300 text-green-700 hover:bg-green-50'
                                  } disabled:opacity-50`}
                                >
                                  {r.estado === 'Activo' ? 'Inact.' : 'Activo'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="21" className="px-4 py-6 text-center text-gray-600 text-xs">
                          {cargaInicialCompleta 
                            ? "No se encontraron registros con esos filtros." 
                            : "Cargando datos..."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1 || loading}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                  >
                    ← Anterior
                  </button>
                  <span className="text-gray-700 text-xs">Página {paginaActual} de {totalPaginas}</span>
                  <button
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas || loading}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                  >
                    Siguiente →
                  </button>
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
          <div className="absolute inset-0 bg-black/50" onClick={closeBulkModal} />
          <div className="relative w-full md:max-w-4xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header del modal */}
            <div className="px-4 py-3 bg-white border-b border-gray-200 text-gray-900 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5M4 13l6 6M14 3l7 7" />
                </svg>
                <h3 className="font-semibold">Edición Masiva • {selectedItems.length} registro(s) seleccionado(s)</h3>
              </div>
              <button onClick={closeBulkModal} className="text-gray-500 hover:text-gray-700" title="Cerrar">✕</button>
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
                  <input
                    type="checkbox"
                    checked={!!bulkApply[field.key]}
                    onChange={(e) => toggleBulkApply(field.key, e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
                    title="Aplicar este campo"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-medium text-gray-700 mb-1">{field.label}</label>
                    {field.type === 'select' && (
                      <select
                        value={bulkForm[field.key] ?? ''}
                        onChange={(e) => setBulkField(field.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white text-gray-700"
                      >
                        <option value="">--Seleccionar--</option>
                        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}
                    {field.type === 'text' && (
                      <input
                        type="text"
                        value={bulkForm[field.key] ?? ''}
                        onChange={(e) => setBulkField(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-blue-600 text-gray-700"
                      />
                    )}
                    {field.type === 'date' && (
                      <input
                        type="date"
                        value={(bulkForm[field.key] ?? '')?.slice(0, 10)}
                        onChange={(e) => setBulkField(field.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-blue-600 text-gray-700"
                      />
                    )}
                    {field.type === 'motivo_baja' && (
                      <select
                        value={bulkForm.motivo_baja ?? ''}
                        onChange={(e) => setBulkField('motivo_baja', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white text-gray-700"
                      >
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
                <button
                  onClick={closeBulkModal}
                  disabled={isSavingBulk}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveBulkModal}
                  disabled={isSavingBulk}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-2"
                >
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
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra de acciones de selección */}
      {selectedItems.length > 0 && !isBulkModalOpen && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex items-center gap-3">
            <span className="text-sm text-gray-700">
              <strong>{selectedItems.length}</strong> seleccionado(s)
            </span>
            <button
              onClick={openBulkModal}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar Seleccionados
            </button>
            <button
              onClick={() => setSelectedItems([])}
              className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
              title="Deseleccionar"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
