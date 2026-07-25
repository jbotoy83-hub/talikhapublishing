import type { NextConfig } from "next";

const developmentScripts = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const developmentConnections = process.env.NODE_ENV === "development" ? " ws://127.0.0.1:* ws://localhost:*" : "";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const indexingEnabled = process.env.SITE_INDEXING_ENABLED?.trim().toLocaleLowerCase() === "true";

function configuredRemoteImageHosts() {
  return [
    ...new Set(
      (process.env.REMOTE_IMAGE_HOSTS || "")
        .split(",")
        .map((host) => host.trim().toLocaleLowerCase())
        .filter((host) => /^[a-z0-9.-]+$/.test(host))
    )
  ];
}

const remoteImageHosts = configuredRemoteImageHosts();
const remoteImageSources = remoteImageHosts.map((host) => `https://${host}`).join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${developmentScripts} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${remoteImageSources ? ` ${remoteImageSources}` : ""}${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  `font-src 'self' data:`,
  `connect-src 'self'${developmentConnections} https://challenges.cloudflare.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "frame-src https://challenges.cloudflare.com",
  "upgrade-insecure-requests"
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: { root: process.cwd() },
  experimental: { optimizePackageImports: ["lucide-react"] },
  images: {
    remotePatterns: [
      ...remoteImageHosts.map((hostname) => ({ protocol: "https" as const, hostname }))
    ],
    formats: ["image/avif", "image/webp"]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browsers honor this only over HTTPS; keeping it here makes the production policy explicit.
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(indexingEnabled
            ? []
            : [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }])
        ]
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" }
        ]
      }
    ];
  }
};

export default nextConfig;
