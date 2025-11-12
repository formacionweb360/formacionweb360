import { useEffect, useState } from "react"
import { supabase } from "../services/supabaseClient"

export default function FormadorPage({ user }) {
  const [campañas, setCampañas] = useState([])
  const [grupos, setGrupos] = useState([])
  const [cursos, setCursos] = useState([])
  const [seleccion, setSeleccion] = useState({ campana_id: "", grupo_id: "" })
  const [activos, setActivos] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    cargarCampañas()
  }, [])

  const cargarCampañas = async () => {
    const { data, error } = await supabase.from("campañas").select("*").eq("estado", "Activo")
    if (!error) setCampañas(data || [])
  }

  const cargarGrupos = async (campana_id) => {
    const { data, error } = await supabase.from("grupos").select("*").eq("campana_id", campana_id)
    if (!error) setGrupos(data || [])
  }

  const cargarCursos = async (campana_id, grupo_id) => {
    let query = supabase.from("cursos").select("*").eq("campana_id", campana_id).eq("estado", "Activo")
    if (grupo_id) query = query.eq("grupo_id", grupo_id)
    const { data, error } = await query
    if (!error) setCursos(data || [])
  }

  const handleSelect = async (field, value) => {
    setSeleccion({ ...seleccion, [field]: value })
    if (field === "campana_id") {
      cargarGrupos(value)
      setSeleccion({ campana_id: value, grupo_id: "" })
      setCursos([])
    } else if (field === "grupo_id") {
      cargarCursos(seleccion.campana_id, value)
    }
  }

  const activarCursos = async (curso_id) => {
    try {
      setLoading(true)
      const { data: activacion, error } = await supabase
        .from("cursos_activados")
        .insert([
          {
            curso_id,
            grupo_id: seleccion.grupo_id || null,
            campana_id: seleccion.campana_id,
            fecha: new Date().toISOString().split("T")[0],
            activo: true,
            formador_id: user.id,
          },
        ])
        .select()
        .single()

      if (error) throw error

      // Asigna el curso a los asesores del grupo
      const { data: asesores } = await supabase
        .from("asesores")
        .select("id")
        .eq("grupo_id", seleccion.grupo_id)

      if (asesores?.length) {
        await supabase.from("cursos_asesores").insert(
          asesores.map((a) => ({
            curso_activado_id: activacion.id,
            asesor_id: a.id,
          }))
        )
      }

      alert("✅ Curso activado correctamente")
      setActivos([...activos, curso_id])
    } catch (err) {
      console.error(err)
      alert("❌ Error al activar el curso")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-sm border text-sm">
      <h2 className="text-xl font-semibold mb-4 text-indigo-600">Panel del Formador</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <select
          className="border rounded-md px-3 py-2"
          value={seleccion.campana_id}
          onChange={(e) => handleSelect("campana_id", e.target.value)}
        >
          <option value="">Seleccionar campaña</option>
          {campañas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          className="border rounded-md px-3 py-2"
          value={seleccion.grupo_id}
          onChange={(e) => handleSelect("grupo_id", e.target.value)}
          disabled={!seleccion.campana_id}
        >
          <option value="">Seleccionar grupo</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-2 text-gray-700">Cursos disponibles:</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {cursos.map((curso) => (
            <div key={curso.id} className="border rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-indigo-600">{curso.titulo}</h4>
              <p className="text-gray-500 text-sm mb-2">{curso.descripcion}</p>
              <button
                onClick={() => activarCursos(curso.id)}
                disabled={loading || activos.includes(curso.id)}
                className={`w-full text-sm py-1.5 rounded ${
                  activos.includes(curso.id)
                    ? "bg-green-500 text-white"
                    : "bg-indigo-500 hover:bg-indigo-600 text-white"
                } transition`}
              >
                {activos.includes(curso.id) ? "Activado" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
