/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/quant-terminal'

const nextConfig = {
  reactStrictMode: true,
  // GitHub Pages: site 100% estático (sem servidor). Dados vêm de /data/*.json gerados no Actions.
  output: 'export',
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
