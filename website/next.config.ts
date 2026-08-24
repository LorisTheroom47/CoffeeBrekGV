import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseImagePattern = supabaseUrl
  ? new URL("/storage/v1/object/public/menu-images/**", supabaseUrl)
  : null;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: supabaseImagePattern
    ? {
        remotePatterns: [
          {
            protocol: supabaseImagePattern.protocol.replace(":", "") as
              | "http"
              | "https",
            hostname: supabaseImagePattern.hostname,
            port: supabaseImagePattern.port,
            pathname: supabaseImagePattern.pathname,
          },
        ],
      }
    : undefined,
};

export default nextConfig;
