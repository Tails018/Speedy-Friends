// Sella la versión antes de publicar: escribe sf-version.js con la versión de package.json y el
// commit base, y añade ?v=<versión> a los scripts y hojas locales de cada página para que GitHub Pages
// (Cache-Control: max-age=600) no mezcle un HTML nuevo con JS o CSS antiguos.
// Uso: npm run stamp   (después, revisar y hacer commit)
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {execSync} from 'node:child_process';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const version=pkg.version;
let commit='local';
try{commit=execSync('git rev-parse --short HEAD',{encoding:'utf8'}).trim();}catch{}
const date=new Date().toISOString().slice(0,10);
writeFileSync('sf-version.js',`/* Generado por scripts/stamp-version.mjs: no editar a mano. */
(() => {
  const build = Object.freeze({ version: ${JSON.stringify(version)}, commit: ${JSON.stringify(commit)}, date: ${JSON.stringify(date)} });
  window.SF_BUILD = build;
  document.documentElement.dataset.sfBuild = build.version + '+' + build.commit;
  const mark = () => {
    if (document.getElementById('sf-build-tag')) return;
    const tag = document.createElement('p');
    tag.id = 'sf-build-tag';
    tag.className = 'sf-build-tag';
    tag.textContent = 'Speedy Friends v' + build.version + ' · ' + build.commit;
    document.body.appendChild(tag);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark, { once: true }); else mark();
})();
`);
const local=/((?:src|href)=")(?!https?:|\/\/|data:|#|mailto:)([^"?#]+\.(?:js|css))(?:\?v=[^"#]*)?(")/g;
let pages=0;
for(const file of readdirSync('.').filter(f=>f.endsWith('.html')&&!/\.v\d+\.html$/.test(f))){
 const html=readFileSync(file,'utf8');
 let next=html.replace(local,(m,a,p,z)=>`${a}${p}?v=${version}${z}`);
 if(!next.includes('sf-version.js'))next=next.replace('<script defer src="sf-v7.js?v='+version+'"></script>','<script defer src="sf-v7.js?v='+version+'"></script>\n<script defer src="sf-version.js?v='+version+'"></script>');
 if(next!==html){writeFileSync(file,next);pages++;}
}
console.log(`sf-version.js → v${version} · ${commit} (${date}); páginas actualizadas: ${pages}`);
