import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
export const files={
  '/':'index.html','/index.html':'index.html','/scene.js':'scene.js','/crowd.glb':'crowd.glb',
  '/stage/edm-empty.glb':'../stage/edm-empty.glb',
  '/vendor/babylon.js':'node_modules/babylonjs/babylon.js','/vendor/babylonjs.loaders.min.js':'node_modules/babylonjs-loaders/babylonjs.loaders.min.js',
  '/vendor/playcanvas.min.mjs':'node_modules/playcanvas/build/playcanvas.min.mjs'
};
export async function serve(port=0){
  const server=http.createServer(async(req,res)=>{
    const key=new URL(req.url,'http://localhost').pathname;
    if(!Object.hasOwn(files,key)){res.writeHead(404);res.end();return;}
    try{const file=files[key];res.setHeader('Content-Type',file.endsWith('html')?'text/html; charset=utf-8':/m?js$/.test(file)?'text/javascript':'model/gltf-binary');
      res.end(await fs.readFile(path.join(dir,file)));
    }catch{res.writeHead(500);res.end();}
  });
  await new Promise((ok,no)=>server.once('error',no).listen(port,'127.0.0.1',ok));return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=await serve(18746);console.log('http://127.0.0.1:'+server.address().port);}
