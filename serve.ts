import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { extname, join } from 'node:path';
const root = new URL('.', import.meta.url).pathname;
const types: Record<string,string> = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
createServer((req,res) => { const path = decodeURIComponent((req.url || '/').split('?')[0]); const file = join(root, path === '/' ? 'game/index.html' : path.replace(/^\//,'')); readFile(file,(e,b) => { if(e){res.writeHead(404);res.end('Not found');return;} res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b); }); }).listen(8080,()=>console.log('Aurelia Nights V at http://localhost:8080'));
