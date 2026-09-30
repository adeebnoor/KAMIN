import {describe,it,expect} from 'vitest'
import {hostingConfig} from '../scripts/hosting-config.mjs'
import {pageHref} from '../public/site-content.js'
describe('portable static hosting',()=>{
 it('retains existing Render URLs and requires a deliberate Cloudflare canonical origin',()=>{
  expect(hostingConfig({})).toEqual({origin:'https://kamin-12mf.onrender.com',documentUrls:'html'})
  expect(()=>hostingConfig({CF_PAGES:'1'})).toThrow('SITE_ORIGIN')
  expect(hostingConfig({CF_PAGES:'1',SITE_ORIGIN:'https://example.edu/'})).toEqual({origin:'https://example.edu',documentUrls:'clean'})
 })
 it('rejects origins that could corrupt metadata or cross the origin boundary',()=>{
  for(const origin of ['http://example.edu','https://user:secret@example.edu','https://example.edu/path','https://example.edu?q=1','https://example.edu#fragment'])expect(()=>hostingConfig({SITE_ORIGIN:origin})).toThrow()
  expect(()=>hostingConfig({SITE_URL_STYLE:'unknown'})).toThrow()
 })
 it('uses Cloudflare extensionless links without dropping language, query intent or anchors',()=>{
  expect(pageHref('/ar/guide.html?lang=ar#ar-query','en','clean')).toBe('/en/guide#ar-query')
  expect(pageHref('/en/index.html?view=knowledge','ar','clean')).toBe('/ar/?view=knowledge')
  expect(pageHref('/en/pdpl','ar','clean')).toBe('/ar/pdpl')
  expect(pageHref('guide.html','en','html')).toBe('/en/guide.html')
 })
})
