import { useEffect, useState } from "react"
import { supabase } from "../services/supabaseClient"

export default function FormadorPage({ user }) {
  const [mallas, setMallas] = useState([])
  const [mensaje, setMensaje] = useState("")
  const [loading, setLoading] = useState(true)

  // 🧠 Cargar las mallas desde la base de datos
  useEffect(() => {
    const fetchMallas = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("mallas")
        .select("*")
        .order("id", { ascending: true })

      if (error) {
        console.error("Error cargando mallas:", error)
        setMensaje("❌ No se pudieron cargar las mallas")
      } else {
        setMallas(data)
      }

      setLoading(false)
    }

    fetchMallas()
  }, [])

  // ⚙️ Activar o desactivar curso por día
  const toggleCurso = async (id, activo) => {
    const { error } = await supabase
      .from("mallas")
      .update({ activo: !activo })
      .eq("id", id)

    if (error) {
      console.error("Error al actualizar curso:", error)
      setMensaje("❌ Error al actualizar el estado del curso")
    } else {
      setMallas((prev) =>
        prev.map((m) => (m.id === id ? { ...m, activo: !activo } : m))
      )
      setMensaje("✅ Estado actualizado correctamente")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            👋 Bienvenido, {user.nombre}
          </h1>
          <p className="text-gray-600">Rol: {user.rol}</p>
        </div>

        <h2 className="text-xl font-semibold mb-4">
          📚 Mallas de Capacitación
        </h2>

        {loading ? (
          <p className="text-gray-500">Cargando mallas...</p>
        ) : (
          <table className="w-full border border-gray-200 text-sm rounded-lg overflow-hidden">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="py-2 px-3 text-left">ID</th>
                <th className="py-2 px-3 text-left">Campaña</th>
                <th className="py-2 px-3 text-left">Curso</th>
                <th className="py-2 px-3 text-left">Día</th>
                <th className="py-2 px-3 text-left">Activo</th>
                <th className="py-2 px-3 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {mallas.map((malla) => (
                <tr
                  key={malla.id}
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="py-2 px-3">{malla.id}</td>
                  <td className="py-2 px-3">{malla.campaña}</td>
                  <td className="py-2 px-3">{malla.curso}</td>
                  <td className="py-2 px-3">{malla.dia}</td>
                  <td className="py-2 px-3">
                    {malla.activo ? "✅ Activo" : "⏸️ Inactivo"}
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => toggleCurso(malla.id, malla.activo)}
                      className={`px-3 py-1 rounded-lg text-white ${
                        malla.activo ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                      }`}
                    >
                      {malla.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {mensaje && <p className="mt-4 text-center text-gray-700">{mensaje}</p>}
      </div>
    </div>
  )
}
