import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The repo root has its own package.json (dev tooling); keep Turbopack scoped to this app.
  turbopack: { root: path.resolve(__dirname) },
}

export default nextConfig
