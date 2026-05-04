/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/doclexia',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
