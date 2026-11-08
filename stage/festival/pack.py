"""Embed the approved map and pinned Babylon runtime into a portable review file."""
import base64
import gzip
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent
assets = {
    'map': root / 'edm-festival.glb',
    'engine': root / '../../dance/node_modules/babylonjs/babylon.js',
    'loader': root / '../../dance/node_modules/babylonjs-loaders/babylonjs.loaders.min.js',
}
payload = {key: base64.b64encode(gzip.compress(path.read_bytes(), mtime=0)).decode()
           for key, path in assets.items()}
bootstrap = """
window.festivalAssets = {};
for (const [key, encoded] of Object.entries(ASSETS)) {
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const type = key === 'map' ? 'model/gltf-binary' : 'text/javascript';
  window.festivalAssets[key] = URL.createObjectURL(new Blob([await new Response(stream).arrayBuffer()], {type}));
}
""".replace('ASSETS', json.dumps(payload,separators=(',',':')))
html=(root/'index.html').read_text().replace('<script type="module">','<script type="module">'+bootstrap,1)
Path(sys.argv[1]).write_text(html)
