/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {
        // `@supabase/supabase-js` optionally imports this for tracing. It's not
        // installed and Turbopack ignores the `turbopackIgnore` hint, so alias
        // it to an empty stub to prevent a module-not-found error.
        "@opentelemetry/api": "./lib/otel-stub.js",
      },
    },
  },
};

export default nextConfig;
