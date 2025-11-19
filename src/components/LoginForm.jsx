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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden">
      {/* Fondo dinámico con partículas sutiles (CSS-only) */}
      <style jsx>{`
        .bg-particles::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: radial-gradient(circle at 20% 50%, rgba(147, 51, 234, 0.1) 1px, transparent 1px);
          background-size: 40px 40px;
          z-index: -1;
          animation: pulse 8s infinite alternate;
        }
        @keyframes pulse {
          0% { opacity: 0.2; }
          100% { opacity: 0.4; }
        }
      `}</style>

      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl shadow-purple-500/20 p-8 space-y-6 border border-white/20 animate-in slide-in-from-bottom-10 duration-700"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Iniciar sesión</h2>
          <p className="text-gray-400 text-sm mt-2">Accede a tu panel de usuario</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Usuario</label>
            <input
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              type="text"
              placeholder="Ingresa tu usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Contraseña</label>
            <input
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>
        </div>

        <button
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all font-semibold shadow-md disabled:bg-gray-500/30 disabled:cursor-not-allowed"
          type="submit"
        >
          Entrar
        </button>

        <p className="text-center text-sm text-gray-400 transition-all duration-300">
          {mensaje}
        </p>
      </form>
    </div>
  )
}
