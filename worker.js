// Worker: віддає статичні файли з ./site + API для живих даних турніру (Franko Cup)
const KEY_HASH='1ece04141872fc261d475577cbe036488cfb32142093fca76f994cbaf6301318';
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
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
    if(req.method!=='GET'){const k=req.headers.get('x-key')||'';if(await sha(k)!==KEY_HASH)return J({error:'forbidden'},403)}
    if(m[2])return J({ok:true});
    const stub=env.STORE.get(env.STORE.idFromName(m[1]));
    return stub.fetch(new Request('https://do/',{method:req.method,body:req.method==='PUT'?await req.text():undefined}));
  }
}
