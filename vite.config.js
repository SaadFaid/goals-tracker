import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import fs from 'node:fs'

// The allow-list lives in server/.env, which Vite does not read on its own, so
// pull CLIENT_ORIGIN straight out of that file. Without this the config would
// fall back to localhost only and refuse the public site again.
const serverEnv = fs.existsSync("server/.env")
  ? fs.readFileSync("server/.env", "utf8")
  : ""
const configuredOrigins =
  process.env.CLIENT_ORIGIN ||
  serverEnv.match(/^\s*CLIENT_ORIGIN\s*=\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, "") ||
  "http://localhost:5173"

const allowedOrigins = configuredOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)

export default defineConfig({
  base: "/goals-tracker/",
  plugins: [react(), tailwindcss()],
  server: {
    // This dev server is reached through a public tunnel hostname while
    // testing, and Vite blocks unknown Host headers by default. The dev server
    // is not internet-facing in production, and the API still requires a valid
    // JWT, so accepting the tunnel host is the lesser evil here.
    allowedHosts: true,
    // Vite answers CORS preflights itself, before the proxy runs, and its
    // default reply carries Allow-Methods and Allow-Headers but no
    // Allow-Origin. A browser therefore rejected every cross-origin POST -
    // which is the entire public site, since the published bundle talks to
    // the tunnel - while curl, not caring about CORS, kept returning 200 and
    // made the API look healthy. Restating the allow-list here fixes the
    // preflight the same way the API already handles it.
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
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
