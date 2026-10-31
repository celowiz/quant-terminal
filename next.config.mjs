/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/quant-terminal'

// dia do build em BRT: o HTML estático e o 1º render do cliente usam o mesmo 'hoje' (sem mismatch de hidratação)
const buildDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const nextConfig = {
  reactStrictMode: true,
  // GitHub Pages: site 100% estático (sem servidor). Dados vêm de /data/*.json gerados no Actions.
  output: 'export',
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_BUILD_DAY: buildDay },
}

export default nextConfig
