// Empty stub for the optional `@opentelemetry/api` dependency.
// `@supabase/supabase-js` does an optional `import('@opentelemetry/api')` for
// tracing and gracefully falls back when the module lacks the expected exports.
// Turbopack (Next 14) doesn't honor the `turbopackIgnore` magic comment, so we
// alias the package to this empty module to avoid a "module not found" error.
export {};
