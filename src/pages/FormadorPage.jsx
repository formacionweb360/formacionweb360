import { useEffect, useState } from "react"
import { supabase } from "../services/supabaseClient"

export default function FormadorPage({ user }) {
  const [campañas, setCampañas] = useState([])
  const [cursos, setCursos] = useState([])
  const [activados, setActivados] = useState([])
  const [loading, setLoading] = useState(false)

  const hoy = new Date().toISOString().split("T")[0] // formato YYYY-MM-DD

  // Cargar campañas, cursos y activados
  useEffect(() => {
    const fetchData = async () => {
      const { data: campData } = await supabase.from("campañas").select("*")
      const { data: cursoData } = await supabase.from("cursos").select("*")
      const { data: actData } = await supabase
        .from("cursos_activados")
        .select("*, cursos(nombre), campañas(nombre)")
        .eq("fecha_activacion", hoy)

      setCampañas(campData || [])
      setCursos(cursoData || [])
      setActivados(actData || [])
    }
    fetchData()
  }, [])

  // Activar curso
  const activarCurso = async (curso_id, campaña_id) => {
    setLoading(true)

    // Verificar si ya existe activación
    const { data: existente } = await supabase
      .from("cursos_activados")
      .select("*")
      .eq("curso_id", curso_id)
      .eq("campaña_id", campaña_id)
      .eq("fecha_activacion", hoy)
      .single()

    if (existente) {
      alert("⚠️ Este curso ya está activo para esta campaña hoy.")
      setLoading(false)
      return
    }

    const { error } = await supabase.from("cursos_activados").insert([
      {
        curso_id,
        campaña_id,
        fecha_activacion: hoy,
        activo: true,
        formador_id: user.id
      }
    ])

    if (error) {
      console.error(error)
      alert("❌ Error al activar el curso")
    } else {
      alert("✅ Curso activado correctamente")
      // Recargar lista
      const { data: actData } = await supabase
        .from("cursos_activados")
        .select("*, cursos(nombre), campañas(nombre)")
        .eq("fecha_activacion", hoy)
      setActivados(actData || [])
    }

    setLoading(false)
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">
        👩‍🏫 Panel del Formador - {user.nombre}
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lista de cursos */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-2">Cursos disponibles</h2>
          {cursos.map((curso) => (
            <div
              key={curso.id}
              className="border p-3 rounded-lg flex justify-between items-center mb-2"
            >
              <span>{curso.nombre}</span>
              <select
                className="border rounded-lg p-1 text-sm"
                onChange={(e) => {
                  const campañaId = e.target.value
                  if (campañaId) activarCurso(curso.id, campañaId)
                }}
              >
                <option value="">Seleccionar campaña</option>
                {campañas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Cursos activados hoy */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-2">
            Cursos activados hoy ({hoy})
          </h2>
          {activados.length === 0 ? (
            <p className="text-gray-500">Aún no se activaron cursos.</p>
          ) : (
            activados.map((a) => (
              <div
                key={a.id}
                className="border p-3 rounded-lg flex justify-between mb-2"
              >
                <span>
                  📘 {a.cursos?.nombre || "Curso"} — 📍{" "}
                  {a.campañas?.nombre || "Campaña"}
                </span>
                <span className="text-green-600 font-medium">Activo</span>
              </div>
            ))
          )}
        </div>
      </div>

      {loading && <p className="text-center mt-4 text-gray-600">Guardando...</p>}
    </div>
  )
}
