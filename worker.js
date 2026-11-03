// Worker: віддає статичні файли з ./site + API для живих даних турніру (Franko Cup)
const KEY_HASH='1ece04141872fc261d475577cbe036488cfb32142093fca76f994cbaf6301318';
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
// дозволяємо запити з сайту турніру на Cloudflare Pages (franko-cup.pages.dev)
function cors(req,res){const o=req.headers.get('origin')||'';if(!/^https:\/\/([a-z0-9-]+\.)?franko-cup\.pages\.dev$/.test(o))return res;const r=new Response(res.body,res);r.headers.set('access-control-allow-origin',o);r.headers.set('access-control-allow-methods','GET,PUT,POST,OPTIONS');r.headers.set('access-control-allow-headers','x-key,content-type');r.headers.set('access-control-max-age','86400');r.headers.set('vary','origin');return r}
export class Store{
  constructor(state){this.state=state}
  async fetch(req){
    if(req.method==='GET'){const d=await this.state.storage.get('d');return J(d||null)}
    if(req.method==='PUT'){const t=await req.text();if(t.length>1500000)return J({error:'too big'},413);await this.state.storage.put('d',JSON.parse(t));return J({ok:true,at:Date.now()})}
    return J({error:'method'},405)}
}
export default{
  async fetch(req,env){
    const u=new URL(req.url),m=u.pathname.match(/^\/api\/t\/([a-z0-9-]{1,40})(\/check)?$/);
    if(!m)return env.ASSETS.fetch(req);
    if(req.method==='OPTIONS')return cors(req,new Response(null,{status:204}));
    if(req.method!=='GET'){const k=req.headers.get('x-key')||'';if(await sha(k)!==KEY_HASH)return cors(req,J({error:'forbidden'},403))}
    if(m[2])return cors(req,J({ok:true}));
    const stub=env.STORE.get(env.STORE.idFromName(m[1]));
    return cors(req,await stub.fetch(new Request('https://do/',{method:req.method,body:req.method==='PUT'?await req.text():undefined})));
  }
}
