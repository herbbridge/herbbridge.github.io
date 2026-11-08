import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {validateConfig} from '../client.mjs';
import {validSiteKey} from '../app/captcha.mjs';
const root=new URL('../',import.meta.url),output=new URL('dev-dist/',root);
const config={url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY};validateConfig(config);
// Optional robot check: only the public Turnstile site key belongs here, never the secret.
const captchaKey=process.env.HERBBRIDGE_CAPTCHA_SITE_KEY||'';if(captchaKey){if(!validSiteKey(captchaKey))throw new Error('HERBBRIDGE_CAPTCHA_SITE_KEY is not a valid site key.');config.captchaSiteKey=captchaKey;}
const turnstile=captchaKey?' https://challenges.cloudflare.com':'';
if(process.env.HERBBRIDGE_ENV!=='development'||new URL(config.url).hostname!==`${process.env.SUPABASE_EXPECTED_PROJECT_REF}.supabase.co`)throw new Error('Explicit matching development project required.');
await mkdir(output,{recursive:true});
await build({entryPoints:[new URL('app/main.mjs',root).pathname],outfile:new URL('app.js',output).pathname,bundle:true,format:'esm',platform:'browser',target:['es2022'],define:{__HERBBRIDGE_CONFIG__:JSON.stringify(config)},minify:false,sourcemap:false,logLevel:'warning',alias:{'herbbridge-lookup':new URL('../03_App_Code/js/lookup.js',root).pathname}});
for(const file of ['index.html','styles.css'])await copyFile(new URL('app/'+file,root),new URL(file,output));
await mkdir(new URL('design/',output),{recursive:true});await copyFile(new URL('../chatgpt update/prototype/index.html',root),new URL('design/index.html',output));
console.log('Development account app built. No private credentials included.');
if(!process.argv.includes('--build-only')){
const allowed={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/design/':'design/index.html','/design/index.html':'design/index.html'};
createServer(async(req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1:8012').pathname,file=allowed[path],data=/^\/data\/(herbs|drugs|interactions|official|reviews)\.json$/.exec(path);
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self'${turnstile}; style-src 'self'; connect-src 'self'${turnstile} ${config.url} wss://${new URL(config.url).host}; img-src 'self' data:;${captchaKey?' frame-src https://challenges.cloudflare.com;':''} base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
 if(data){try{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(await readFile(new URL('../03_App_Code/data/'+data[1]+'.json',root)));}catch{res.writeHead(500);res.end('Data unavailable');}return;}
 if(!file){res.writeHead(404);res.end('Not found');return;}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(new URL(file,output)));}catch{res.writeHead(500);res.end('Development app unavailable');}
}).listen(8012,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8012/'));
}
