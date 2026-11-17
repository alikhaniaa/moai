// Isolated action/upload checks: no database, external services, or files written.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
const SRC = new URL('../src/', import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`
const src=${JSON.stringify(SRC)};
const mocks={
 '@/lib/db':'export const db=globalThis.__heroTest.db',
 '@/lib/auth':'export async function requireAdmin(){return globalThis.__heroTest.admin}',
 'next/navigation':'export function redirect(url){throw new Error("REDIRECT:"+url)}',
 'next/cache':'export function revalidatePath(path){globalThis.__heroTest.invalidated.push(path)}',
 'next/server':'export const NextResponse=Response',
 'fs/promises':'export async function mkdir(){}; export async function writeFile(p,b){globalThis.__heroTest.files.set(p,b)}; export async function readFile(p){if(!globalThis.__heroTest.files.has(p))throw new Error("missing file");return globalThis.__heroTest.files.get(p)}'
};
export function resolve(s,c,n){
 if(mocks[s])return {url:'data:text/javascript,'+encodeURIComponent(mocks[s]),shortCircuit:true};
 if(s.startsWith('@/'))return n(src+s.slice(2)+'.ts',c);
 return n(s,c);
}
`));
const state=globalThis.__heroTest={admin:{id:'admin'},stored:{shopPhone:'existing',appearanceMain:'#326d9c'},files:new Map(),invalidated:[],fail:false};
state.db={setting:{upsert:op=>op},$transaction:async ops=>{
 if(state.fail)throw new Error('unavailable');
 for(const {create}of ops)state.stored[create.key]=create.value;
}};
const {HERO_DEFAULTS,getHeroContent}=await import(SRC+'lib/hero.ts');
const {saveHeroText,saveHeroImage}=await import(SRC+'app/admin/homepage/hero-actions.ts');
const {POST}=await import(SRC+'app/api/admin/upload/route.ts');
const {GET}=await import(SRC+'app/api/hero-image/[name]/route.ts');
const form=values=>{const data=new FormData();for(const[k,v]of Object.entries(values))data.set(k,v);return data};
assert.deepEqual(getHeroContent({}),HERO_DEFAULTS);
assert.deepEqual(getHeroContent({heroTitle:'unused legacy',heroSubtitle:'unused legacy'}),HERO_DEFAULTS);
assert.deepEqual(getHeroContent({landingTitleFirst:'<script>',landingButtonHref:'//evil.test',landingImage:'/uploads/../../.env'}),HERO_DEFAULTS);
console.log('PASS: old settings preserve the exact original hero; invalid stored content safely falls back');
const text={...HERO_DEFAULTS,landingTitleFirst:'پاییز را',landingButtonText:'دیدن محصولات',landingButtonHref:'/about',landingImage:'/uploads/forged.webp'};
assert.equal((await saveHeroText({},form(text))).saved,true);
assert.equal(state.stored.landingTitleFirst,'پاییز را');
assert.equal(state.stored.landingButtonHref,'/about');
assert.equal(state.stored.landingImage,undefined);
const before={...state.stored};
for(const invalid of [{landingTitleFirst:''},{landingTitleFirst:'x'.repeat(31)},{landingTitleAccent:'<b>text</b>'},{landingTitleLast:'two\nlines'},{landingButtonHref:'javascript:alert(1)'},{landingButtonHref:'//evil.test'}]){
 assert.ok((await saveHeroText({},form({...text,...invalid}))).error);
 assert.deepEqual(state.stored,before);
}
state.fail=true;
assert.ok((await saveHeroText({},form(text))).error);
assert.deepEqual(state.stored,before);
state.fail=false;
assert.equal(state.stored.shopPhone,'existing');
assert.equal(state.stored.appearanceMain,'#326d9c');
console.log('PASS: text edits are atomic, bounded, plain text, limited to existing site destinations, and cannot change the photo or other settings');
state.admin=null;
await assert.rejects(saveHeroText({},form(text)),/REDIRECT:\/login/);
await assert.rejects(saveHeroImage({},form({landingImage:HERO_DEFAULTS.landingImage})),/REDIRECT:\/login/);
assert.equal((await POST(new Request('http://localhost/api/admin/upload',{method:'POST',body:form({})}))).status,403);
state.admin={id:'admin'};
console.log('PASS: both save actions and photo uploads require admin authentication');
const sharp=(await import('sharp')).default;
const upload=async(bytes,type='image/jpeg',purpose='hero')=>{
 const data=form({purpose});data.set('file',new File([bytes],'photo.jpg',{type}));
 return POST(new Request('http://localhost/api/admin/upload',{method:'POST',body:data}));
};
for(const [bytes,type]of [[Buffer.from('corrupt'),'image/jpeg'],[Buffer.alloc(8*1024*1024+1),'image/jpeg'],[Buffer.from('<svg/>'),'image/svg+xml'],[await sharp({create:{width:500,height:300,channels:3,background:'blue'}}).jpeg().toBuffer(),'image/jpeg'],[await sharp({create:{width:1200,height:1800,channels:3,background:'blue'}}).jpeg().toBuffer(),'image/jpeg']]){
 assert.equal((await upload(bytes,type)).status,400);
}
assert.equal(state.files.size,0);
for(const[width,height]of [[1600,900],[4000,800]]){
 const bytes=await sharp({create:{width,height,channels:3,background:'#4a8578'}}).jpeg().toBuffer();
 const res=await upload(bytes);assert.equal(res.status,200);
 const {url}=await res.json();
 assert.match(url,/^\/uploads\/[0-9a-f-]{36}\.webp$/);
 assert.deepEqual(state.stored,before,'upload must not activate photo');
 const out=state.files.get(path.join(process.cwd(),'public',url));
 const served=await GET(new Request('http://localhost'),{params:Promise.resolve({name:url.slice('/uploads/'.length)})});
 assert.equal(served.status,200);assert.equal(served.headers.get('Content-Type'),'image/webp');
 assert.deepEqual(Buffer.from(await served.arrayBuffer()),out);
 const meta=await sharp(out).metadata();assert.equal(meta.format,'webp');assert.ok(meta.height>=600);
 assert.equal((await saveHeroImage({},form({landingImage:url}))).saved,true);
 assert.equal(state.stored.landingImage,url);
 // A later corrupt replacement is rejected without changing the saved setting.
 state.files.set(path.join(process.cwd(),'public',url),Buffer.from('corrupt'));
 assert.ok((await saveHeroImage({},form({landingImage:url}))).error);
 assert.equal(state.stored.landingImage,url);
 assert.equal((await saveHeroImage({},form({landingImage:HERO_DEFAULTS.landingImage}))).saved,true);
 delete state.stored.landingImage; // maintain the baseline for the next upload
}
for(const image of ['https://evil.test/photo.webp','/uploads/../../.env','/uploads/00000000-0000-0000-0000-000000000000.webp'])assert.ok((await saveHeroImage({},form({landingImage:image}))).error);
assert.equal((await saveHeroImage({},form({landingImage:HERO_DEFAULTS.landingImage}))).saved,true);
for(const name of ['../../.env','hero.jpg','00000000-0000-0000-0000-000000000000.webp'])assert.equal((await GET(new Request('http://localhost'),{params:Promise.resolve({name})})).status,404);
assert.equal(state.stored.landingImage,HERO_DEFAULTS.landingImage);
assert.equal(state.stored.landingTitleFirst,before.landingTitleFirst);
console.log('PASS: corrupt, oversized, small, portrait, missing and external photos are rejected; valid uploads are optimized, preview-only until saved, and restorable independently of text');
