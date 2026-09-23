/** Reproducible source acquisition; normal runtime only uses checked-in derived caches. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const base='data/dongao/dem', manifest=JSON.parse(await fs.readFile(`${base}/manifest.json`,'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
let exists=false;
try{const source=await fs.readFile(`${base}/source.tif`);exists=true;if(digest(source)!==manifest.sourceSha256)throw new Error('Cached source hash mismatch; preserve it for review before replacing.');}catch(e){if(e.code!=='ENOENT')throw e;}
if(exists)console.log('DEM source cache verified; no network request.');
else{
 const temporary=`${base}/source.tif.download`;
 try{await promisify(execFile)('curl',['--fail','--location','--max-time','120',manifest.sourceUrl,'--output',temporary]);
  if(digest(await fs.readFile(temporary))!==manifest.sourceSha256)throw new Error('Downloaded DEM differs from recorded source; do not silently update provenance.');
  await fs.rename(temporary,`${base}/source.tif`);console.log('Recorded Copernicus source downloaded and SHA-256 verified.');
 }catch(e){await fs.rm(temporary,{force:true});throw e;}
}
