import test from 'node:test';
import assert from 'node:assert/strict';
import {planWalk} from '../app/public/click-walk.js';
import {permittedPath} from '../app/edm-layout.js';
const point=(x,z)=>({x,y:0,z});
test('click route walks around furniture rather than crossing it',()=>{
 const clear=p=>Math.abs(p.x)<6&&Math.abs(p.z)<6&&!(p.x>1&&p.x<3&&Math.abs(p.z)<1.2);
 const step=(a,b)=>{
  for(let i=0;i<=10;i++)if(!clear({x:a.x+(b.x-a.x)*i/10,z:a.z+(b.z-a.z)*i/10}))return null;
  return b;
 };
 const path=planWalk(point(0,0),point(4,0),step);
 assert(path);assert.deepEqual(path.at(-1),point(4,0));
 assert(path.some(p=>Math.abs(p.z)>=1.2));
 let previous=point(0,0);for(const p of path){assert(step(previous,p));previous=p;}
});
test('closed destinations return no route, while the table aisle stays reachable',()=>{
 const step=(a,b)=>Math.abs(b.x)<21&&Math.abs(b.z)<20&&permittedPath(a,b,['CLOSED','CLOSED'])?b:null;
 assert(planWalk(point(0,3),point(16.6,2.8),step));
 assert.equal(planWalk(point(0,6),point(-14.6,6),step,{limit:200}),null);
});
test('unreachable furniture targets stop the search without a partial arrival',()=>{
 const path=planWalk(point(0,0),point(4,0),(a,b)=>b.x<2&&Math.abs(b.z)<2?b:null,{limit:100});
 assert.equal(path,null);
});
