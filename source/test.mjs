import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const req=createRequire(resolve(process.argv[2]||'.','package.json'));
const {chromium}=req('playwright-core');
const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=metal']});
const page=await b.newPage({viewport:{width:1536,height:760},deviceScaleFactor:1,reducedMotion:'reduce'});
const errors=[],external=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
const press=async s=>page.locator(s).first().click({timeout:4500});
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};
try{
await page.goto(pathToFileURL(resolve('大数据驾驶舱.html')).href);
await page.waitForSelector('body[data-ready=yes]',{timeout:20000});await page.screenshot({path:'review/全景.png'});
for(let i=0;i<7;i++){
  await press('[data-topic="'+i+'"]');const name=await page.locator('[data-topic="'+i+'"]').innerText();
  check(name,await page.locator('#panel h2').innerText()===name);
  await press('[data-row="0"]');check(name+'记录定位',await page.locator('.definition').innerText().then(t=>t.includes('关联记录')));
  await press('.back');check(name+'返回专题',await page.locator('#panel h2').innerText()===name);
}
const ids=new Set();
for(let t=0;t<7;t++){
  await press('[data-topic="'+t+'"]');
  for(const id of await page.locator('[data-item]').evaluateAll(els=>els.map(el=>el.dataset.item))){
    if(ids.has(id))continue;await press('[data-item="'+id+'"]');check('展品 '+id,(await page.locator('.eyebrow').innerText()).includes(id));ids.add(id);await press('.back');
  }
}check('全量资产入口',ids.size===15);
await press('#overview');await press('#pins [data-id="S1"]');await press('#pins [data-id="A01"]');check('三维锚点逐级选择',await page.locator('#panel h2').innerText()==='种子样盘');
await press('#overview');
const box=await page.locator('#stage canvas').boundingBox();
let picked=false;
for(const [fx,fy] of [[.18,.23],[.20,.24],[.13,.31],[.22,.19],[.17,.3],[.59,.29],[.6,.32],[.32,.35],[.77,.61],[.39,.57],...Array.from({length:54},(_,i)=>[(i%9+1)/10,(Math.floor(i/9)+1)/7])]){
  const xy=[box.x+box.width*fx,box.y+box.height*fy];
  if(!await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.tagName==='CANVAS',xy))continue;
  await page.mouse.click(...xy);
  if(await page.locator('#panel h2').count()){picked=true;break}
}
check('全景实际点击',picked);
await press('[data-topic="5"]');await page.screenshot({path:'review/追溯.png'});
await press('[data-view="1"]');await press('[data-node="3"]');check('图谱切关联',await page.locator('.flow.focus').count()>0);
await page.screenshot({path:'review/图谱.png'});await press('[data-row="0"]');check('图谱记录定位实物',await page.locator('[data-view="2"]').getAttribute('aria-pressed')==='true');
await press('.back');check('返回原图谱',await page.locator('[data-view="1"]').getAttribute('aria-pressed')==='true');await press('[data-row="0"]');
await press('[data-camera="side"]');await press('#wire');check('沙盘线框',await page.locator('#wire').getAttribute('aria-pressed')==='true');
await page.screenshot({path:'review/线框.png'});
await press('#overview');await press('#theme');await press('#palettes [data-theme="blue"]');check('湖蓝主题',await page.locator('body').getAttribute('data-theme')==='blue');
await page.reload();await page.waitForSelector('body[data-ready=yes]');check('配色持久化',await page.locator('body').getAttribute('data-theme')==='blue');
await press('#theme');await press('#palettes [data-theme="amber"]');check('琥珀主题',await page.locator('body').getAttribute('data-theme')==='amber');
await press('#theme');await press('#palettes [data-theme="jade"]');
await press('#full');check('进入全屏',await page.evaluate(()=>!!document.fullscreenElement));await press('#full');
await page.setViewportSize({width:2097,height:750});await page.waitForTimeout(240);await page.screenshot({path:'review/超宽屏.png'});
await page.setViewportSize({width:1280,height:720});await press('[data-topic="3"]');await page.screenshot({path:'review/基地监管.png'});
await page.setViewportSize({width:390,height:844});await press('[data-topic="6"]');check('窄屏导航',await page.locator('#panel h2').innerText()==='种业政策与产业服务');
await page.setViewportSize({width:1536,height:760});await page.emulateMedia({reducedMotion:'no-preference'});await press('#play');await press('[data-topic="1"]');await page.waitForTimeout(4400);
check('手动打断后无旧镜头',await page.locator('#play').innerText()==='自动演示'&&await page.locator('#panel h2').innerText()==='育种研发协同');
await press('#play');await page.waitForFunction(()=>document.querySelector('#play').textContent==='自动演示',null,{timeout:52000});
check('演示正常结束回到全景',await page.locator('#panel').isHidden()&&await page.locator('[data-view="0"]').getAttribute('aria-pressed')==='true');
check('无脚本异常',errors.length===0);check('离线零外部请求',external.length===0);
console.log('passed',checks.length);
}finally{writeFileSync('review/浏览器检查.json',JSON.stringify({checks,errors,external},null,2));await b.close()}
