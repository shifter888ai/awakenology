import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectDocxSourceMap} from './inspect-docx-source-map.mjs';
import {inspectDocxAssets} from './inspect-docx-assets.mjs';
import {inspectDocxImagePlacement} from './inspect-docx-image-placement.mjs';
import {inspectDocxRichContent} from './inspect-docx-rich-content.mjs';
import {extractDocx} from './extract-docx.mjs';

const sourcePath = 'temp/多重時空是什麽 - 繁體 - Copy.docx';
const outputPath = 'pilot-artifacts/pilot-audit.json';
const buffer = await readFile(sourcePath);
const sha256 = createHash('sha256').update(buffer).digest('hex');
const stages = {};
for (const [name, inspect] of [
  ['sourceMap', inspectDocxSourceMap],
  ['assets', inspectDocxAssets],
  ['imagePlacement', inspectDocxImagePlacement],
  ['richContent', inspectDocxRichContent],
  ['conversion', extractDocx]
]) {
  try {
    const result = await inspect(buffer);
    stages[name] = {ok: result.ok, errors: result.errors ?? [],
      ...(Array.isArray(result.paragraphs) ? {paragraphCount: result.paragraphs.length} : {}),
      ...(Array.isArray(result.assets) ? {assetCount: result.assets.length} : {}),
      ...(Array.isArray(result.images) ? {imageCount: result.images.length} : {}),
      ...(Array.isArray(result.runs) ? {runCount: result.runs.length} : {})
    };
  } catch (error) {
    stages[name] = {ok:false, errors:['Inspector exception: ' + error.message]};
  }
}
const report = {sourcePath, byteLength:buffer.length, sha256, stages,
  pilotApproved:false,
  note:'Diagnostic only. No language segmentation or reviewed page set has been approved.'};
await mkdir('pilot-artifacts',{recursive:true});
await writeFile(outputPath, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
