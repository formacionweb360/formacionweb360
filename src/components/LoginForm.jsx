import { useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function LoginForm({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensaje("Verificando...");

    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("usuario", usuario)
      .eq("contrasena", contrasena)
      .eq("estado", "Activo")
      .single();

    if (error || !data) {
      setMensaje("❌ Usuario o contraseña incorrectos");
      setLoading(false);
      return;
    }

    setMensaje(`✅ Bienvenido ${data.nombre}`);
    onLogin(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo animado de auroras con tus colores */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[140%] h-[140%] -top-20 -left-20 bg-gradient-to-r from-purple-600/40 via-indigo-400/30 to-pink-300/40 blur-3xl animate-pulse-slow"></div>
        <div className="absolute w-[140%] h-[140%] -bottom-20 -right-20 bg-gradient-to-r from-fuchsia-600/40 via-violet-400/30 to-pink-300/40 blur-3xl animate-pulse-slow-delayed"></div>
      </div>

      {/* Partículas flotantes con tus colores */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-purple-400/80 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          ></div>
        ))}
      </div>

      {/* Contenedor del formulario */}
      <form
        onSubmit={handleLogin}
        className="relative z-10 w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 space-y-6 animate-fade-up"
      >
        {/* Branding / Icono */}
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/40 hover:scale-110 transition-transform duration-300">
            <svg
              className="w-10 h-10 text-white drop-shadow-xl"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-wide drop-shadow-lg">Bienvenido</h2>
          <p className="text-purple-200 text-sm mt-1">Accede a tu panel de usuario</p>
        </div>

        {/* Inputs */}
        <div className="space-y-5">
          <div className="group">
            <label className="block text-sm font-medium text-purple-200 mb-1">Usuario</label>
            <input
              type="text"
              placeholder="Ingresa tu usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-purple-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300 backdrop-blur-md group-hover:border-purple-400"
            />
          </div>

          <div className="group">
            <label className="block text-sm font-medium text-purple-200 mb-1">Contraseña</label>
            <input
              type="password"
              placeholder="Ingresa tu contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-purple-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300 backdrop-blur-md group-hover:border-purple-400"
            />
          </div>
        </div>

        {/* Botón */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl text-white font-semibold shadow-lg shadow-purple-500/40 transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-500 hover:shadow-purple-400/50 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Entrando...</span>
            </div>
          ) : (
            "Iniciar Sesión"
          )}
        </button>

        {/* Mensaje */}
        {mensaje && (
          <p
            className={`text-center text-sm mt-2 transition-all duration-300 ${
              mensaje.includes("✅")
                ? "text-green-400"
                : mensaje.includes("❌")
                ? "text-red-400 animate-shake"
                : "text-purple-200"
            }`}
          >
            {mensaje}
          </p>
        )}
      </form>

      {/* Animaciones personalizadas */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(-20px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.6; }
        }
        .animate-float { animation: float 6s infinite ease-in-out; }

        @keyframes fade-up {
          0% { opacity: 0; transform: translateY(40px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fade-up 1s ease-out both; }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        .animate-pulse-slow { animation: pulse-slow 8s infinite ease-in-out; }

        .animate-pulse-slow-delayed {
          animation: pulse-slow 10s infinite ease-in-out;
          animation-delay: 3s;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s; }
      `}</style>
    </div>
  );
}
