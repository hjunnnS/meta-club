const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {localTestSecret}=require('../app/dev-desktop-secret.cjs');
test('desktop launcher reuses its private key instead of changing sessions on restart',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'club-local-session-'));
 try{
  const first=localTestSecret(dir),file=path.join(dir,'auth-secret');
  const before=fs.statSync(file);
  const next=localTestSecret(dir);
  assert(crypto.timingSafeEqual(Buffer.from(first),Buffer.from(next)));
  assert.equal(fs.statSync(file).mtimeMs,before.mtimeMs);
  assert.equal(fs.statSync(file).mode&0o777,0o600);
  fs.writeFileSync(file,'invalid');
  assert.throws(()=>localTestSecret(dir),/private, owner-only/);
  assert.equal(fs.readFileSync(file,'utf8'),'invalid');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
