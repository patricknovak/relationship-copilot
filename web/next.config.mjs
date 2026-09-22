/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Match production Vercel Domains: www → apex (308). Belt-and-suspenders so
  // the app config agrees with platform redirects if domain settings drift.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.relationshipcopilot.com" }],
        destination: "https://relationshipcopilot.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
