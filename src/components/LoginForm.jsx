import { useState } from "react"
import { supabase } from "../services/supabaseClient"

export default function LoginForm({ onLogin }) {
  const [usuario, setUsuario] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [mensaje, setMensaje] = useState("")

  const handleLogin = async (e) => {
    e.preventDefault()
    setMensaje("Verificando...")

    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("usuario", usuario)
      .eq("contrasena", contrasena)
      .eq("estado", "Activo")
      .single()

    if (error || !data) {
      setMensaje("❌ Usuario o contraseña incorrectos")
      return
    }

    setMensaje(`✅ Bienvenido ${data.nombre}`)
    onLogin(data)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-2xl shadow-lg w-96 space-y-4"
      >
        <h2 className="text-2xl font-bold text-center">Iniciar sesión</h2>
        <input
          className="w-full border rounded-lg px-4 py-2"
          type="text"
          placeholder="Usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-4 py-2"
          type="password"
          placeholder="Contraseña"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
        <button
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
          type="submit"
        >
          Entrar
        </button>
        <p className="text-center text-sm text-gray-600">{mensaje}</p>
      </form>
    </div>
  )
}
