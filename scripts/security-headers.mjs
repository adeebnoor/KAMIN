// Task 47: the one source of the security headers. dist/_headers (Cloudflare), `vite preview`
// and every built public page take them from here; vercel.json, render.yaml and index.html's
// meta tag are checked against them on every build by scripts/prepare-hosting.mjs
// (`node scripts/prepare-hosting.mjs --sync` rewrites those three copies after a change here).
export const securityHeaders = {
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
}

// A <meta> policy cannot carry frame-ancestors (browsers ignore it and log a warning), so the
// meta form is the same policy without that one directive; X-Frame-Options and the header cover framing.
export const metaContentSecurityPolicy=securityHeaders['Content-Security-Policy'].split(';').map(part=>part.trim()).filter(part=>part&&!part.startsWith('frame-ancestors')).join('; ')
