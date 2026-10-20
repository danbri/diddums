// The site root is this module's own folder, so a page elsewhere (another path or site) that imports
// the library from its public URL still fetches the worklet, catalogs and kernels from here.
const here=import.meta.url||globalThis.document?.baseURI||globalThis.location?.href||'http://localhost/';
const SITE_ROOT=new URL('./',here);
export function siteUrl(path=''){
  return new URL(String(path||'').replace(/^\/+/,''),SITE_ROOT).href;
}
export function sitePath(path=''){
  const u=new URL(siteUrl(path));
  return u.pathname+u.search+u.hash;
}
export const siteRoot=SITE_ROOT.href;
// Live runtime files fetched outside the module graph (worklet, catalogs) get the deploy's build id,
// written into the page by tools/stamp-build.py, so a browser never pairs them with a stale page.
const BUILD=globalThis.document?.querySelector?.('meta[name="diddums-build"]')?.content||'';
export function assetUrl(path=''){const u=new URL(siteUrl(path));if(BUILD)u.searchParams.set('v',BUILD);return u.href;}
