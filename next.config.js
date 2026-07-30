/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['placehold.co', 'lh3.googleusercontent.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // The four CDNs previously allowed here (tailwindcss, unpkg,
              // jsdelivr, cdnjs) are not used anywhere in the app — every
              // dependency is bundled. Allowing them bought nothing and gave
              // four more origins that could serve script if any were
              // compromised or typo-squatted.
              //
              // 'unsafe-eval' stays, reluctantly: pdf.js compiles font programs
              // and its own expression evaluator at runtime, so the document
              // viewer white-screens without it. It is scoped to script-src
              // only, and removing it needs the pdf.js worker replaced first.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              // Supabase is reached only from the server (lib/supabase-admin.ts,
              // service-role), so it deliberately does NOT appear here.
              "connect-src 'self' https://api.stripe.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              // pdf.js renders in a blob-backed worker.
              "worker-src 'self' blob:",
              // No plugins, and no injected <base> that could re-point every
              // relative URL on the page.
              "object-src 'none'",
              "base-uri 'self'",
              // Stops a stored-XSS payload from re-pointing a form at an
              // attacker's collector.
              "form-action 'self'",
              // The modern equivalent of X-Frame-Options, kept alongside it
              // since older browsers only honour the latter.
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Only meaningful over HTTPS; browsers ignore it on plain http, so it
          // is safe to send in development too. No includeSubDomains: this is
          // not the place to make a promise about every future subdomain.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
        ],
      },
    ];
  },
  webpack(config, { webpack }) {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    // Add path aliases for @/ imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname,
      '@/components': `${__dirname}/components`,
      '@/lib': `${__dirname}/lib`,
      '@/hooks': `${__dirname}/hooks`,
      '@/types': `${__dirname}/types`,
    };
    // Use a custom loader to handle next-auth CSS file
    config.module.rules.push({
      test: /next-auth\/css\/index\.js$/,
      use: {
        loader: 'raw-loader',
        options: {
          esModule: false,
        },
      },
      type: 'javascript/auto',
    });
    return config;
  },
};

module.exports = nextConfig;
