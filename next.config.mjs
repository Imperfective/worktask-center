/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",            // Docker 배포용: 최소 런타임만 번들
  reactStrictMode: true,
};
export default nextConfig;
