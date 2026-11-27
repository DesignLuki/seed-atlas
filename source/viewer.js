import {topics,views,tour} from './topics.js';
import {makeScene} from './scene.js';
const $=id=>document.getElementById(id),catalog=window.exhibits;
const byId=new Map(catalog.items.map(row=>[row[0],row]));
const paths={sprout:'M12 21v-9m0 5C5 17 3 12 3 7c6 0 9 3 9 8m0-3c0-6 3-9 9-10 1 7-3 11-9 11',flask:'M9 3h6m-5 0v6l-6 9q-1 3 3 3h10q4 0 3-3l-6-9V3M8 15h8',badge:'m12 3 2 2 3 .4.8 2.6 2 2-1 2.5v3l-3 1-1.7 2.5-2.6-.7-2.6.7L7 16.5l-3-1v-3l-1-2.5 2-2 .8-2.6L9 5Zm-4 8 3 3 5-6',field:'m3 13 9-6 9 6-9 7Zm3 2 8-6m-4 8 8-6',bars:'M4 20h17M6 17v-5m5 5V7m5 10V4',route:'M5 5h9c6 0 6 8 0 8H9c-6 0-6 6 0 6h11M3 5h2m14 12 2 2-2 2',book:'M12 6c-2-2-5-2-9-2v13c4 0 7 0 9 3m0-14c2-2 5-2 9-2v13c-4 0-7 0-9 3Zm0 0v14',layers:'m3 8 9-5 9 5-9 5Zm0 5 9 5 9-5M3 17l9 5 9-5',cube:'m3 7 9-5 9 5v10l-9 5-9-5Zm0 0 9 5 9-5m-9 5v10',play:'m7 4 13 8-13 8Z',stop:'M6 6h12v12H6z',full:'M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6',theme:'M12 3c6 0 10 4 10 9 0 3-2 4-4 4h-2c-2 0-2 2-1 3 0 2-2 3-4 2C5 20 2 17 2 12s4-9 10-9Zm-6 7h1m3-4h1m4 1h1m2 4h1'};
function icon(key){return '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[key]+'"/></svg>'}
const s={view:0,t:-1,asset:'',record:null,origin:null,dir:'iso',wire:false};
let api=null,idx=-1,timer=null,theme='jade',failed=false;
function topicStation(id){return topics.findIndex(x=>x.station===id)}
function setTheme(id){
  theme=id;document.body.dataset.theme=id;api?.theme(id);
  document.querySelectorAll('#palettes button').forEach(el=>el.setAttribute('aria-pressed',el.dataset.theme===id));
  try{localStorage.setItem('seed-cockpit-color',id)}catch{}
}
function activeButtons(sel,key,value){document.querySelectorAll(sel).forEach(el=>el.setAttribute('aria-pressed',String(el.dataset[key])===String(value)))}
function playUI(){
  $('play').innerHTML=icon(idx<0?'play':'stop')+(idx<0?'自动演示':'停止演示');
  $('step').textContent=idx<0?'':(idx+1)+' / '+tour.length+'　'+tour[idx].label;
}
function stop(){clearTimeout(timer);idx=-1;playUI()}
function manual(fn){return (...args)=>{stop();fn(...args)}}
function currentStation(){return s.asset?byId.get(s.asset)[2]:s.t<0?'':topics[s.t].station}
function reset(){Object.assign(s,{view:0,t:-1,asset:'',record:null,origin:null,dir:'iso',wire:false});render()}
function closePanel(){
  if(s.asset){s.asset='';s.record=null;if(s.origin!==null)s.view=s.origin;s.origin=null}else{s.t=-1}
  render()
}
function selectTopic(i){Object.assign(s,{t:i,asset:'',record:null,origin:null,dir:s.view===2?'top':'iso'});render()}
function selectItem(id,record=null){
  if(!byId.has(id))return;
  if(s.t<0||!topics[s.t].assets.includes(id))s.t=topicStation(byId.get(id)[2]);
  if(!s.asset)s.origin=s.view;s.asset=id;s.record=record;if(s.view===1)s.view=2;s.dir='iso';render()
}
function changeView(i){
  s.view=i;s.asset='';s.record=null;s.origin=null;s.dir=i===2?'top':'iso';s.wire=false;render()
}
function svgChart(t){
  const values=t.trend,base=Math.floor(Math.min(...values)*.82),max=Math.max(...values);
  const pts=values.map((v,i)=>[3+i*48,42-(v-base)/(max-base)*36]);
  const poly=pts.map(p=>p.join(',')).join(' ');
  return '<svg class="spark" viewBox="0 0 246 48" preserveAspectRatio="none" role="img" aria-label="'+t.series+'，六月至十一月：'+values.join('、')+' '+t.unit+'"><path d="M2 41H244M2 23H244" stroke="var(--faint)" stroke-width=".7"/><polygon points="3,45 '+poly+' 243,45" fill="var(--accent)" opacity=".11"/><polyline points="'+poly+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>'+pts.map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="2" fill="var(--shine)"/>').join('')+'</svg>';
}
function drawPanel(){
  const t=topics[s.t],a=byId.get(s.asset),panel=$('panel');panel.hidden=!t;
  if(!t){panel.replaceChildren();return}
  const header='<div class="eyebrow"><span>'+(a?'展品档案　/　'+a[0]:'业务专题　/　演示数据')+'</span><button class="close" aria-label="关闭详情">×</button></div>';
  if(a){
    const rec=s.record;
    panel.innerHTML=header+'<h2>'+a[1]+'</h2><p>'+a[5]+'</p><dl class="definition"><dt>所属展台</dt><dd>'+catalog.stations.find(r=>r[0]===a[2])[1]+'</dd><dt>业务专题</dt><dd>'+t.name+'</dd>'+(rec?'<dt>关联记录</dt><dd>'+rec.slice(0,3).join(' · ')+'</dd>':'')+'</dl><button class="back">‹ 返回专题</button>';
    panel.querySelector('.back').onclick=manual(closePanel);
  }else{
    panel.innerHTML=header+'<h2>'+t.name+'</h2><p>'+t.desc+'</p><div class="kpi"><small>'+t.metric+'</small><span><b>'+t.value+'</b> <small>'+t.unit+'</small></span></div>'+svgChart(t)+'<div class="chartmeta"><span>06 月</span><span>'+t.series+'</span><span>11 月</span></div><div class="listhead">业务记录</div><div class="record" aria-hidden="true">'+t.headers.map(v=>'<span>'+v+'</span>').join('')+'</div>'+t.rows.map((r,i)=>'<button class="record" data-row="'+i+'"><b>'+r[0]+'</b><span>'+r[1]+'</span><span>'+r[2]+' ›</span></button>').join('')+'<div class="listhead">关联展品</div><div class="chips">'+t.assets.map(id=>'<button data-item="'+id+'">'+byId.get(id)[1]+'</button>').join('')+'</div>';
    panel.querySelectorAll('[data-row]').forEach(el=>el.onclick=manual(()=>{const r=t.rows[+el.dataset.row];selectItem(r[3],r)}));
    panel.querySelectorAll('[data-item]').forEach(el=>el.onclick=manual(()=>selectItem(el.dataset.item)));
  }
  panel.querySelector('.close').onclick=manual(closePanel);panel.scrollTop=0;
}
$('mobileTopic').innerHTML='<option value="-1">全部专题</option>'+topics.map((t,i)=>'<option value="'+i+'">'+t.name+'</option>').join('');
$('mobileTopic').onchange=manual(()=>selectTopic(Number($('mobileTopic').value)));
const graphPos=[[9,36],[29,36],[51,17],[51,66],[88,36],[72,66],[25,83]],edges=[[0,1],[1,2],[1,3],[2,4],[3,5],[5,4],[6,0],[6,3]];
function initGraph(){
  const net=$('network'),svg=net.querySelector('svg');svg.setAttribute('viewBox','0 0 1000 500');svg.setAttribute('preserveAspectRatio','none');
  for(const [a,b] of edges){
    const [x,y]=graphPos[a].map((n,i)=>n*(i?5:10)),[u,v]=graphPos[b].map((n,i)=>n*(i?5:10));
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M'+x+' '+y+'C'+(x+u)/2+' '+y+' '+(x+u)/2+' '+v+' '+u+' '+v);path.dataset.a=a;path.dataset.b=b;path.setAttribute('class','flow');svg.append(path);
  }
  topics.forEach((t,i)=>{const b=document.createElement('button');b.className='node';b.dataset.node=i;b.style.left=graphPos[i][0]+'%';b.style.top=graphPos[i][1]+'%';b.innerHTML=icon(t.icon)+t.short;b.onclick=manual(()=>selectTopic(i));net.append(b)});
}
function render(smooth=true){
  $('mobileTopic').value=String(s.t);
  $('graph').hidden=s.view!==1;$('stage').hidden=s.view===1;$('sandbox').hidden=s.view!==2;
  $('screen').classList.toggle('detail',s.t>=0);drawPanel();
  activeButtons('#nav button','topic',s.t);activeButtons('#views button','view',s.view);activeButtons('.node','node',s.t);
  document.querySelectorAll('.flow').forEach(p=>p.classList.toggle('focus',+p.dataset.a===s.t||+p.dataset.b===s.t));
  activeButtons('[data-camera]','camera',s.dir);$('wire').setAttribute('aria-pressed',s.wire);
  api?.update({...s,station:currentStation()},smooth);
  if(failed)$('loading').hidden=false;
}
function advance(){
  if(++idx>=tour.length){stop();return}
  const step=tour[idx];Object.assign(s,{view:step.v,t:step.t,asset:step.a,record:null,origin:null,dir:step.v===2&&!step.a?'top':'iso',wire:false});render();playUI();timer=setTimeout(advance,idx===tour.length-1?1500:4200);
}
$('overview').onclick=manual(reset);
$('nav').innerHTML=topics.map((t,i)=>'<button data-topic="'+i+'">'+icon(t.icon)+'<span>'+t.name+'</span></button>').join('');
$('nav').querySelectorAll('button').forEach(el=>el.onclick=manual(()=>selectTopic(+el.dataset.topic)));
$('views').innerHTML=views.map((name,i)=>'<button data-view="'+i+'">'+icon(['sprout','layers','cube'][i])+name+'</button>').join('');
$('views').querySelectorAll('button').forEach(el=>el.onclick=manual(()=>changeView(+el.dataset.view)));
$('play').onclick=()=>{if(idx>=0)stop();else advance()};
$('wire').onclick=manual(()=>{s.wire=!s.wire;render(false)});
document.querySelectorAll('[data-camera]').forEach(el=>el.onclick=manual(()=>{s.dir=el.dataset.camera;render()}));
$('theme').innerHTML=icon('theme')+'配色';$('full').innerHTML=icon('full')+'全屏';
function palettes(open){$('palettes').hidden=!open;$('theme').setAttribute('aria-expanded',open)}
$('theme').onclick=()=>palettes($('palettes').hidden);
document.querySelectorAll('#palettes button').forEach(b=>b.onclick=()=>{setTheme(b.dataset.theme);palettes(false)});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#theme,#palettes'))palettes(false)});
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{$('full').title='请在浏览器菜单中进入全屏'}};
document.addEventListener('fullscreenchange',()=>{$('full').innerHTML=icon('full')+(document.fullscreenElement?'退出全屏':'全屏')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){stop();if(!$('palettes').hidden)palettes(false);else if(s.t>=0)closePanel();else reset()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
document.querySelector('.navicon').innerHTML=icon('sprout');initGraph();
try{const saved=localStorage.getItem('seed-cockpit-color');if(['jade','blue','amber'].includes(saved))theme=saved}catch{}
setTheme(theme);playUI();render(false);
makeScene($('stage'),catalog,manual(id=>id.startsWith('S')?selectTopic(topicStation(id)):selectItem(id)),stop).then(result=>{
  api=result;api.theme(theme);$('loading').hidden=true;render(false);document.body.dataset.ready='yes'
}).catch(err=>{failed=true;$('loading').textContent='三维场景加载失败，请使用支持 WebGL 2 的浏览器。业务导航和全链条图谱仍可使用。';console.error(err)});
