import type { NextConfig } from "next";
import { validateServerEnv } from "./src/lib/env/schema.ts";
import { securityHeaders } from "./src/lib/security/headers.ts";

// Next loads .env files before evaluating this config. Fail early for dev/build.
validateServerEnv(process.env);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 3MB images plus form metadata fit beneath the hosting request-size limit.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Invitation URLs and recovery query strings contain bearer secrets.
  logging: { incomingRequests: false },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.VERCEL_ENV === "production"),
      },
      ...["/invite/:path*", "/auth/:path*", "/reset-password"].map(
        (source) => ({
          source,
          headers: [
            { key: "Referrer-Policy", value: "no-referrer" },
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ],
        }),
      ),
    ];
  },
};

export default nextConfig;
