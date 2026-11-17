// Isolated regression checks: no database, HTTP server, or gateway is contacted.
import assert from 'node:assert/strict';
import { register } from 'node:module';
const SRC = new URL('../src/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`
const src=${JSON.stringify(SRC)};
const mocks={
 '@/lib/db':'export const db=globalThis.__snappTest.db',
 '@/lib/fulfil':'export async function fulfilPaidOrder(){globalThis.__snappTest.fulfilled++;return true}',
 '@/lib/notify':'export async function notifyShopOwner(){globalThis.__snappTest.notified++}',
 'next/server':'export const NextResponse={redirect:(url,status)=>new Response(null,{status,headers:{location:url}})}'
};
export function resolve(s,c,n){
 if(s==='server-only')return {url:'data:text/javascript,',shortCircuit:true};
 if(mocks[s])return {url:'data:text/javascript,'+encodeURIComponent(mocks[s]),shortCircuit:true};
 if(s.startsWith('@/'))return n(src+s.slice(2)+'.ts',c);
 return n(s,c);
}`));
const { buildCartList, forgetToken } = await import(SRC+'lib/snapppay-api.ts');
const { snapppayItems, repriceOrder } = await import(SRC+'lib/snapppay-cart.ts');
const lines = [
 {id:'a',productId:'a',nameFa:'plain',sizeLabel:null,colorName:null,unitPrice:20000,qty:2},
 {id:'b',productId:'b',nameFa:'sale',sizeLabel:null,colorName:null,unitPrice:25000,qty:1}
];
let invoice={goodsTotal:65000,discount:5000,shippingCost:15000};
for (const remaining of [lines,[{...lines[0],qty:1},lines[1]],[{...lines[0],qty:1},{...lines[1],qty:0}]]) {
 const priced=repriceOrder(remaining,invoice);
 const c=buildCartList({items:snapppayItems(remaining),discountRial:priced.discount*10,shippingRial:150000});
 const cart=c.cartList[0];
 assert.equal(cart.totalAmount,cart.cartItems.reduce((s,i)=>s+i.count*i.amount,0)+cart.shippingAmount);
 assert.equal(c.amount,priced.total*10);
 assert.equal(cart.isShipmentIncluded,true);
 assert.equal(cart.isTaxIncluded,true);
 assert.equal(cart.cartItems[0].amount,200000);
 assert.ok(cart.cartItems.every(i=>i.count>0));
 invoice={...priced};
}
console.log('PASS: initial 75,000 Toman basket and both sequential partial returns follow documented arithmetic');
Object.assign(process.env,{SNAPPPAY_BASE_URL:'https://example.invalid',SNAPPPAY_CLIENT_ID:'test',SNAPPPAY_CLIENT_SECRET:'test',SNAPPPAY_USERNAME:'test',SNAPPPAY_PASSWORD:'test',SITE_URL:'https://example.invalid'});
const state=globalThis.__snappTest={fulfilled:0,notified:0,payment:null};
state.db={payment:{
 findUnique:async()=>state.payment,
 updateMany:async({where,data})=>{if(state.payment.status!==where.status)return {count:0};Object.assign(state.payment,data);return {count:1}},
 update:async({data})=>Object.assign(state.payment,data)
},order:{findUnique:async()=>({id:'order',fullName:'Test',total:75000})}};
const {POST}=await import(SRC+'app/api/payment/snapppay/callback/route.ts');
for(const mode of ['settle-fails','settle-ok','settle-status-recovers','reversed']){
 forgetToken();state.fulfilled=0;state.notified=0;
 state.payment={id:'p',orderId:'order',provider:'SNAPPPAY',status:'PENDING',token:'fake',amountRial:750000};
 let calls=0;
 globalThis.fetch=async(url)=>{
  calls++;const p=new URL(url).pathname;
  let data=p.endsWith('/oauth/token')?{access_token:'fake',expires_in:3600}
   :p.endsWith('/verify')?{successful:true,response:{transactionId:'123456789'}}
   :p.endsWith('/status')?{successful:true,response:{status:mode==='reversed'?'REVERT':mode==='settle-status-recovers'?'SETTLE':'VERIFY'}}
   :mode==='settle-ok'?{successful:true,response:{}}
   :{successful:false,errorData:{errorCode:1000}};
  return new Response(JSON.stringify(data),{status:200});
 };
 const request=()=>new Request('https://example.invalid/api/payment/snapppay/callback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transactionId:'123456789',state:'OK',amount:750000})});
 assert.equal((await POST(request())).status,303);
 const paid=['settle-ok','settle-status-recovers'].includes(mode);
 assert.equal(state.payment.status,paid?'PAID':mode==='reversed'?'REVERSED':'SETTLEMENT_PENDING');
 assert.equal(state.fulfilled,paid?1:0);assert.equal(state.notified,paid?1:0);
 if(!paid)assert.ok(!state.payment.paidAt);
 const before=calls;await POST(request());assert.equal(calls,before);assert.equal(state.fulfilled,paid?1:0);
 console.log('PASS: '+mode+'; settlement gates fulfilment, duplicate callback is harmless');
}
