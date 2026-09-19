const here=globalThis.document?.baseURI||globalThis.location?.href||'http://localhost/';
const SITE_ROOT=new URL('./',here);
export function siteUrl(path=''){
  return new URL(String(path||'').replace(/^\/+/,''),SITE_ROOT).href;
}
export function sitePath(path=''){
  const u=new URL(siteUrl(path));
  return u.pathname+u.search+u.hash;
}
export const siteRoot=SITE_ROOT.href;