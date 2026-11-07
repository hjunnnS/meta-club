"""Package the two pinned rendering runtimes and both models for offline review."""
import base64
import gzip
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent
paths = {
    'stage': ('../stage/edm-empty.glb','model/gltf-binary'),
    'crowd': ('crowd.glb','model/gltf-binary'),
    'babylon': ('node_modules/babylonjs/babylon.js','text/javascript'),
    'loaders': ('node_modules/babylonjs-loaders/babylonjs.loaders.min.js','text/javascript'),
    'playcanvas': ('node_modules/playcanvas/build/playcanvas.min.mjs','text/javascript'),
}
assets = {
    key: [mime,base64.b64encode(gzip.compress((root/file).read_bytes(),mtime=0)).decode()]
    for key,(file,mime) in paths.items()
}
bootstrap = """
const compressed=ASSETS;
window.assetPaths={};
const wanted=new URLSearchParams(location.search).get('engine')==='playcanvas'
  ? ['stage','crowd','playcanvas'] : ['stage','crowd','babylon','loaders'];
for(const key of wanted){
  const [mime,bytes]=compressed[key];
  const raw=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0));
  const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
  window.assetPaths[key]=URL.createObjectURL(new Blob([await new Response(stream).arrayBuffer()],{type:mime}));
}
""".replace('ASSETS',json.dumps(assets,separators=(',',':')))
html=(root/'index.html').read_text().replace('<script type="module" src="scene.js"></script>',
    '<script type="module">'+bootstrap+(root/'scene.js').read_text()+'</script>')
Path(sys.argv[1]).write_text(html)
