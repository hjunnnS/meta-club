// Bounded grid search over the current map's walkable surfaces. Each edge is
// checked for body clearance and current zone permissions by the scene.
export function planWalk(start, goal, step, {spacing=.5, limit=9000, maxMs=200}={}) {
  const deadline=performance.now()+maxMs;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function segment(a,b){
    const n=Math.max(1,Math.ceil(distance(a,b)/spacing));
    let previous=a;
    const path=[];
    for(let i=1;i<=n;i++){
      const f=i/n, next=step(previous,{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f});
      if(!next)return null;
      path.push(next);previous=next;
    }
    return path;
  }
  const direct=segment(start,goal);
  if(direct)return direct;
  const key=(x,z)=>x+','+z;
  const first={...start,g:0,h:distance(start,goal),gx:0,gz:0,parent:null};
  const open=[first],best=new Map([[key(0,0),first]]),closed=new Set();
  const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  for(let count=0;open.length&&count<limit;count++){
    if(performance.now()>deadline)return null;
    let index=0;
    for(let i=1;i<open.length;i++)if(open[i].g+open[i].h<open[index].g+open[index].h)index=i;
    const node=open.splice(index,1)[0],id=key(node.gx,node.gz);
    if(closed.has(id))continue;
    closed.add(id);
    if(node.h<spacing*1.5){
      const tail=segment(node,goal);
      if(tail){
        const path=[];for(let at=node;at.parent;at=at.parent)path.push({x:at.x,y:at.y,z:at.z});
        return path.reverse().concat(tail);
      }
    }
    for(const [dx,dz] of dirs){
      const gx=node.gx+dx,gz=node.gz+dz,k=key(gx,gz);
      if(closed.has(k))continue;
      const at=step(node,{x:start.x+gx*spacing,y:node.y,z:start.z+gz*spacing});
      if(!at)continue;
      const g=node.g+distance(node,at),old=best.get(k);
      if(old&&old.g<=g)continue;
      const next={...at,g,h:distance(at,goal),gx,gz,parent:node};
      best.set(k,next);open.push(next);
    }
  }
  return null;
}
