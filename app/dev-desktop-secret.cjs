// Dedicated local-test key. Never copy a running process's environment or print it.
const fs = require('node:fs');
const path = require('node:path');
const {randomBytes} = require('node:crypto');

function localTestSecret(directory) {
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const file=path.join(directory,'auth-secret');
  try {
    const fd=fs.openSync(file,'wx',0o600);
    try {fs.writeFileSync(fd,randomBytes(48).toString('hex'));fs.fsyncSync(fd);}
    finally {fs.closeSync(fd);}
  } catch(error) {
    if(error.code!=='EEXIST')throw error;
  }
  const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try {
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size!==96||
       (process.platform!=='win32'&&((stat.mode&0o077)!==0||stat.uid!==process.getuid())))
      throw Error('Local test auth-secret must be a private, owner-only 96-byte file');
    const secret=fs.readFileSync(fd,'utf8');
    if(!/^[0-9a-f]{96}$/.test(secret))throw Error('Local test auth-secret is invalid; refusing to rotate it automatically');
    return secret;
  } finally {fs.closeSync(fd);}
}
module.exports={localTestSecret};
