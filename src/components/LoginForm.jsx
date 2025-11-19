import { useState } from "react"
import { supabase } from "../services/supabaseClient"

export default function LoginForm({ onLogin }) {
  const [usuario, setUsuario] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true);
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
      setLoading(false);
      return
    }

    setMensaje(`✅ Bienvenido ${data.nombre}`)
    onLogin(data)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Fondo con montañas y estrellas */}
      <div className="absolute inset-0 z-0">
        {/* Montañas estilizadas */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2">
          <svg viewBox="0 0 1440 320" className="w-full h-full">
            <path
              fill="url(#mountainGradient)"
              fillOpacity="1"
              d="M0,160L48,170.7C96,181,192,203,288,202.7C384,203,480,181,576,165.3C672,149,768,139,864,154.7C960,171,1056,213,1152,218.7C1248,224,1344,192,1392,176L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>
        </div>

        {/* Gradiente para las montañas */}
        <defs>
          <linearGradient id="mountainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6b21a8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>

        {/* Estrellas fijas */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`
              }}
            ></div>
          ))}
        </div>

        {/* Estrellas cayendo (shooting stars) */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-white rounded-full animate-shoot"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            >
              <style jsx>{`
                @keyframes shoot {
                  0% { opacity: 0; transform: translateX(0) rotate(0deg); }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { opacity: 0; transform: translateX(-50px) rotate(0deg); }
                }
                .animate-shoot {
                  animation: shoot 5s linear infinite;
                }
              `}</style>
            </div>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleLogin}
        className="relative z-10 w-full max-w-sm bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl shadow-purple-500/20 p-8 space-y-6 border border-white/20 animate-in slide-in-from-bottom-10 duration-700"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30 group hover:scale-110 transition-transform duration-300">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
          <p className="text-gray-600 text-sm mt-2">Accede a tu panel de usuario</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Usuario</label>
            <input
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              type="text"
              placeholder="Ingresa tu usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
            <input
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>
        </div>

        <button
          className={`w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all font-semibold shadow-md disabled:bg-gray-500/30 disabled:cursor-not-allowed ${
            loading ? 'animate-pulse' : 'hover:from-purple-600 hover:to-pink-600'
          }`}
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Entrando...</span>
            </div>
          ) : (
            "Entrar"
          )}
        </button>

        {mensaje && (
          <p className={`text-center text-sm transition-all duration-300 ${
            mensaje.includes("✅") ? "text-green-600" : 
            mensaje.includes("❌") ? "text-red-600 animate-bounce" : "text-gray-600"
          }`}>
            {mensaje}
          </p>
        )}
      </form>
    </div>
  )
}
