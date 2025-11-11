import { useEffect, useState } from "react"
import { supabase } from "../services/supabaseClient"

export default function FormadorPage({ user }) {
  const [campanias, setCampanias] = useState([])
  const [cursos, setCursos] = useState([])
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState("")
  const [cursoSeleccionado, setCursoSeleccionado] = useState("")
  const [mensaje, setMensaje] = useState("")

  // Cargar campañas al iniciar
  useEffect(() => {
    async function cargarCampanias() {
      const { data, error } = await supabase.from("campañas").select("*").eq("estado", "Activo")
      if (error) console.error("Error cargando campañas:", error)
      else setCampanias(data)
    }
    cargarCampanias()
  }, [])

  // Cargar cursos según la campaña seleccionada
  useEffect(() => {
    if (!campaniaSeleccionada) return
    async function cargarCursos() {
      const { data, error } = await supabase
        .from("cursos")
        .select("*")
        .eq("campaña_id", campaniaSeleccionada)
      if (error) console.error("Error cargando cursos:", error)
      else setCursos(data)
    }
    cargarCursos()
  }, [campaniaSeleccionada])

  // Cambiar estado del curso (activar/desactivar)
  const toggleEstadoCurso = async () => {
    if (!cursoSeleccionado) return setMensaje("Selecciona un curso.")
    const curso = cursos.find((c) => c.id === parseInt(cursoSeleccionado))
    if (!curso) return setMensaje("Curso no encontrado.")

    const nuevoEstado = curso.estado === "Activo" ? "Inactivo" : "Activo"

    const { error } = await supabase
      .from("cursos")
      .update({ estado: nuevoEstado })
      .eq("id", curso.id)

    if (error) setMensaje("❌ Error actualizando el curso.")
    else {
      setMensaje(`✅ Curso ${nuevoEstado === "Activo" ? "activado" : "desactivado"} correctamente.`)
      // Refrescar lista
      const { data } = await supabase.from("cursos").select("*").eq("campaña_id", campaniaSeleccionada)
      setCursos(data)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-lg space-y-4">
        <h1 className="text-2xl font-bold text-center text-indigo-700">
          👩‍🏫 Panel de Formador
        </h1>
        <p className="text-center text-gray-600">Bienvenido {user.nombre}</p>

        {/* Selección de campaña */}
        <div>
          <label className="block text-sm font-medium mb-1">Campaña:</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={campaniaSeleccionada}
            onChange={(e) => {
              setCampaniaSeleccionada(e.target.value)
              setCursos([])
              setCursoSeleccionado("")
            }}
          >
            <option value="">Selecciona una campaña</option>
            {campanias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Selección de curso */}
        <div>
          <label className="block text-sm font-medium mb-1">Curso:</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={cursoSeleccionado}
            onChange={(e) => setCursoSeleccionado(e.target.value)}
            disabled={!campaniaSeleccionada}
          >
            <option value="">Selecciona un curso</option>
            {cursos.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.titulo} ({curso.estado})
              </option>
            ))}
          </select>
        </div>

        {/* Botón de activación */}
        <button
          onClick={toggleEstadoCurso}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
        >
          Activar / Desactivar Curso
        </button>

        {mensaje && <p className="text-center text-sm text-gray-700">{mensaje}</p>}
      </div>
    </div>
  )
}
