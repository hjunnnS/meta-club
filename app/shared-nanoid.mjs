// Colyseus 0.16 uses a default import; patched nanoid 3 exports a named function.
import * as generator from 'nanoid';
const nanoid=generator.nanoid??generator.default;
if(typeof nanoid!=='function')throw Error('Unsupported identifier generator');
export default nanoid;
