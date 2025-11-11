# Formacion360 - React + Vite + Tailwind + Supabase

## Qué contiene
- Proyecto base con Vite + React
- Tailwind CSS configurado
- Conexión a Supabase (archivo `src/services/supabaseClient.js`)
- Login simple que consulta la tabla `usuarios` y redirige por rol

## Uso local
1. Instala dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abre `http://localhost:5173`

## Despliegue en Vercel
- Sube este repositorio a GitHub y conecta a Vercel. Vercel detecta Vite automáticamente.

## Notas de seguridad
- El proyecto usa la `anon` key directamente en el frontend (estándar para Supabase). No subas la `service_role` key al frontend.
- Considera encriptar contraseñas en la base de datos o usar la autenticación nativa de Supabase para producción.
