import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
              // Comprehensive Agora.io domains for voice calling
              "connect-src 'self' ws: wss: https://*.agora.io wss://*.agora.io https://*.sd-rtn.com wss://*.sd-rtn.com https://*.edge.agora.io wss://*.edge.agora.io https://webrtc2-ap-web-1.agora.io https://webrtc2-ap-web-2.agora.io https://uni-webcollector.agora.io https://statscollector-1.agora.io https://web-2.statscollector.sd-rtn.com https://vitals.vercel-insights.com https://api.pwnedpasswords.com",
              "media-src 'self' https://*.agora.io https://*.sd-rtn.com"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;
