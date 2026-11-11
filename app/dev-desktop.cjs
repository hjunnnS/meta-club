// Non-production loopback launcher. Authentication key and database survive restarts.
const https=require('node:https'),http=require('node:http'),net=require('node:net');
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {localTestSecret}=require('./dev-desktop-secret.cjs');
if(process.env.NODE_ENV==='production')throw Error('Desktop test launcher is not for production');
const directory=path.resolve(process.env.CLUB_DEV_STATE_DIR||path.join(__dirname,'../.local/desktop'));
const port=Number(process.env.CLUB_DEV_HTTPS_PORT||18801),backendPort=Number(process.env.CLUB_DEV_BACKEND_PORT||18802);
for(const n of [port,backendPort])if(!Number.isInteger(n)||n<1024||n>65535)throw Error('Invalid desktop test port');
if(port===backendPort)throw Error('Desktop proxy and backend need separate ports');
const origin='https://localhost:'+port;
const tls={key:fs.readFileSync(path.join(directory,'key.pem')),cert:fs.readFileSync(path.join(directory,'cert.pem'))};
const secret=localTestSecret(directory);
const child=spawn(process.execPath,['server.js'],{cwd:__dirname,stdio:'inherit',env:{...process.env,
  AUTH_URL:origin,AUTH_SECRET:secret,PORT:String(backendPort),CLUB_LOCAL_TEST:'1',CLUB_DB:path.join(directory,'club.sqlite')}});
const sockets=new Set();
let stopping=false,forced;
const proxy=https.createServer(tls,(req,res)=>{
  const request=http.request({hostname:'127.0.0.1',port:backendPort,method:req.method,path:req.url,
    headers:{...req.headers,'x-forwarded-proto':'https'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
  request.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Local test server is starting');});
  req.pipe(request);
});
proxy.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
proxy.on('upgrade',(req,socket,head)=>{
 const back=net.connect(backendPort,'127.0.0.1',()=>{
  back.write('GET '+req.url+' HTTP/1.1\r\n'+Object.entries(req.headers).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');
  back.write(head);socket.pipe(back).pipe(socket);
 });
 back.on('error',()=>socket.destroy());socket.on('error',()=>back.destroy());socket.on('close',()=>back.destroy());
});
function stop(){
 if(stopping)return;stopping=true;
 proxy.close();for(const socket of sockets)socket.destroy();
 child.kill('SIGTERM');forced=setTimeout(()=>{child.kill('SIGKILL');process.exit(1);},3000);forced.unref();
}
proxy.on('error',error=>{console.error('Desktop proxy:',error.code);stop();});
child.on('error',error=>{console.error('Desktop server:',error.code);stop();});
child.on('exit',code=>{clearTimeout(forced);proxy.close();for(const socket of sockets)socket.destroy();process.exit(stopping?0:(code||1));});
process.once('SIGINT',stop);process.once('SIGTERM',stop);
// Wait for Express before accepting browser traffic, rather than briefly serving 502.
const deadline=Date.now()+15000;
function ready(){
 if(stopping)return;
 const request=http.get({hostname:'127.0.0.1',port:backendPort,path:'/api/session',
   headers:{host:'localhost:'+port,'x-forwarded-proto':'https'}},response=>{
   response.resume();
   if(response.statusCode===200)proxy.listen(port,'127.0.0.1',()=>console.log('Desktop test ready: '+origin));
   else again();
 });
 request.setTimeout(1000,()=>request.destroy());request.on('error',again);
}
function again(){if(Date.now()>deadline){console.error('Desktop backend did not become ready');stop();}else setTimeout(ready,150);}
ready();
