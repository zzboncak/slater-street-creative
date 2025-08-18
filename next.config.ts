import type { NextConfig } from "next";

// Optionally allow a custom Cloudflare Images base URL via env
const cfBase = process.env.NEXT_PUBLIC_CF_IMAGES_BASE_URL;
let cfHost: string | null = null;
try {
  if (cfBase) cfHost = new URL(cfBase).hostname;
} catch {}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      // Cloudflare Images delivery domain
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
      // Allow images from your WordPress/demo host
      {
        protocol: "https",
        hostname: "*.hqdemo.app",
      },
      {
        protocol: "https",
        hostname: "revere-health.hqdemo.app",
      },
      // If a custom base host is configured, allow it too
      ...(cfHost
        ? [
            {
              protocol: "https" as const,
              hostname: cfHost,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
