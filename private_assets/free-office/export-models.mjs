// Run from repo root after npm ci --prefix pixelworld_mvp.
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const require=createRequire(path.join(root,'pixelworld_mvp/package.json'));
const {rolldown}=await import(pathToFileURL(require.resolve('rolldown')).href);
const bundlePath=path.join(here,'.export-cache.mjs');
const bundle=await rolldown({input:path.join(root,'pixelworld_mvp/src/three/models.ts'),platform:'node',external:[/^three(?:\/|$)/]});
// Put output beside node_modules so the external Three module resolves correctly.
const output=path.join(root,'pixelworld_mvp/.export-office.mjs');
try{
 await bundle.write({file:output,format:'esm'});await bundle.close();
 const T=await import(pathToFileURL(require.resolve('three')).href);
 const {GLTFExporter}=await import(pathToFileURL(path.join(path.dirname(require.resolve('three')),'../examples/jsm/exporters/GLTFExporter.js')).href);
 globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
 const {furnishing}=await import(pathToFileURL(output).href);
 const manifest=JSON.parse(await readFile(path.join(here,'manifest.json'),'utf8'));
 await mkdir(path.join(here,'models'),{recursive:true});
 for(const family of manifest.families){const kind=({chair:'office-chair',board:'planning-board',coffee:'beverage-station'})[family]||family;
  const scene=new T.Scene();furnishing(scene,{id:family,kind,point:{x:0,y:0},footprint:{width:1,height:1}});scene.updateMatrixWorld(true);
  const data=await new GLTFExporter().parseAsync(scene,{binary:true});await writeFile(path.join(here,'models',`${family}.glb`),Buffer.from(data));
 }
}finally{await rm(output,{force:true});await rm(bundlePath,{force:true});}
