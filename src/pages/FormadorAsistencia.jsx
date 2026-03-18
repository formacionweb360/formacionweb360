import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const OPCIONES_ASISTENCIA = [
  "ASISTIÓ", "FALTA", "DESERTÓ", "TARDANZA",
  "NO SE PRESENTÓ", "RETIRADO", "NO APROBO ROLE PLAY", "INYECTADO"
];

const OPCIONES_SEGMENTO = ["A", "B", "C"];
const OPCIONES_CERTIFICA = ["SI", "NO"];

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

const BULK_FIELDS = [
  { key: "estado", label: "Estado", type: "select", options: ["Activo", "Inactivo"] },
  { key: "segmento_prefiltro", label: "Segmento Prefiltro", type: "select", options: OPCIONES_SEGMENTO },
  { key: "certifica", label: "Certifica", type: "select", options: OPCIONES_CERTIFICA },
  { key: "segmento_certificado", label: "Segmento Certificado", type: "select", options: OPCIONES_SEGMENTO },
  { key: "fecha_baja", label: "Fecha Baja", type: "date" },
  { key: "motivo_baja", label: "Motivo Baja", type: "motivo_baja" },
  { key: "telefono", label: "Teléfono", type: "text" },
  ...[1, 2, 3, 4, 5, 6, 7].map((d) => ({
    key: `dia_${d}`,
    label: `Día ${d}`,
    type: "select",
    options: OPCIONES_ASISTENCIA
  }))
];

const formatearFecha = (fechaString) => {
  if (!fechaString) return "—";
  let fecha;
  if (fechaString.includes("-")) {
    const [y, m, d] = fechaString.split("-");
    fecha = new Date(y, m - 1, d);
  } else if (fechaString.includes("/")) {
    const [d, m, y] = fechaString.split("/");
    fecha = new Date(y, m - 1, d);
  } else fecha = new Date(fechaString);
  return isNaN(fecha.getTime()) ? "—" : fecha.toLocaleDateString("es-PE");
};

const formatearTelefono = (t) => {
  if (!t) return "—";
  const n = String(t).replace(/\D/g, "");
  return n.length === 9 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : t;
};

export default function FormadorAsistencia({ user, onLogout }) {
  const navigate = useNavigate();

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  const [filtroCampana, setFiltroCampana] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroSegmento, setFiltroSegmento] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  const [paginaActual, setPaginaActual] = useState(1);
  const REGISTROS_POR_PAGINA = 15;

  const [filaEditando, setFilaEditando] = useState(null);
  const [valoresEditables, setValoresEditables] = useState({});

  const [campanasUnicas, setCampanasUnicas] = useState([]);
  const [gruposUnicos, setGruposUnicos] = useState([]);
  const [gruposPorCampana, setGruposPorCampana] = useState({});

  const [selectedItems, setSelectedItems] = useState([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(() => Object.fromEntries(BULK_FIELDS.map((f) => [f.key, ""])));
  const [bulkApply, setBulkApply] = useState(() => Object.fromEntries(BULK_FIELDS.map((f) => [f.key, false])));
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const fechaHoyFormateada = new Date().toLocaleDateString("es-PE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  useEffect(() => {
    cargarRegistros();
    cargarFiltrosDinamicos();
  }, []);

  useEffect(() => setFiltroGrupo("todos"), [filtroCampana]);

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  const cargarRegistros = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("formacion_seguimiento")
        .select(`
          id, dni, nombre, campaña, grupo_nombre, estado, fecha_inicio,
          fecha_termino, segmento_prefiltro, dia_1, dia_2, dia_3, dia_4,
          dia_5, dia_6, dia_7, certifica, segmento_certificado, fecha_baja,
          motivo_baja, telefono, created_at, updated_at
        `)
        .range(0, 9999)
        .order("nombre", { ascending: true });

      if (error) throw error;
      setRegistros(data || []);
    } catch (err) {
      mostrarMensaje("error", "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const cargarFiltrosDinamicos = async () => {
    try {
      const { data: campanas } = await supabase
        .from("formacion_seguimiento")
        .select("campaña")
        .range(0, 9999);

      setCampanasUnicas(
        [...new Set(campanas.map((c) => c.campaña).filter(Boolean))].sort()
      );

      const { data: grupos } = await supabase
        .from("formacion_seguimiento")
        .select("campaña, grupo_nombre")
        .range(0, 9999);

      const map = {};
      grupos.forEach((g) => {
        const camp = g.campaña?.trim();
        const grp = g.grupo_nombre?.trim();
        if (!camp || !grp) return;
        if (!map[camp]) map[camp] = [];
        if (!map[camp].includes(grp)) map[camp].push(grp);
      });

      Object.keys(map).forEach((c) => map[c].sort());
      setGruposPorCampana(map);
      setGruposUnicos([...new Set(grupos.map((g) => g.grupo_nombre).filter(Boolean))].sort());
    } catch (err) {}
  };
  const getGruposDisponibles = () => {
    if (filtroCampana && gruposPorCampana[filtroCampana]) {
      return gruposPorCampana[filtroCampana];
    }
    return gruposUnicos;
  };

  const openBulkModal = () => {
    if (selectedItems.length === 0) {
      mostrarMensaje("warning", "Selecciona al menos un registro");
      return;
    }
    setBulkForm(Object.fromEntries(BULK_FIELDS.map((f) => [f.key, ""])));
    setBulkApply(Object.fromEntries(BULK_FIELDS.map((f) => [f.key, false])));
    setIsBulkModalOpen(true);
  };

  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setSelectedItems([]);
  };

  const setBulkField = (key, value) =>
    setBulkForm((prev) => ({ ...prev, [key]: value }));

  const toggleBulkApply = (key, checked) =>
    setBulkApply((prev) => ({ ...prev, [key]: checked }));

  const saveBulkModal = async () => {
    const aplicar = Object.entries(bulkApply).filter(([, v]) => v);
    if (aplicar.length === 0) {
      mostrarMensaje("warning", "Activa al menos un campo para aplicar");
      return;
    }
    setIsSavingBulk(true);
    try {
      const payload = {};
      BULK_FIELDS.forEach((f) => {
        if (bulkApply[f.key]) {
          const v = bulkForm[f.key];
          payload[f.key] = v === "" ? null : v;
        }
      });

      const { error } = await supabase
        .from("formacion_seguimiento")
        .update(payload)
        .in("id", selectedItems);

      if (error) throw error;

      setRegistros((prev) =>
        prev.map((r) =>
          selectedItems.includes(r.id) ? { ...r, ...payload } : r
        )
      );

      mostrarMensaje("success", "Cambios aplicados");
      closeBulkModal();
      cargarRegistros();
    } catch (err) {
      mostrarMensaje("error", "Error guardando cambios");
    } finally {
      setIsSavingBulk(false);
    }
  };

  const iniciarEdicion = (r) => {
    const campos = {};
    for (let i = 1; i <= 7; i++) campos[`dia_${i}`] = r[`dia_${i}`] || "";
    campos.segmento_prefiltro = r.segmento_prefiltro || "";
    campos.certifica = r.certifica || "";
    campos.segmento_certificado = r.segmento_certificado || "";
    campos.fecha_baja = r.fecha_baja || "";
    campos.motivo_baja = r.motivo_baja || "";
    campos.telefono = r.telefono || "";
    setValoresEditables(campos);
    setFilaEditando(r.id);
  };

  const cancelarEdicion = () => {
    setFilaEditando(null);
    setValoresEditables({});
  };

  const handleInputChange = (campo, valor) =>
    setValoresEditables((prev) => ({ ...prev, [campo]: valor }));

  const guardarCambiosFila = async (id) => {
    setLoading(true);
    try {
      const cambios = {};
      for (let i = 1; i <= 7; i++) {
        const key = `dia_${i}`;
        cambios[key] = valoresEditables[key] || null;
      }
      [
        "segmento_prefiltro",
        "certifica",
        "segmento_certificado",
        "fecha_baja",
        "motivo_baja",
        "telefono",
      ].forEach((c) => {
        cambios[c] = valoresEditables[c] || null;
      });

      const { error } = await supabase
        .from("formacion_seguimiento")
        .update(cambios)
        .eq("id", id);

      if (error) throw error;

      setRegistros((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...cambios } : r))
      );
      cancelarEdicion();
      mostrarMensaje("success", "Guardado");
    } catch (err) {
      mostrarMensaje("error", "Error guardando");
    } finally {
      setLoading(false);
    }
  };

  const renderBadgeAsistencia = (estado) => {
    if (!estado)
      return <span className="text-gray-400 text-xs">—</span>;
    const map = {
      ASISTIÓ: "✔️",
      FALTA: "✖️",
      DESERTÓ: "🚪",
      TARDANZA: "⏱️",
      "NO SE PRESENTÓ": "🕳️",
      RETIRADO: "🚶‍♂️",
      "NO APROBO ROLE PLAY": "📉",
      INYECTADO: "💉",
    };
    return (
      <span className="inline-flex px-1.5 py-0.5 text-[10px]">
        {map[estado] || "?"}
      </span>
    );
  };

  const renderBadgeEstado = (estado) => (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${
        estado === "Activo"
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-red-50 text-red-700 border-red-200"
      }`}
    >
      {estado || "Inactivo"}
    </span>
  );

  const { registrosPaginados, totalPaginas, totalFiltrados } = useMemo(() => {
    let lista = [...registros];

    if (filtroCampana)
      lista = lista.filter((r) => r.campaña === filtroCampana);
    if (filtroGrupo !== "todos")
      lista = lista.filter((r) => r.grupo_nombre === filtroGrupo);
    if (filtroEstado !== "todos")
      lista = lista.filter((r) => r.estado === filtroEstado);
    if (filtroSegmento !== "todos")
      lista = lista.filter((r) => r.segmento_prefiltro === filtroSegmento);

    if (busqueda.trim()) {
      const s = busqueda.toLowerCase().trim();
      lista = lista.filter(
        (r) =>
          r.nombre?.toLowerCase().includes(s) ||
          String(r.dni).includes(s)
      );
    }

    const total = lista.length;
    const desde = (paginaActual - 1) * REGISTROS_POR_PAGINA;
    const hasta = desde + REGISTROS_POR_PAGINA;

    return {
      registrosPaginados: lista.slice(desde, hasta),
      totalPaginas: Math.ceil(total / REGISTROS_POR_PAGINA),
      totalFiltrados: total,
    };
  }, [
    registros,
    filtroCampana,
    filtroGrupo,
    filtroEstado,
    filtroSegmento,
    busqueda,
    paginaActual,
  ]);

  const descargarCSV = () => {
    const rows = registrosPaginados;
    if (rows.length === 0) {
      mostrarMensaje("warning", "No hay datos");
      return;
    }

    const headers = [
      "DNI","Nombre","Campaña","Grupo","Estado","Teléfono",
      "Fecha Inicio","Fecha Término","Segmento Prefiltro",
      "Día 1","Día 2","Día 3","Día 4","Día 5","Día 6","Día 7",
      "Certifica","Segmento Certificado","Fecha Baja","Motivo Baja"
    ];

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.dni, r.nombre, r.campaña, r.grupo_nombre, r.estado,
          r.telefono, r.fecha_inicio, r.fecha_termino, r.segmento_prefiltro,
          r.dia_1, r.dia_2, r.dia_3, r.dia_4, r.dia_5, r.dia_6, r.dia_7,
          r.certifica, r.segmento_certificado, r.fecha_baja,
          r.motivo_baja
        ]
          .map((v) => `"${v || ""}"`)
          .join(",")
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `formacion_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const toggleEstadoRegistro = async (id, estado) => {
    const nuevo = estado === "Activo" ? "Inactivo" : "Activo";
    setLoading(true);
    try {
      const { error } = await supabase
        .from("formacion_seguimiento")
        .update({ estado: nuevo })
        .eq("id", id);

      if (error) throw error;

      setRegistros((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado: nuevo } : r))
      );
      mostrarMensaje("success", "Estado actualizado");
    } catch (err) {
      mostrarMensaje("error", "No se pudo cambiar el estado");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = (checked) => {
    setSelectedItems(
      checked ? registrosPaginados.map((r) => r.id) : []
    );
  };

  const handleSelectItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };
  return (
    <div className="min-h-screen bg-[#F7F8FA] overflow-hidden">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/formador")}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
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
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {mensaje.texto && (
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 pt-4">
          <div
            className={`p-3 rounded-md border-l-4 ${
              mensaje.tipo === "success"
                ? "bg-green-50 border-green-500 text-green-800"
                : mensaje.tipo === "error"
                ? "bg-red-50 border-red-500 text-red-800"
                : "bg-blue-50 border-blue-500 text-blue-800"
            }`}
          >
            <p className="text-sm">{mensaje.texto}</p>
          </div>
        </div>
      )}

      <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
              <span className="text-blue-600">📋</span> Gestión de Asistencia y Seguimiento
            </h2>

            <button
              onClick={descargarCSV}
              disabled={loading || totalFiltrados === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Descargar CSV ({totalFiltrados})
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-700 mb-1">Campaña</label>
              <select
                value={filtroCampana}
                onChange={(e) => {
                  setFiltroCampana(e.target.value);
                  setPaginaActual(1);
                }}
                className="border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="">Todas</option>
                {campanasUnicas.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Grupo</label>
              <select
                value={filtroGrupo}
                onChange={(e) => {
                  setFiltroGrupo(e.target.value);
                  setPaginaActual(1);
                }}
                className="border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="todos">Todos</option>
                {getGruposDisponibles().map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => {
                  setFiltroEstado(e.target.value);
                  setPaginaActual(1);
                }}
                className="border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="todos">Todos</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Segmento</label>
              <select
                value={filtroSegmento}
                onChange={(e) => {
                  setFiltroSegmento(e.target.value);
                  setPaginaActual(1);
                }}
                className="border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="todos">Todos</option>
                {OPCIONES_SEGMENTO.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs text-gray-700 mb-1">Buscar</label>
              <input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPaginaActual(1);
                }}
                className="border-gray-300 w-full rounded-lg px-2 py-1.5 text-xs"
                placeholder="Nombre o DNI"
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
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedItems.length === registrosPaginados.length &&
                        registrosPaginados.length > 0
                      }
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                  </th>
                  <th className="px-2 py-2">DNI</th>
                  <th className="px-2 py-2">Nombre</th>
                  <th className="px-2 py-2">Campaña</th>
                  <th className="px-2 py-2">Grupo</th>
                  <th className="px-2 py-2">Estado</th>
                  <th className="px-2 py-2 text-center">Seg. Prefiltro</th>

                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <th key={d} className="px-2 py-2 text-center">Día {d}</th>
                  ))}

                  <th className="px-2 py-2 text-center">Certifica</th>
                  <th className="px-2 py-2 text-center">Seg. Certificado</th>
                  <th className="px-2 py-2 text-center">Fecha Baja</th>
                  <th className="px-2 py-2 text-center">Motivo Baja</th>
                  <th className="px-2 py-2 text-center">Teléfono</th>
                  <th className="px-2 py-2">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {registrosPaginados.length === 0 ? (
                  <tr>
                    <td colSpan="21" className="text-center py-6 text-gray-500">
                      No hay registros
                    </td>
                  </tr>
                ) : (
                  registrosPaginados.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(r.id)}
                          onChange={() => handleSelectItem(r.id)}
                          className="h-3.5 w-3.5"
                        />
                      </td>

                      <td className="px-2 py-2">{r.dni}</td>
                      <td className="px-2 py-2">{r.nombre}</td>
                      <td className="px-2 py-2">{r.campaña}</td>
                      <td className="px-2 py-2">{r.grupo_nombre}</td>
                      <td className="px-2 py-2">{renderBadgeEstado(r.estado)}</td>

                      <td className="px-2 py-2 text-center">
                        {filaEditando === r.id ? (
                          <select
                            value={valoresEditables.segmento_prefiltro}
                            onChange={(e) =>
                              handleInputChange("segmento_prefiltro", e.target.value)
                            }
                            className="border-gray-300 rounded px-1 py-0.5 text-[10px]"
                          >
                            <option value="">—</option>
                            {OPCIONES_SEGMENTO.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          r.segmento_prefiltro || "—"
                        )}
                      </td>

                      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                        const key = `dia_${d}`;
                        return (
                          <td key={key} className="px-2 py-2 text-center">
                            {filaEditando === r.id ? (
                              <select
                                value={valoresEditables[key]}
                                onChange={(e) =>
                                  handleInputChange(key, e.target.value)
                                }
                                className="border-gray-300 rounded px-1 py-0.5 text-[10px]"
                              >
                                <option value="">—</option>
                                {OPCIONES_ASISTENCIA.map((o) => (
                                  <option key={o}>{o}</option>
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

                      <td className="px-2 py-2 text-center">
                        {filaEditando === r.id ? (
                          <select
                            value={valoresEditables.certifica}
                            onChange={(e) =>
                              handleInputChange("certifica", e.target.value)
                            }
                            className="border-gray-300 rounded px-1 py-0.5 text-[10px]"
                          >
                            <option value="">—</option>
                            {OPCIONES_CERTIFICA.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          r.certifica || "—"
                        )}
                      </td>

                      <td className="px-2 py-2 text-center">
                        {filaEditando === r.id ? (
                          <select
                            value={valoresEditables.segmento_certificado}
                            onChange={(e) =>
                              handleInputChange("segmento_certificado", e.target.value)
                            }
                            className="border-gray-300 rounded px-1 py-0.5 text-[10px]"
                          >
                            <option value="">—</option>
                            {OPCIONES_SEGMENTO.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          r.segmento_certificado || "—"
                        )}
                      </td>

                      <td className="px-2 py-2 text-center">
                        {filaEditando === r.id ? (
                          <input
                            type="date"
                            value={valoresEditables.fecha_baja || ""}
                            onChange={(e) =>
                              handleInputChange("fecha_baja", e.target.value)
                            }
                            className="border-gray-300 rounded px-1 py-0.5 text-[10px]"
                          />
                        ) : (
                          formatearFecha(r.fecha_baja)
                        )}
                      </td>

                      <td className="px-2 py-2 text-center">
                        {filaEditando === r.id ? (
                          <select
                            value={valoresEditables.motivo_baja}
                            onChange={(e) =>
                              handleInputChange("motivo_baja", e.target.value)
                            }
                            className="border-gray-300 rounded px-1 py-0.5 text-[10px]"
                          >
                            <option value="">—</option>
                            {Object.entries(OPCIONES_MOTIVO_BAJA).map(([grupo, opts]) => (
                              <optgroup key={grupo} label={grupo}>
                                {opts.map((o) => (
                                  <option key={o}>{o}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        ) : (
                          r.motivo_baja || "—"
                        )}
                      </td>

                      <td className="px-2 py-2 text-center">
                        {filaEditando === r.id ? (
                          <input
                            value={valoresEditables.telefono}
                            onChange={(e) =>
                              handleInputChange("telefono", e.target.value)
                            }
                            className="border-gray-300 rounded px-1 py-0.5 text-[10px]"
                          />
                        ) : (
                          formatearTelefono(r.telefono)
                        )}
                      </td>

                      <td className="px-2 py-2">
                        {filaEditando === r.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => guardarCambiosFila(r.id)}
                              className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={cancelarEdicion}
                              className="px-2 py-1 border border-gray-300 text-[10px] rounded"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => iniciarEdicion(r)}
                              className="px-2 py-1 border border-gray-300 text-[10px] rounded"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => toggleEstadoRegistro(r.id, r.estado)}
                              className={`px-2 py-1 text-[10px] rounded border ${
                                r.estado === "Activo"
                                  ? "border-red-300 text-red-700"
                                  : "border-green-300 text-green-700"
                              }`}
                            >
                              {r.estado === "Activo" ? "Inact." : "Activo"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs disabled:opacity-50"
              >
                ← Anterior
              </button>

              <span className="text-xs text-gray-700">
                Página {paginaActual} de {totalPaginas}
              </span>

              <button
                onClick={() =>
                  setPaginaActual((p) => Math.min(totalPaginas, p + 1))
                }
                disabled={paginaActual === totalPaginas}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs disabled:opacity-50"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </div>

      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          <div onClick={closeBulkModal} className="absolute inset-0 bg-black/50" />

          <div className="relative w-full md:max-w-4xl bg-white rounded-t-2xl md:rounded-2xl border shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 flex justify-between border-b">
              <h3 className="font-semibold">
                Edición Masiva • {selectedItems.length} seleccionados
              </h3>
              <button onClick={closeBulkModal}>✕</button>
            </div>

            <div className="px-4 py-2 text-[11px] text-gray-600 border-b">
              Marca “Aplicar” para cada campo que desees modificar.
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto flex-1">
              {BULK_FIELDS.map((f) => (
                <div
                  key={f.key}
                  className="flex items-start gap-2 p-2 border rounded-lg"
                >
                  <input
                    type="checkbox"
                    checked={bulkApply[f.key]}
                    onChange={(e) => toggleBulkApply(f.key, e.target.checked)}
                    className="mt-1"
                  />

                  <div className="flex-1">
                    <label className="block text-[11px] mb-1">{f.label}</label>

                    {f.type === "select" && (
                      <select
                        value={bulkForm[f.key]}
                        onChange={(e) => setBulkField(f.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border rounded"
                      >
                        <option value="">—</option>
                        {f.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    )}

                    {f.type === "text" && (
                      <input
                        value={bulkForm[f.key]}
                        onChange={(e) => setBulkField(f.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border rounded"
                      />
                    )}

                    {f.type === "date" && (
                      <input
                        type="date"
                        value={bulkForm[f.key] || ""}
                        onChange={(e) => setBulkField(f.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border rounded"
                      />
                    )}

                    {f.type === "motivo_baja" && (
                      <select
                        value={bulkForm.motivo_baja}
                        onChange={(e) => setBulkField("motivo_baja", e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border rounded"
                      >
                        <option value="">—</option>
                        {Object.entries(OPCIONES_MOTIVO_BAJA).map(([grupo, opts]) => (
                          <optgroup key={grupo} label={grupo}>
                            {opts.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 flex justify-between border-t">
              <span className="text-[11px] text-gray-600">
                Se actualizarán {selectedItems.length} registros
              </span>

              <div className="flex gap-2">
                <button
                  onClick={closeBulkModal}
                  className="px-3 py-1.5 text-xs border rounded"
                >
                  Cancelar
                </button>

                <button
                  onClick={saveBulkModal}
                  disabled={isSavingBulk}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded disabled:opacity-50"
                >
                  {isSavingBulk ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItems.length > 0 && !isBulkModalOpen && (
        <div className="fixed bottom-4 right-4 bg-white border shadow-lg rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm text-gray-700">
            <strong>{selectedItems.length}</strong> seleccionados
          </span>

          <button
            onClick={openBulkModal}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg"
          >
            Editar Seleccionados
          </button>

          <button
            onClick={() => setSelectedItems([])}
            className="px-3 py-2 text-xs text-gray-500"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
