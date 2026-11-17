// Only an isolated review database and localhost:3010; never calls SMS or payments.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {PrismaClient} from '@prisma/client';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
assert.ok((process.env.DATABASE_URL??'').replaceAll('\\','/').endsWith('/tmp/hero-review-20261008.db'),'Use isolated hero review database');
const BASE='http://localhost:3010';
const db=new PrismaClient();
const out=path.resolve('tmp/hero-screenshots');
let browser,uploaded;
const errors=[];
try{
 await mkdir(out,{recursive:true});
 await db.setting.deleteMany({where:{key:{startsWith:'landing'}}});
 await db.setting.upsert({where:{key:'popupEnabled'},create:{key:'popupEnabled',value:'0'},update:{value:'0'}});
 const other=await db.setting.findMany({where:{key:{not:{startsWith:'landing'}}},orderBy:{key:'asc'}});
 const admin=await db.user.findFirst({where:{role:'ADMIN'},select:{id:true}});assert.ok(admin);
 browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=request.url();
  if(url.startsWith('http')&&!url.startsWith(BASE))void request.abort();else void request.continue();
 });
 await page.evaluateOnNewDocument(()=>sessionStorage.setItem('moai_intro_seen','1'));
 await page.goto(BASE+'/admin/homepage',{waitUntil:'networkidle0'});assert.ok(page.url().includes('/login'));
 const payload=`${admin.id}.${Date.now()+3600000}`;
 const sig=createHmac('sha256',process.env.SESSION_SECRET??'moai-dev-secret').update(payload).digest('hex').slice(0,32);
 await page.setCookie({name:'moai_session',value:`${payload}.${sig}`,domain:'localhost',path:'/'});
 await page.goto(BASE+'/admin/homepage',{waitUntil:'networkidle0'});
 assert.ok(await page.$('[data-hero-text-form]'));
 assert.ok(await page.$('[data-hero-image-form]'));
 assert.ok(await page.$eval('[data-hero-image-form]',el=>el.textContent.includes('اجازه و هماهنگی توسعه‌دهنده')));
 const changeText=async(selector,value)=>{
  await page.focus(selector);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type(selector,value);
  assert.equal(await page.$eval(selector,el=>el.value),value,'test input replaced correctly');
 };
 if(!process.argv.includes('--photo-only')){
 await changeText('#landingTitleFirst','پاییز را');
 await changeText('#landingButtonText','دیدن محصولات پاییزی');
 await page.select('#landingButtonHref','/about');
 assert.equal(await db.setting.findUnique({where:{key:'landingTitleFirst'}}),null,'preview must not write');
 await page.click('[data-hero-text-form] button:not([type="button"])');
 await page.waitForFunction(()=>document.querySelector('[data-hero-text-form]').textContent.includes('✓ متن و دکمه ذخیره شد.'));
 assert.equal((await db.setting.findUnique({where:{key:'landingTitleFirst'}})).value,'پاییز را');
 console.log('PASS: authenticated text editor previews before saving and persists its text and selected destination');
 for(const width of[320,375,1440]){
  await page.setViewport({width,height:900});await page.goto(BASE+'/',{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.hero-line')).transform==='matrix(1, 0, 0, 1, 0, 0)');
  assert.ok(await page.$eval('h1',el=>el.textContent.includes('پاییز را')));
  assert.equal(await page.$eval('.hero-soft a',el=>el.getAttribute('href')),'/about');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await page.$eval('.hero-bg img',img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:path.join(out,`storefront-${width}.png`)});
  await page.goto(BASE+'/admin/homepage',{waitUntil:'networkidle0'});
  const fits=await page.$$eval('[data-hero-text-form], [data-hero-image-form]',forms=>forms.every(form=>form.scrollWidth<=form.clientWidth));assert.ok(fits,`forms fit at ${width}`);
  await page.screenshot({path:path.join(out,`admin-${width}.png`),fullPage:true});
 }
 console.log('PASS: storefront and both admin editors at 320, 375 and 1440 pixels; current image remains loaded');
 }
 const fixture=path.resolve('tmp/hero-review-fixture.jpg');
 await writeFile(fixture,await sharp({create:{width:1600,height:900,channels:3,background:'#456b7d'}}).jpeg().toBuffer());
 const fileInput=await page.$('[data-hero-image-form] input[type="file"]');
 await fileInput.uploadFile(fixture);
 await page.waitForFunction(()=>document.querySelector('input[name="landingImage"]').value.startsWith('/uploads/'));
 uploaded=await page.$eval('input[name="landingImage"]',el=>el.value);
 assert.equal(await db.setting.findUnique({where:{key:'landingImage'}}),null,'upload must not activate');
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-hero-image-preview] img')].every(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await page.$$eval('[data-hero-image-preview] img',imgs=>imgs.length===2&&imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
 await page.click('[data-hero-image-form] button:not([type="button"])');
 await page.waitForFunction(()=>document.querySelector('[data-hero-image-form]').textContent.includes('✓ تصویر صفحه اصلی ذخیره شد.'));
 assert.equal((await db.setting.findUnique({where:{key:'landingImage'}})).value,uploaded);
 await page.goto(BASE+'/',{waitUntil:'networkidle0'});
 assert.equal(await page.$eval('.hero-bg img',el=>new URL(el.getAttribute('src'),location.href).pathname),'/api/hero-image/'+uploaded.slice('/uploads/'.length));
 assert.equal(await page.$eval('.hero-bg img',el=>el.complete&&el.naturalWidth>0),true);
 console.log('PASS: upload produces both crop previews without activating; separate save activates the valid photo');
 await db.setting.update({where:{key:'landingImage'},data:{value:'/uploads/00000000-0000-0000-0000-000000000000.webp'}});
 await page.goto(BASE+'/',{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>new URL(document.querySelector('.hero-bg img').getAttribute('src'),location.href).pathname==='/images/hero.jpg'&&document.querySelector('.hero-bg img').naturalWidth>0);
 console.log('PASS: missing custom image falls back to the original without breaking the page');
 await page.goto(BASE+'/admin/homepage',{waitUntil:'networkidle0'});
 await page.$$eval('[data-hero-image-form] button',buttons=>buttons.find(b=>b.textContent.includes('بازگرداندن تصویر اصلی')).click());
 await page.click('[data-hero-image-form] button:not([type="button"])');
 await page.waitForFunction(()=>document.querySelector('[data-hero-image-form]').textContent.includes('✓ تصویر صفحه اصلی ذخیره شد.'));
 for(const[id,size]of[['landingTitleFirst',30],['landingTitleAccent',18],['landingTitleLast',18],['landingButtonText',40]])await changeText('#'+id,'ط'.repeat(size));
 await page.click('[data-hero-text-form] button:not([type="button"])');
 await page.waitForFunction(()=>document.querySelector('[data-hero-text-form]').textContent.includes('✓ متن و دکمه ذخیره شد.'));
 for(const width of[320,375,1440]){
  await page.setViewport({width,height:900});await page.goto(BASE+'/',{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.hero-line')).transform==='matrix(1, 0, 0, 1, 0, 0)');
  assert.ok(await page.$$eval('.hero-line',els=>els.every(el=>el.scrollWidth<=el.clientWidth)));
  assert.ok(await page.$eval('.hero-soft a',el=>el.scrollWidth<=el.clientWidth));
  await page.screenshot({path:path.join(out,`long-text-${width}.png`)});
 }
 await page.goto(BASE+'/admin/homepage',{waitUntil:'networkidle0'});
 await page.$$eval('[data-hero-text-form] button',buttons=>buttons.find(b=>b.textContent.includes('بازگرداندن متن اصلی')).click());
 await page.click('[data-hero-text-form] button:not([type="button"])');
 await page.waitForFunction(()=>document.querySelector('[data-hero-text-form]').textContent.includes('✓ متن و دکمه ذخیره شد.'));
 assert.equal((await db.setting.findUnique({where:{key:'landingTitleFirst'}})).value,'تابستان را');
 for(const route of['/','/products','/account','/admin/settings','/admin/orders','/admin/appearance','/track'])assert.equal((await page.goto(BASE+route,{waitUntil:'networkidle0'})).status(),200,route);
 assert.deepEqual(await db.setting.findMany({where:{key:{not:{startsWith:'landing'}}},orderBy:{key:'asc'}}),other);
 assert.deepEqual(errors,[]);
 console.log('PASS: maximum length text wraps; original text and image are restorable; account/orders/settings remain healthy; unrelated settings and colors unchanged; no browser exceptions');
}finally{
 await browser?.close();await db.$disconnect();
 if(uploaded)await unlink(path.join(process.cwd(),'public',uploaded)).catch(()=>{});
}
