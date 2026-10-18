import {cp,mkdir,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['scripts/generate-community.mjs'],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['--test','tests/static.test.mjs'],{cwd:root,stdio:'inherit'});
const dist=new URL('../dist/',import.meta.url);await mkdir(dist,{recursive:true});
for(const file of await readdir(root)){
 if(/\.(html|css|js)$/.test(file)&&!file.includes('.before-'))await cp(new URL('../'+file,import.meta.url),new URL(file,dist));
}
for(const dir of ['assets','vendor','js'])await cp(new URL('../'+dir,import.meta.url),new URL(dir,dist),{recursive:true});
console.log('Static site built in dist/; original HTML routes preserved.');
