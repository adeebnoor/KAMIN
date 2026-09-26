(() => {
  const SUPPORTED=new Set(['ar','en'])
  const params=new URLSearchParams(location.search)
  const fromUrl=SUPPORTED.has(params.get('lang'))?params.get('lang'):null
  let stored=null
  try{stored=SUPPORTED.has(localStorage.getItem('kamin-lang'))?localStorage.getItem('kamin-lang'):null}catch{}
  const browser=(navigator.languages||[navigator.language||'']).find(Boolean)||''
  const inferred=browser.toLowerCase().startsWith('en')?'en':'ar'
  const lang=fromUrl||stored||inferred||'ar'

  document.documentElement.lang=lang
  document.documentElement.dir=lang==='ar'?'rtl':'ltr'
  try{localStorage.setItem('kamin-lang',lang)}catch{}

  const body=document.body
  if(body){
    const title=body.dataset[lang==='ar'?'titleAr':'titleEn']
    const description=body.dataset[lang==='ar'?'descriptionAr':'descriptionEn']
    if(title) document.title=title
    if(description){
      const meta=document.querySelector('meta[name="description"]')
      if(meta) meta.setAttribute('content',description)
    }
  }

  for(const node of document.querySelectorAll('[data-kamin-lang]')){
    node.hidden=node.dataset.kaminLang!==lang
  }

  const withLang=(raw)=>{
    try{
      const url=new URL(raw,location.href)
      if(url.origin!==location.origin) return raw
      if(url.hash && !url.pathname.includes('.html') && url.pathname===location.pathname) return raw
      if(url.pathname==='/' || url.pathname.endsWith('.html')){
        url.searchParams.set('lang',lang)
        return url.pathname+url.search+url.hash
      }
      return raw
    }catch{return raw}
  }
  for(const link of document.querySelectorAll('a[href]')){
    const href=link.getAttribute('href')
    if(href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) link.setAttribute('href',withLang(href))
  }

  for(const button of document.querySelectorAll('[data-language-toggle]')){
    button.textContent=lang==='ar'?'EN':'العربية'
    button.setAttribute('lang',lang==='ar'?'en':'ar')
    button.addEventListener('click',()=>{
      const next=lang==='ar'?'en':'ar'
      try{localStorage.setItem('kamin-lang',next)}catch{}
      const url=new URL(location.href)
      url.searchParams.set('lang',next)
      location.href=url.toString()
    })
  }
})()
