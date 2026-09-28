import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: "/goals-tracker/",
  plugins: [react(), tailwindcss()],
  server: {
    // This dev server is reached through a public tunnel hostname while
    // testing, and Vite blocks unknown Host headers by default. The dev server
    // is not internet-facing in production, and the API still requires a valid
    // JWT, so accepting the tunnel host is the lesser evil here.
    allowedHosts: true,
    // Serve the API from the same origin as the app. The browser then only ever
    // talks to one host, which keeps cookies same-site and means no CORS
    // allow-list has to be widened to share the app over a public URL.
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
})
