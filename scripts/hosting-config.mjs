export function hostingConfig(env=process.env){
 const cloudflare=env.CF_PAGES==='1'
 if(cloudflare&&!env.SITE_ORIGIN)throw new Error('Set SITE_ORIGIN to the chosen canonical HTTPS origin before publishing on Cloudflare Pages')
 const origin=(env.SITE_ORIGIN||'https://kamin-12mf.onrender.com').replace(/\/$/,'')
 if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))throw new Error('SITE_ORIGIN must be an HTTPS origin without a path, credentials, query or fragment')
 const documentUrls=env.SITE_URL_STYLE||(cloudflare?'clean':'html')
 if(!['html','clean'].includes(documentUrls))throw new Error('SITE_URL_STYLE must be html or clean')
 return {origin,documentUrls}
}
