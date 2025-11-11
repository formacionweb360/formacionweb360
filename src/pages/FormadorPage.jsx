import { useEffect, useState } from "react"
import { supabase } from "../services/supabaseClient"

export default function FormadorPage({ user }) {
  const [cursos, setCursos] = useState([])
  const [campañas, setCampañas] = useState([])
  const [seleccion, setSeleccion] = useState({ campaña_id: "", curso_id: "" })
  const [activos, setActivos] = useState([])
  const [mensaje, setMensaje] = useState("")

  const fechaHoy = new Date().toISOString().split("T")[0]

  // Cargar datos al entrar
  useEffect(() => {
    cargarCursos()
    cargarCampañas()
    cargarActivos()
  }, [])

  const cargarCursos = async () => {
    const { data, error } = await supabase.from("cursos").select("*").eq("estado", "Activo")
    if (!error) setCursos(data)
  }

  const cargarCampañas = async () => {
    const { data, error } = await supabase.from("campañas").select("*")
    if (!error) setCampañas(data)
  }

  const cargarActivos = async () => {
    const { data, error } = await supabase
      .from("cursos_activados")
      .select("id, curso_id, campaña_id, fecha, activo, cursos(nombre)")
      .eq("fecha", fechaHoy)
      .eq("formador_id", user.id)
    if (!error) setActivos(data)
  }

  const activarCurso = async () => {
    const { campaña_id, curso_id } = seleccion
    if (!campaña_id || !curso_id) return setMensaje("⚠️ Selecciona campaña y curso")

    // Verificar si ya existe activación
    const { data: existe } = await supabase
      .from("cursos_activados")
      .select("*")
      .eq("fecha", fechaHoy)
      .eq("campaña_id", campaña_id)
      .eq("curso_id", curso_id)
      .maybeSingle()

    if (existe) {
      setMensaje("⚠️ Este curso ya está activado hoy")
      return
    }

    const { error } = await supabase.from("cursos_activados").insert([
      {
        campaña_id,
        curso_id,
        fecha: fechaHoy,
        activo: true,
        formador_id: user.id,
      },
    ])

    if (error) setMensaje("❌ Error al activar")
    else {
      setMensaje("✅ Curso activado correctamente")
      cargarActivos()
    }
  }

  const desactivarCurso = async (id) => {
    const { error } = await supabase.from("cursos_activados").delete().eq("id", id)
    if (!error) {
      setMensaje("🗑 Curso desactivado")
      cargarActivos()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6">Panel del Formador</h1>

      <div className="bg-white rounded-2xl shadow p-6 mb-6 space-y-4 max-w-xl">
        <h2 className="font-semibold text-lg">Activar Curso</h2>

        <select
          className="w-full border rounded-lg p-2"
          value={seleccion.campaña_id}
          onChange={(e) => setSeleccion({ ...seleccion, campaña_id: e.target.value })}
        >
          <option value="">Selecciona una campaña</option>
          {campañas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          className="w-full border rounded-lg p-2"
          value={seleccion.curso_id}
          onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })}
        >
          <option value="">Selecciona un curso</option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <button
          onClick={activarCurso}
          className="bg-indigo-600 text-white w-full py-2 rounded-lg hover:bg-indigo-700"
        >
          Activar curso de hoy
        </button>

        <p className="text-sm text-gray-600">{mensaje}</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 max-w-xl">
        <h2 className="font-semibold text-lg mb-4">Cursos activos de hoy</h2>
        {activos.length === 0 && <p className="text-gray-500">Ninguno por ahora</p>}
        {activos.map((a) => (
          <div
            key={a.id}
            className="flex justify-between items-center border-b py-2"
          >
            <span>{a.cursos?.nombre || "Curso"}</span>
            <button
              onClick={() => desactivarCurso(a.id)}
              className="text-red-500 hover:text-red-700"
            >
              Desactivar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
