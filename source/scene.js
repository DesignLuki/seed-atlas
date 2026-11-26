import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

export async function makeScene(host,catalog,onPick,onDrag){
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setClearColor(0,0);
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-18,18,10,-10,.01,160);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enablePan=false;controls.maxPolarAngle=Math.PI*.49;controls.minZoom=.55;controls.maxZoom=4;
  const gen=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=gen.fromScene(room);
  scene.environment=env.texture;scene.environmentIntensity=.46;room.dispose();gen.dispose();
  scene.add(new T.HemisphereLight(0xf1f3de,0x586d5f,.83));
  const sun=new T.DirectionalLight(0xfff1d8,2.42);sun.position.set(-10,18,5);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-21,right:21,top:18,bottom:-18,far:60,near:.1});sun.shadow.mapSize.set(2048,2048);
  sun.shadow.normalBias=.011;sun.shadow.bias=-.0002;scene.add(sun);
  const fill=new T.DirectionalLight(0xb5ead4,1.12);fill.position.set(6,5,-9);scene.add(fill);
  const floor=new T.Mesh(new T.PlaneGeometry(180,180),new T.ShadowMaterial({opacity:.34}));floor.rotation.x=-Math.PI/2;floor.position.y=-.009;floor.receiveShadow=true;scene.add(floor);
  const bin=Uint8Array.from(atob(window.geometry64),v=>v.charCodeAt(0)).buffer;
  const asset=(await new GLTFLoader().parseAsync(bin,'')).scene;
  scene.add(asset);asset.updateMatrixWorld(true);
  const lookup=new Map(),meshes=[],stationOf=new Map(catalog.items.map(a=>[a[0],a[2]]));
  for(const [id] of [...catalog.stations,...catalog.items])lookup.set(id,asset.getObjectByName(id));
  const wire=new T.MeshBasicMaterial({color:0xbceaa6,wireframe:true,transparent:true,opacity:.65});
  asset.traverse(o=>{if(o.isMesh){o.userData.base=o.material;o.castShadow=!o.material.transparent;o.receiveShadow=true;meshes.push(o)}});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
  const grad=ctx.createRadialGradient(64,64,2,64,64,63);grad.addColorStop(0,'rgba(0,0,0,.95)');grad.addColorStop(.5,'rgba(0,0,0,.64)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const ao=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false});
  for(const [id,,, ,w,d] of catalog.stations){
    const shade=new T.Mesh(new T.PlaneGeometry(w*1.44,d*1.38),ao);shade.rotation.x=-Math.PI/2;shade.position.y=-.006;lookup.get(id).add(shade);shade.userData.ambient=true;
  }
  const grid=new T.GridHelper(65,42,0x4c9e88,0x456f65);grid.material.transparent=true;grid.material.opacity=.18;grid.position.y=-.013;scene.add(grid);
  const visible=new T.Group();scene.add(visible);
  let seed=112;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
  const points=[];for(let i=0;i<135;i++){const x=(rnd()-.5)*46,z=(rnd()-.5)*40;for(let j=0;j<3;j++)points.push(x+.13*j,.001,z+rnd()*.13)}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));const freckles=new T.Points(geo,new T.PointsMaterial({color:0x67b6a3,size:.035,transparent:true,opacity:.59}));visible.add(freckles);
  const stationLabels=document.querySelector('#pins'),labels=[],anchors=new Map();
  function anchor(id){
    if(!anchors.has(id)){
      const box=new T.Box3().setFromObject(lookup.get(id));const pos=box.getCenter(new T.Vector3());pos.y=box.max.y+.19;anchors.set(id,pos);
    }return anchors.get(id)
  }
  for(const [id,name] of [...catalog.stations,...catalog.items]){
    const el=document.createElement('button');el.className='pin';el.textContent=name;el.dataset.id=id;el.onclick=()=>onPick(id);stationLabels.append(el);labels.push([id,el]);anchor(id);
  }
  let state,pose=null,anim=0,running=false,armed=false,w=1,h=1;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const dirs={iso:[.481,.562,.877],top:[0,1,.0001],side:[1,.21,.03]};
  function draw(){
    if(!armed||!running)return;
    renderer.render(scene,camera);
    const placed=[];
    for(const [id,el] of labels){
      const station=state.station;
      const show=!state.asset&&(!station?id.startsWith('S'):stationOf.get(id)===station);
      if(!show){el.hidden=true;continue}
      const v=anchor(id).clone().project(camera),x=(v.x+1)*w/2,y=(1-v.y)*h/2;
      if(x<14||x>w-14||y<10||y>h-10){el.hidden=true;continue}
      let py=y-5;
      const collides=()=>placed.some(p=>Math.abs(p[0]-x)<66&&Math.abs(p[1]-py)<21);
      while(collides()&&py>28)py-=19;
      el.hidden=false;el.style.left=x+'px';el.style.top=py+'px';placed.push([x,py])
    }
  }
  function fit(smooth){
    if(!armed||!running)return;
    const dir=new T.Vector3(...dirs[state.dir]).normalize(),right=new T.Vector3().crossVectors(camera.up,dir).normalize(),up=new T.Vector3().crossVectors(dir,right);
    const root=lookup.get(state.asset||state.station)||asset;
    const bounds=[Infinity,-Infinity,Infinity,-Infinity,Infinity,-Infinity],p=new T.Vector3();
    root.traverse(o=>{
      if(!o.isMesh||o.userData.ambient)return;
      o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
        p.set(x,y,z).applyMatrix4(o.matrixWorld);
        [p.dot(right),p.dot(up),p.dot(dir)].forEach((v,i)=>{bounds[2*i]=Math.min(bounds[2*i],v);bounds[2*i+1]=Math.max(bounds[2*i+1],v)});
      }
    });
    const [l,r,b,t,n,f]=bounds,aspect=w/h,half=Math.max((r-l)/aspect,t-b)*.5*(state.asset?1.52:state.station?1.36:1.10);
    const target=right.multiplyScalar((r+l)/2).add(up.multiplyScalar((b+t)/2+.04*half)).addScaledVector(dir,(n+f)/2);
    const next=target.clone().addScaledVector(dir,40);
    camera.left=-aspect;camera.right=aspect;camera.top=1;camera.bottom=-1;
    const endZoom=1/half,startZoom=camera.zoom,from=camera.position.clone(),fromTarget=controls.target.clone();
    controls.minZoom=endZoom*.50;controls.maxZoom=endZoom*4;
    cancelAnimationFrame(anim);const start=performance.now(),duration=smooth&&!reduced?380:0;
    function frame(now){
      const t=duration?Math.min(1,(now-start)/duration):1,k=1-(1-t)**3;
      camera.position.lerpVectors(from,next,k);controls.target.lerpVectors(fromTarget,target,k);
      camera.zoom=T.MathUtils.lerp(startZoom,endZoom,k);camera.updateProjectionMatrix();camera.lookAt(controls.target);controls.update();draw();
      if(t<1)anim=requestAnimationFrame(frame);
    }frame(start);
  }
  function resize(){
    const nw=host.clientWidth,nh=host.clientHeight;if(!nw||!nh)return;
    w=nw;h=nh;renderer.setSize(w,h,false);fit(false)
  }
  const ray=new T.Raycaster();
  function pick(e){
    const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),camera);
    const first=ray.intersectObjects(meshes.filter(o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true}),false)[0];
    for(let node=first?.object;node;node=node.parent){
      if(lookup.has(node.name))return node.name;
      if(node.name.startsWith('plinth_'))return node.name.slice(7);
    }return '';
  }
  let press=null,drag=false;
  controls.addEventListener('change',draw);
  renderer.domElement.addEventListener('pointerdown',e=>{press=[e.clientX,e.clientY];drag=false;cancelAnimationFrame(anim);onDrag()});
  renderer.domElement.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press[0],e.clientY-press[1])>5)drag=true});
  renderer.domElement.addEventListener('pointercancel',()=>press=null);
  renderer.domElement.addEventListener('pointerup',e=>{if(press&&!drag){const id=pick(e);if(id)onPick(id)}press=null});
  renderer.domElement.addEventListener('wheel',onDrag,{passive:true});
  const obs=new ResizeObserver(resize);obs.observe(host);
  function update(next,smooth=true){
    state=next;running=next.view!==1;armed=true;cancelAnimationFrame(anim);
    if(!running)return;
    for(const [id] of catalog.stations){
      const station=lookup.get(id);station.visible=!next.station||id===next.station;
      for(const child of station.children)if(child.isMesh)child.visible=!next.asset;
    }
    floor.visible=!next.asset;
    for(const [id] of catalog.items){
      lookup.get(id).visible=!next.asset||id===next.asset;
      const plinth=asset.getObjectByName('plinth_'+id);if(plinth)plinth.visible=!next.asset;
    }
    asset.getObjectByName('tracks').visible=!next.station;grid.visible=next.view===2;visible.visible=!next.asset;
    for(const o of meshes)o.material=next.wire&&next.view===2?wire:o.userData.base;
    w=host.clientWidth;h=host.clientHeight;renderer.setSize(w,h,false);fit(smooth);
  }
  function theme(id){
    fill.color.set(id==='blue'?0x96dff7:id==='amber'?0xffd098:0xb5ead4);
    freckles.material.color.copy(fill.color);wire.color.copy(fill.color);draw();
  }
  return{update,theme};
}
