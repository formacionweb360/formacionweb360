// src/pages/FormadorAsistencia.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

// Opciones para los campos de asistencia (día 1-6)
const OPCIONES_ASISTENCIA = [
  "ASISTIÓ",
  "FALTA",
  "DESERTÓ",
  "TARDANZA",
  "NO SE PRESENTÓ",
  "RETIRADO",
  "NO APROBO ROLE PLAY"
];

// Opciones para segmento (prefiltro y certificado)
const OPCIONES_SEGMENTO = ["A", "B", "C"];

// Opciones para certifica
const OPCIONES_CERTIFICA = ["SI", "NO"];

// Opciones para motivo de baja
const OPCIONES_MOTIVO_BAJA = {
  "← DESERCIÓN →": [
    "DISTANCIA AL SITE",
    "ENFERMEDAD FAMILIAR",
    "ENFERMEDAD PROPIA",
    "HORARIOS",
    "MEJOR OFERTA LABORAL",
    "MOTIVOS PERSONALES - NO ESPECIFICA",
    "NO LE GUSTA EL PRODUCTO",
    "NO ES LO QUE DESEA",
    "SIN RESPUESTA"
  ],
  "← RETIRO →": [
    "USUARIOS BLOQUEADOS",
    "NO TIENE HABILIDAD COMERCIAL",
    "PROBLEMAS DE ACTITUD",
    "BLACK LIST SALESLAND"
  ]
};

export default function FormadorAsistencia({ user, onLogout }) {
  // Estados principales
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  
  // Filtros
  const [filtroCampana, setFiltroCampana] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroSegmento, setFiltroSegmento] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  
  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const REGISTROS_POR_PAGINA = 15;
  
  // Edición por fila
  const [filaEditando, setFilaEditando] = useState(null);
  const [valoresEditables, setValoresEditables] = useState({});
  
  // Listas para filtros dinámicos
  const [campanasUnicas, setCampanasUnicas] = useState([]);
  const [gruposUnicos, setGruposUnicos] = useState([]);
  
  const fechaHoyFormateada = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Cargar datos al montar
  useEffect(() => {
    cargarRegistros();
    cargarFiltrosDinamicos();
  }, []);

  // Mostrar mensaje temporal
  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  // Cargar registros de formacion_seguimiento
  const cargarRegistros = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("formacion_seguimiento")
        .select(`
          id,
          dni,
          nombre,
          campaña,
          grupo_nombre,
          estado,
          fecha_inicio,
          fecha_termino,
          segmento_prefiltro,
          dia_1,
          dia_2,
          dia_3,
          dia_4,
          dia_5,
          dia_6,
          certifica,
          segmento_certificado,
          fecha_baja,
          motivo_baja,
          created_at,
          updated_at
        `)
        .order("nombre", { ascending: true });
      
      if (error) throw error;
      setRegistros(data || []);
    } catch (err) {
      console.error("Error al cargar registros:", err);
      mostrarMensaje("error", "❌ Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  // Cargar valores únicos para filtros
  const cargarFiltrosDinamicos = async () => {
    try {
      // Campañas únicas
      const { data: campanas } = await supabase
        .from("formacion_seguimiento")
        .select("campaña")
        .not("campaña", "is", null);
      if (campanas) {
        const unicas = [...new Set(campanas.map(c => c.campaña).filter(Boolean))].sort();
        setCampanasUnicas(unicas);
      }
      
      // Grupos únicos
      const { data: grupos } = await supabase
        .from("formacion_seguimiento")
        .select("grupo_nombre")
        .not("grupo_nombre", "is", null);
      if (grupos) {
        const unicos = [...new Set(grupos.map(g => g.grupo_nombre).filter(Boolean))].sort();
        setGruposUnicos(unicos);
      }
    } catch (err) {
      console.error("Error al cargar filtros:", err);
    }
  };

  // Actualizar un campo específico de un registro
  const actualizarCampo = async (registroId, campo, valor) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("formacion_seguimiento")
        .update({ [campo]: valor === "" ? null : valor })
        .eq("id", registroId);
      
      if (error) throw error;
      
      // Actualizar estado local
      setRegistros(prev =>
        prev.map(r =>
          r.id === registroId ? { ...r, [campo]: valor } : r
        )
      );
      
      mostrarMensaje("success", "✅ Actualizado");
    } catch (err) {
      console.error("Error al actualizar:", err);
      mostrarMensaje("error", "❌ Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  // Iniciar edición de fila completa
  const iniciarEdicion = (registro) => {
    const campos = {};
    // Días 1-6
    for (let i = 1; i <= 6; i++) {
      campos[`dia_${i}`] = registro[`dia_${i}`] || "";
    }
    // Otros campos editables
    campos.segmento_prefiltro = registro.segmento_prefiltro || "";
    campos.certifica = registro.certifica || "";
    campos.segmento_certificado = registro.segmento_certificado || "";
    campos.fecha_baja = registro.fecha_baja || "";
    campos.motivo_baja = registro.motivo_baja || "";
    
    setValoresEditables(campos);
    setFilaEditando(registro.id);
  };

  // Cancelar edición
  const cancelarEdicion = () => {
    setFilaEditando(null);
    setValoresEditables({});
  };

  // Guardar cambios de fila completa
  const guardarCambiosFila = async (registroId) => {
    setLoading(true);
    try {
      const cambios = {};
      
      // Procesar días 1-6
      for (let i = 1; i <= 6; i++) {
        const key = `dia_${i}`;
        if (valoresEditables[key] !== undefined) {
          cambios[key] = valoresEditables[key] === "" ? null : valoresEditables[key];
        }
      }
      
      // Procesar otros campos
      const otrosCampos = ['segmento_prefiltro', 'certifica', 'segmento_certificado', 'fecha_baja', 'motivo_baja'];
      otrosCampos.forEach(campo => {
        if (valoresEditables[campo] !== undefined) {
          cambios[campo] = valoresEditables[campo] === "" ? null : valoresEditables[campo];
        }
      });
      
      const { error } = await supabase
        .from("formacion_seguimiento")
        .update(cambios)
        .eq("id", registroId);
      
      if (error) throw error;
      
      // Actualizar estado local
      setRegistros(prev =>
        prev.map(r => r.id === registroId ? { ...r, ...cambios } : r)
      );
      
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

  // Manejar cambio en input de edición
  const handleInputChange = (campo, valor) => {
    setValoresEditables(prev => ({ ...prev, [campo]: valor }));
  };

  // Renderizar badge de asistencia
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
    return (
      <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
        {icon}
      </span>
    );
  };

  // Renderizar badge de estado
  const renderBadgeEstado = (estado) => {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
        estado === 'Activo' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
      }`}>
        {estado || 'Inactivo'}
      </span>
    );
  };

  // Filtrar y paginar registros
  const { registrosPaginados, totalPaginas, totalFiltrados } = useMemo(() => {
    let filtrados = [...registros];
    
    if (filtroCampana) {
      filtrados = filtrados.filter(r => r.campaña === filtroCampana);
    }
    if (filtroGrupo !== "todos") {
      filtrados = filtrados.filter(r => r.grupo_nombre === filtroGrupo);
    }
    if (filtroEstado !== "todos") {
      filtrados = filtrados.filter(r => r.estado === filtroEstado);
    }
    if (filtroSegmento !== "todos") {
      filtrados = filtrados.filter(r => r.segmento_prefiltro === filtroSegmento);
    }
    if (busqueda.trim() !== "") {
      const termino = busqueda.toLowerCase().trim();
      filtrados = filtrados.filter(r =>
        (r.nombre && r.nombre.toLowerCase().includes(termino)) ||
        (r.dni && r.dni.toLowerCase().includes(termino))
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
      "DNI", "Nombre", "Campaña", "Grupo", "Estado", "Fecha Inicio", "Fecha Término",
      "Segmento Prefiltro", "Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6",
      "Certifica", "Segmento Certificado", "Fecha Baja", "Motivo Baja"
    ];
    
    const csvRows = [headers.join(",")];
    
    registrosPaginados.forEach(r => {
      const row = [
        `"${r.dni || ''}"`,
        `"${r.nombre || ''}"`,
        r.campaña || '',
        r.grupo_nombre || '',
        r.estado || '',
        r.fecha_inicio || '',
        r.fecha_termino || '',
        r.segmento_prefiltro || '',
        r.dia_1 || '',
        r.dia_2 || '',
        r.dia_3 || '',
        r.dia_4 || '',
        r.dia_5 || '',
        r.dia_6 || '',
        r.certifica || '',
        r.segmento_certificado || '',
        r.fecha_baja || '',
        `"${r.motivo_baja || ''}"`
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

  // Actualizar estado del registro (Activo/Inactivo)
  const toggleEstadoRegistro = async (registroId, estadoActual) => {
    const nuevoEstado = estadoActual === 'Activo' ? 'Inactivo' : 'Activo';
    setLoading(true);
    try {
      const { error } = await supabase
        .from("formacion_seguimiento")
        .update({ estado: nuevoEstado })
        .eq("id", registroId);
      
      if (error) throw error;
      
      setRegistros(prev =>
        prev.map(r => r.id === registroId ? { ...r, estado: nuevoEstado } : r)
      );
      mostrarMensaje("success", `✅ Estado cambiado a ${nuevoEstado}`);
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      mostrarMensaje("error", "❌ Error al cambiar estado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-teal-900 overflow-hidden">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-600 via-blue-900 to-teal-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Seguimiento de Formación</h1>
            <p className="text-xs text-blue-200">📅 {fechaHoyFormateada}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-blue-100">
              <span className="w-2 h-2 bg-teal-300 rounded-full animate-pulse"></span>
              <span>{user?.name || "Formador"}</span>
            </div>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold bg-white/10 border border-white/30 text-white rounded-lg hover:bg-white/20 transition"
            >
              Cerrar sesión
            </button>
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
        
        {/* Barra de acciones y filtros */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl shadow-purple-500/5 p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-semibold text-xl text-white flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 p-2 rounded-lg border border-blue-500/30">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
              Gestión de Asistencia y Seguimiento
            </h2>
            <button
              onClick={descargarCSV}
              disabled={loading || totalFiltrados === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar CSV ({totalFiltrados})
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Campaña</label>
              <select
                value={filtroCampana}
                onChange={(e) => {
                  setFiltroCampana(e.target.value);
                  setPaginaActual(1);
                }}
                className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              >
                <option value="">Todas</option>
                {campanasUnicas.map(c => (
                  <option key={c} value={c} className="bg-slate-800">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Grupo</label>
              <select
                value={filtroGrupo}
                onChange={(e) => {
                  setFiltroGrupo(e.target.value);
                  setPaginaActual(1);
                }}
                className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              >
                <option value="todos" className="bg-slate-800">Todos</option>
                {gruposUnicos.map(g => (
                  <option key={g} value={g} className="bg-slate-800">{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => {
                  setFiltroEstado(e.target.value);
                  setPaginaActual(1);
                }}
                className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              >
                <option value="todos" className="bg-slate-800">Todos</option>
                <option value="Activo" className="bg-slate-800">Activo</option>
                <option value="Inactivo" className="bg-slate-800">Inactivo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Segmento</label>
              <select
                value={filtroSegmento}
                onChange={(e) => {
                  setFiltroSegmento(e.target.value);
                  setPaginaActual(1);
                }}
                className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              >
                <option value="todos" className="bg-slate-800">Todos</option>
                {OPCIONES_SEGMENTO.map(s => (
                  <option key={s} value={s} className="bg-slate-800">{s}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs font-medium text-gray-300 mb-1">Buscar por nombre o DNI</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPaginaActual(1);
                }}
                placeholder="Ej: Juan Pérez o 75834921"
                className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-400 focus:border-transparent placeholder-gray-400"
              />
            </div>
            <button
              onClick={() => {
                setFiltroCampana("");
                setFiltroGrupo("todos");
                setFiltroEstado("todos");
                setFiltroSegmento("todos");
                setBusqueda("");
                setPaginaActual(1);
              }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-300 hover:bg-white/10 transition"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Tabla de Registros */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl shadow-purple-500/5 p-6">
          {loading && !registros.length ? (
            <div className="text-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-gray-400 text-xs">Cargando registros...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">DNI</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Nombre</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Campaña</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Grupo</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Seg. Prefiltro</th>
                      {[1,2,3,4,5,6].map(d => (
                        <th key={d} className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Día {d}</th>
                      ))}
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Certifica</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Seg. Certificado</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Fecha Baja</th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-300 uppercase tracking-wider">Motivo Baja</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-300 uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {registrosPaginados.length > 0 ? (
                      registrosPaginados.map((r) => (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                          {/* DNI */}
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-100 font-mono">{r.dni}</td>
                          
                          {/* Nombre */}
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-100">{r.nombre}</td>
                          
                          {/* Campaña */}
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">{r.campaña || '-'}</td>
                          
                          {/* Grupo */}
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">{r.grupo_nombre || '-'}</td>
                          
                          {/* Estado */}
                          <td className="px-2 py-2 whitespace-nowrap">
                            {renderBadgeEstado(r.estado)}
                          </td>
                          
                          {/* Segmento Prefiltro */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables.segmento_prefiltro || ""}
                                onChange={(e) => handleInputChange("segmento_prefiltro", e.target.value)}
                                className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400"
                              >
                                <option value="">—</option>
                                {OPCIONES_SEGMENTO.map(op => (
                                  <option key={op} value={op} className="bg-slate-800">{op}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-300 text-xs">{r.segmento_prefiltro || "—"}</span>
                            )}
                          </td>
                          
                          {/* Días 1-6 */}
                          {[1,2,3,4,5,6].map(d => {
                            const key = `dia_${d}`;
                            const esEditable = filaEditando === r.id;
                            return (
                              <td key={key} className="px-2 py-2 whitespace-nowrap text-center">
                                {esEditable ? (
                                  <select
                                    value={valoresEditables[key] || ""}
                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400"
                                  >
                                    <option value="">—</option>
                                    {OPCIONES_ASISTENCIA.map(op => (
                                      <option key={op} value={op} className="bg-slate-800">{op}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="flex justify-center">
                                    {renderBadgeAsistencia(r[key])}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          
                          {/* Certifica */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables.certifica || ""}
                                onChange={(e) => handleInputChange("certifica", e.target.value)}
                                className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400"
                              >
                                <option value="">—</option>
                                {OPCIONES_CERTIFICA.map(op => (
                                  <option key={op} value={op} className="bg-slate-800">{op}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`text-xs font-medium ${
                                r.certifica === 'SI' ? 'text-green-400' : 
                                r.certifica === 'NO' ? 'text-red-400' : 'text-gray-500'
                              }`}>
                                {r.certifica || "—"}
                              </span>
                            )}
                          </td>
                          
                          {/* Segmento Certificado */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables.segmento_certificado || ""}
                                onChange={(e) => handleInputChange("segmento_certificado", e.target.value)}
                                className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400"
                              >
                                <option value="">—</option>
                                {OPCIONES_SEGMENTO.map(op => (
                                  <option key={op} value={op} className="bg-slate-800">{op}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-300 text-xs">{r.segmento_certificado || "—"}</span>
                            )}
                          </td>
                          
                          {/* Fecha Baja */}
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            {filaEditando === r.id ? (
                              <input
                                type="date"
                                value={valoresEditables.fecha_baja || ""}
                                onChange={(e) => handleInputChange("fecha_baja", e.target.value)}
                                className="w-full bg-white/10 border border-white/20 text-white text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400"
                              />
                            ) : (
                              <span className="text-gray-300 text-xs">
                                {r.fecha_baja ? new Date(r.fecha_baja).toLocaleDateString('es-PE') : "—"}
                              </span>
                            )}
                          </td>
                          
                          {/* Motivo Baja */}
                          <td className="px-2 py-2 whitespace-nowrap text-center max-w-[150px]">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables.motivo_baja || ""}
                                onChange={(e) => handleInputChange("motivo_baja", e.target.value)}
                                className="w-full bg-white border border-gray-300 text-gray-800 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-purple-400"
                              >
                                <option value="">— Seleccionar —</option>
                                {Object.entries(OPCIONES_MOTIVO_BAJA).map(([grupo, motivos]) => (
                                  <optgroup key={grupo} label={grupo}>
                                    {motivos.map(motivo => (
                                      <option key={motivo} value={motivo}>{motivo}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-300 text-xs truncate block" title={r.motivo_baja}>
                                {r.motivo_baja || "—"}
                              </span>
                            )}
                          </td>
                          
                          {/* Acciones */}
                          <td className="px-2 py-2 whitespace-nowrap">
                            {filaEditando === r.id ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => guardarCambiosFila(r.id)}
                                  disabled={loading}
                                  className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px] hover:bg-green-500/30 disabled:opacity-50"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={cancelarEdicion}
                                  className="px-1.5 py-0.5 bg-gray-500/20 text-gray-300 rounded text-[10px] hover:bg-gray-500/30"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => iniciarEdicion(r)}
                                  className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] hover:bg-blue-500/30"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => toggleEstadoRegistro(r.id, r.estado)}
                                  disabled={loading}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                    r.estado === 'Activo'
                                      ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                      : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
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
                        <td colSpan="18" className="px-4 py-6 text-center text-gray-400 text-xs">
                          No se encontraron registros con esos filtros.
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
                    className="px-3 py-1.5 bg-white/10 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition"
                  >
                    ← Anterior
                  </button>
                  <span className="text-gray-300 text-xs">Página {paginaActual} de {totalPaginas}</span>
                  <button
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas || loading}
                    className="px-3 py-1.5 bg-white/10 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
