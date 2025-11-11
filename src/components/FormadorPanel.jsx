import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function FormadorPanel() {
  const [campañas, setCampañas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState("");
  const [campañaSeleccionada, setCampañaSeleccionada] = useState("");
  const [fecha, setFecha] = useState("");
  const [activando, setActivando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cursosActivos, setCursosActivos] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: campData } = await supabase.from("campañas").select("*");
    const { data: cursosData } = await supabase.from("cursos").select("*");
    const { data: activosData } = await supabase
      .from("cursos_activados")
      .select("*, cursos(titulo)")
      .order("fecha", { ascending: false });

    setCampañas(campData || []);
    setCursos(cursosData || []);
    setCursosActivos(activosData || []);
  }

  async function activarCurso() {
    if (!cursoSeleccionado || !campañaSeleccionada || !fecha) {
      setMensaje("⚠️ Completa todos los campos antes de activar un curso.");
      return;
    }
    setActivando(true);

    const { error } = await supabase.from("cursos_activados").insert([
      {
        curso_id: cursoSeleccionado,
        campaña_id: campañaSeleccionada,
        fecha,
        activado_por: "formador1", // luego dinámico según login
      },
    ]);

    setActivando(false);

    if (error) {
      setMensaje("❌ Error al activar curso: " + error.message);
    } else {
      setMensaje("✅ Curso activado correctamente.");
      cargarDatos();
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📚 Panel del Formador</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <select
          className="border p-2 rounded"
          value={campañaSeleccionada}
          onChange={(e) => setCampañaSeleccionada(e.target.value)}
        >
          <option value="">Selecciona campaña</option>
          {campañas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          className="border p-2 rounded"
          value={cursoSeleccionado}
          onChange={(e) => setCursoSeleccionado(e.target.value)}
        >
          <option value="">Selecciona curso</option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="border p-2 rounded"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      <button
        onClick={activarCurso}
        disabled={activando}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {activando ? "Activando..." : "✅ Activar curso"}
      </button>

      {mensaje && <p className="mt-3 text-sm">{mensaje}</p>}

      <hr className="my-6" />

      <h2 className="text-lg font-semibold mb-2">📅 Cursos activados</h2>
      <ul className="space-y-2">
        {cursosActivos.map((ca) => (
          <li key={ca.id} className="border p-2 rounded">
            <strong>{ca.cursos?.titulo}</strong> — {ca.fecha}
          </li>
        ))}
      </ul>
    </div>
  );
}
