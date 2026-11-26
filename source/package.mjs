import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const requireFrom=createRequire(resolve(process.argv[2]||'.','package.json'));
const {rolldown}=await import(requireFrom.resolve('rolldown'));

const three=resolve(requireFrom.resolve('three'),'../..');
const build=await rolldown({input:'source/viewer.js',resolve:{alias:{'three/addons':resolve(three,'examples/jsm'),'three':resolve(three,'build/three.module.js')}}});
const {output}=await build.generate({format:'iife',minify:true});
const data='window.exhibits='+readFileSync('source/catalog.json','utf8')+';window.geometry64="'+readFileSync('assets/seed-exhibits.glb').toString('base64')+'";';
writeFileSync('大数据驾驶舱.html',readFileSync('source/viewer.template.html','utf8').replace('/*STYLE*/',()=>readFileSync('source/style.css','utf8')).replace('/*PAYLOAD*/',()=>data).replace('/*BUNDLE*/',()=>output[0].code.replaceAll('</script','<\\/script')));
writeFileSync('source/THREE-LICENSE.txt',readFileSync(resolve(three,'LICENSE')));
