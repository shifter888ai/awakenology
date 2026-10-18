import {inspectDocxAssets} from './inspect-docx-assets.mjs';
import {inspectDocxSourceMap} from './inspect-docx-source-map.mjs';

/** Join validated media relationships with source paragraph order; never guess placement. */
export async function inspectDocxImagePlacement(buffer) {
  const fail=errors=>({ok:false,errors,images:[]});
  const [assets,source]=await Promise.all([inspectDocxAssets(buffer),inspectDocxSourceMap(buffer)]);
  const errors=[...assets.errors,...source.errors];
  if(!assets.ok || !source.ok) return fail([...new Set(errors)]);
  const byRelationship=new Map(assets.assets.map(asset=>[asset.relationshipId,asset]));
  const images=[];
  for(const ref of source.imageReferences) {
    const asset=byRelationship.get(ref.relationshipId);
    if(!asset) {errors.push('No validated asset for source relationship '+ref.relationshipId+'.');continue;}
    images.push({
      assetPath:asset.outputPath,
      paragraphIndex:ref.paragraphIndex,
      order:images.length,
      alt:asset.altText,
      sourcePath:asset.sourcePath,
      relationshipId:ref.relationshipId,
      sourceLocation:ref.sourceLocation,
      sha256:asset.sha256,
      byteLength:asset.byteLength,
      contentType:asset.contentType
    });
  }
  if(images.length!==assets.assets.length) errors.push('Embedded asset count does not match mapped source image references.');
  return errors.length?fail([...new Set(errors)]):{ok:true,errors:[],images};
}
