import {mkdirSync,readdirSync,existsSync,statSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const run=(command,args)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:'inherit'});
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(command+' exited '+code)));
});
await run('npm',['install','--prefix','/tmp/pw-shots','playwright-core']);
const {chromium}=await import('/tmp/pw-shots/node_modules/playwright-core/index.mjs');
const cache=join(homedir(),'.cache/ms-playwright');
const candidates=readdirSync(cache).sort().reverse().flatMap(name=>name.startsWith('chromium-')?[join(cache,name,'chrome-linux/chrome'),join(cache,name,'chrome-linux64/chrome')]:name.startsWith('chromium_headless_shell-')?[join(cache,name,'chrome-linux/headless_shell'),join(cache,name,'chrome-linux64/headless_shell')]:[]);
const executablePath=candidates.find(existsSync);
if(!executablePath)throw Error('Chromium executable not found in '+cache);
mkdirSync(join(root,'screenshots'),{recursive:true});
const server=spawn('node',['serve.ts'],{cwd:root,stdio:['ignore','pipe','pipe']});
let serverError;server.once('error',e=>serverError=e);
let browser;const errors=[];let consoleErrors=0,pageErrors=0;
try{
  let ready=false;
  for(let i=0;i<50;i++){
    if(serverError)throw serverError;
    if(server.exitCode!==null)throw Error('Server exited '+server.exitCode);
    try{const response=await fetch('http://localhost:8080/game/index.html');if(response.ok){ready=true;break}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!ready)throw Error('Server did not become ready');
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  for(const [name,query] of [['1-start',''],['2-heist','?shot=heist'],['3-empire','?shot=empire'],['4-storm','?shot=storm']]){
    const page=await context.newPage();
    page.on('console',message=>{if(message.type()==='error'){consoleErrors++;errors.push(name+' console: '+message.text())}});
    page.on('pageerror',error=>{pageErrors++;errors.push(name+' pageerror: '+error.message)});
    await page.goto('http://localhost:8080/game/index.html'+query,{waitUntil:'networkidle'});
    await page.waitForTimeout(4000);
    const path=join(root,'screenshots',name+'.jpg');
    await page.screenshot({path,type:'jpeg',quality:80});
    if(statSync(path).size>256*1024)await page.screenshot({path,type:'jpeg',quality:60});
    if(statSync(path).size>256*1024)throw Error(name+' exceeds 256 KiB');
    console.log(name+'.jpg: '+statSync(path).size+' bytes, 1280x720');
    await page.close();
  }
  console.log('Browser errors: console='+consoleErrors+', pageerror='+pageErrors);
  if(errors.length)throw Error(errors.join('\n'));
}finally{
  if(browser)await browser.close();
  if(server.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve))}
}
