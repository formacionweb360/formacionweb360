import React from "react";
import FormadorPanel from "../components/FormadorPanel";

export default function FormadorPage({ user }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="p-4 bg-blue-600 text-white font-semibold">
        👋 Bienvenido {user.nombre} ({user.rol})
      </header>
      <main className="p-6">
        <FormadorPanel formador={user.usuario} />
      </main>
    </div>
  );
}
