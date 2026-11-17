import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // hosts allowed to load dev-mode assets (testing over public IP / LAN)
  allowedDevOrigins: ["203.0.113.30", "10.0.0.43"],

  poweredByHeader: false, // don't advertise the framework
  // Uploads live on persistent storage beside the app, not inside build bundles.
  outputFileTracingExcludes: { "/*": ["./public/uploads/**/*"] },

  images: {
    // This server's CPU (x86-64-v1) can't run a sharp new enough for Next 16's
    // image optimizer, so serve images directly. They're already pre-optimized
    // WebP on upload, so this is also faster and - crucially - makes freshly
    // uploaded photos display immediately instead of hitting the broken optimizer.
    unoptimized: true,
  },

  // shrink the client bundle; large icon/util libraries stay tree-shaken
  experimental: { optimizePackageImports: ["gsap"] },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // stop the site being framed into a phishing page
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // HTTPS-only once a certificate is in place
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
