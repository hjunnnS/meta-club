import {registerHooks} from 'node:module';
// Browser effect modules keep their existing public imports and rendering code.
registerHooks({resolve(specifier,context,next){
  if(specifier==='/clubs/edm/edm-layout.js')return {url:new URL('./edm-layout.js',import.meta.url).href,shortCircuit:true};
  if(specifier==='nanoid'&&context.parentURL?.includes('/@colyseus/core/'))return {url:new URL('./shared-nanoid.mjs',import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
await import('./server.js');
