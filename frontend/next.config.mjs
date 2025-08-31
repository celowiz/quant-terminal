/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suprimir warnings de atributos extras de extensões do navegador
  experimental: {
    suppressHydrationWarning: true,
  },
}

export default nextConfig


