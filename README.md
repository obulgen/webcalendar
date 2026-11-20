# Memorias (PWA)
React + TypeScript + Vite. Datos locales (IndexedDB), instalable en iPhone desde Safari (Compartir → Agregar a inicio).

    npm install
    npm run dev      # desarrollo
    npm run build    # genera /dist (hostear en HTTPS: Netlify, Vercel, GitHub Pages)

- Feriados: `src/holidays.json` (estados: oficial / calculado / pendiente). Para actualizar sin republicar, poner una URL en `HOLIDAYS_URL` (src/App.tsx).
- Avisos: solo con la app abierta. Push real con la app cerrada requiere un servidor (etapa 2).
- Base44 (Base Code): subir esta carpeta a un repositorio de GitHub e importarlo.
