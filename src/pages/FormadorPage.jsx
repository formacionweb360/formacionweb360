import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function FormadorPage({ user, onLogout }) {
  const [campañas, setCampañas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [seleccion, setSeleccion] = useState({
    campana_id: "",
    grupo_id: "",
    curso_id: "",
  });  

  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  const fechaHoy = new Date().toISOString().split("T")[0];

  const fechaHoyFormateada = new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ---------------------------
  // CARGAR DATOS INICIALES
  // ---------------------------
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      await Promise.all([cargarCampañas(), cargarActivos()]);
    } finally {
      setLoading(false);
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  // ---------------------------
  // CARGAR CAMPAÑAS
  // ---------------------------
  const cargarCampañas = async () => {
    const { data, error } = await supabase.from("campañas").select("*");
    if (!error) setCampañas(data || []);
    else mostrarMensaje("error", "Error al cargar campañas");
  };

  // ---------------------------
  // CARGAR GRUPOS
  // ---------------------------
  const cargarGrupos = async (campana_id) => {
    if (!campana_id) return;
    setLoading(true);

    try {
      const { data: gruposData, error } = await supabase
        .from("grupos")
        .select("*")
        .eq("campana_id", campana_id);

      if (error) {
        setGrupos([]);
        return;
      }

      const gruposConConteo = await Promise.all(
        gruposData.map(async (g) => {
          const { count } = await supabase
            .from("usuarios")
            .select("*", { count: "exact", head: true })
            .eq("grupo_nombre", g.nombre)
            .eq("rol", "usuario")
            .eq("estado", "Activo");

          return { ...g, activos: count || 0 };
        })
      );

      setGrupos(gruposConConteo);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // CARGAR CURSOS
  // ---------------------------
  const cargarCursos = async (campana_id, grupo_id) => {
    if (!campana_id || !grupo_id) return;

    setLoading(true);

    try {
      let query = supabase
        .from("cursos")
        .select("*")
        .eq("campana_id", campana_id)
        .eq("estado", "Activo");

      query = query.or(`grupo_id.is.null,grupo_id.eq.${grupo_id}`);

      const { data, error } = await query;

      if (!error) setCursos(data || []);
      else mostrarMensaje("error", "Error al cargar cursos");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // CARGAR CURSOS ACTIVADOS HOY
  // ---------------------------
  const cargarActivos = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("cursos_activados")
      .select(`
        id,
        curso_id,
        campana_id,
        grupo_id,
        fecha,
        activo,
        cursos(titulo, duracion_minutos),
        grupos(nombre),
        campañas(nombre)
      `)
      .eq("fecha", fechaHoy)
      .eq("formador_id", user.id);

    if (error) {
      setActivos([]);
      return;
    }

    const activosConConteo = await Promise.all(
      data.map(async (activado) => {
        const { count } = await supabase
          .from("cursos_asesores")
          .select("*", { count: "exact", head: true })
          .eq("curso_activado_id", activado.id);

        return { ...activado, asesores_count: count || 0 };
      })
    );

    setActivos(activosConConteo);
  };

  // ---------------------------
  // ACTIVAR CURSO
  // ---------------------------
  const activarCurso = async () => {
    const { campana_id, grupo_id, curso_id } = seleccion;

    if (!campana_id || !grupo_id || !curso_id) {
      mostrarMensaje("error", "Debes seleccionar campaña, grupo y curso");
      return;
    }

    setLoading(true);

    try {
      const { data: existe } = await supabase
        .from("cursos_activados")
        .select("*")
        .eq("fecha", fechaHoy)
        .eq("campana_id", campana_id)
        .eq("grupo_id", grupo_id)
        .eq("curso_id", curso_id)
        .maybeSingle();

      if (existe) {
        mostrarMensaje("error", "Este curso ya está activado hoy");
        return;
      }

      // Crear activación
      const { data: activacion } = await supabase
        .from("cursos_activados")
        .insert([
          {
            campana_id,
            grupo_id,
            curso_id,
            fecha: fechaHoy,
            activo: true,
            formador_id: user.id,
          },
        ])
        .select()
        .single();

      // Obtener asesores del grupo
      const { data: grupo } = await supabase
        .from("grupos")
        .select("nombre")
        .eq("id", grupo_id)
        .single();

      const { data: asesores } = await supabase
        .from("usuarios")
        .select("id")
        .eq("rol", "usuario")
        .eq("grupo_nombre", grupo.nombre)
        .eq("estado", "Activo");

      // Asignar asesores
      if (asesores?.length > 0) {
        await supabase.from("cursos_asesores").insert(
          asesores.map((u) => ({
            curso_activado_id: activacion.id,
            asesor_id: u.id,
          }))
        );

        mostrarMensaje(
          "success",
          `Curso activado y asignado a ${asesores.length} asesores`
        );
      } else {
        mostrarMensaje("success", "Curso activado (sin asesores en el grupo)");
      }

      await cargarActivos();
      await cargarGrupos(campana_id);
      setSeleccion({ ...seleccion, curso_id: "" });
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // DESACTIVAR CURSO
  // ---------------------------
  const desactivarCurso = async (id) => {
    if (!confirm("¿Desactivar este curso?")) return;

    setLoading(true);

    try {
      await supabase.from("cursos_asesores").delete().eq("curso_activado_id", id);
      await supabase.from("cursos_activados").delete().eq("id", id);
      mostrarMensaje("success", "Curso desactivado");
      await cargarActivos();
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // SELECCION DE CAMPANA Y GRUPO
  // ---------------------------
  const handleCampanaChange = async (campana_id) => {
    setSeleccion({ campana_id, grupo_id: "", curso_id: "" });
    setGrupos([]);
    setCursos([]);
    await cargarGrupos(campana_id);
  };

  const handleGrupoChange = async (grupo_id) => {
    setSeleccion({ ...seleccion, grupo_id, curso_id: "" });
    setCursos([]);
    await cargarCursos(seleccion.campana_id, grupo_id);
  };

  // ----------------------------------------------------------
  //                   UI COMPLETAMENTE ORDENADA
  // ----------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel del Formador</h1>
            <p className="text-gray-500">📅 {fechaHoyFormateada}</p>
          </div>

          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow"
          >
            Cerrar sesión
          </button>
        </div>

        {/* MENSAJE */}
        {mensaje.texto && (
          <div
            className={`p-4 rounded-lg mb-6 ${
              mensaje.tipo === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {/* GRID GENERAL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* PANEL DE SELECCIÓN */}
          <div className="bg-white p-6 rounded-xl shadow space-y-4">

            <h2 className="text-xl font-semibold">🎯 Activar Curso</h2>

            <div>
              <label className="font-medium">Campaña</label>
              <select
                className="w-full border rounded-lg p-3 mt-1"
                value={seleccion.campana_id}
                onChange={(e) => handleCampanaChange(e.target.value)}
              >
                <option value="">Selecciona</option>
                {campañas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {grupos.length > 0 && (
              <div>
                <label className="font-medium">Grupo</label>
                <select
                  className="w-full border rounded-lg p-3 mt-1"
                  value={seleccion.grupo_id}
                  onChange={(e) => handleGrupoChange(e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre} ({g.activos} activos)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {cursos.length > 0 && (
              <div>
                <label className="font-medium">Curso</label>
                <select
                  className="w-full border rounded-lg p-3 mt-1"
                  value={seleccion.curso_id}
                  onChange={(e) =>
                    setSeleccion({ ...seleccion, curso_id: e.target.value })
                  }
                >
                  <option value="">Selecciona</option>
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo} • {c.duracion_minutos} min
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={activarCurso}
              disabled={!seleccion.curso_id || loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg mt-4 hover:bg-indigo-700 disabled:bg-gray-300"
            >
              Activar Curso
            </button>
          </div>

          {/* PANEL ACTIVOS */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl font-semibold mb-4">🎓 Cursos Activos Hoy</h2>

            {activos.length === 0 ? (
              <p className="text-gray-500 text-center py-10">No hay cursos activados</p>
            ) : (
              <div className="space-y-4">
                {activos.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 border rounded-xl flex justify-between items-center hover:bg-gray-50"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {a.cursos?.titulo}
                      </h3>

                      <p className="text-gray-500 text-sm">
                        Grupo: {a.grupos?.nombre} · Campaña: {a.campañas?.nombre}
                      </p>

                      <p className="text-sm text-green-700 font-medium">
                        Asesores: {a.asesores_count}
                      </p>
                    </div>

                    <button
                      onClick={() => desactivarCurso(a.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
