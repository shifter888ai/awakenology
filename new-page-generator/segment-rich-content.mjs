/**
 * Slice a verified source rich-content inventory by half-open paragraph range.
 * Paragraph indexes and image order are rebased to the language-local fragment.
 */
export function segmentRichContentInventory(inventory, {startParagraph,endParagraphExclusive}) {
  if (!inventory || !Array.isArray(inventory.runs) || !Array.isArray(inventory.images) ||
      !Number.isInteger(inventory.paragraphCount) || !Number.isInteger(startParagraph) ||
      !Number.isInteger(endParagraphExclusive) || startParagraph < 0 ||
      endParagraphExclusive <= startParagraph || endParagraphExclusive > inventory.paragraphCount) {
    return {ok:false,errors:["A valid rich-content inventory and in-range paragraph segment are required."]};
  }
  const inRange = item => Number.isInteger(item.paragraphIndex) &&
    item.paragraphIndex >= startParagraph && item.paragraphIndex < endParagraphExclusive;
  const rebase = item => ({...item,paragraphIndex:item.paragraphIndex-startParagraph});
  const result = {
    ok:true,errors:[],
    paragraphCount:endParagraphExclusive-startParagraph,
    runs:inventory.runs.filter(inRange).map(rebase),
    images:inventory.images.filter(inRange).map((item,index)=>({...rebase(item),order:index})),
    lineBreaks:(inventory.lineBreaks??[]).filter(inRange).map(rebase),
    paragraphLayouts:(inventory.paragraphLayouts??[]).filter(inRange).map(rebase),
    paragraphNumbering:(inventory.paragraphNumbering??[]).filter(inRange).map(rebase),
    paragraphMarkFormatting:(inventory.paragraphMarkFormatting??[]).filter(inRange).map(rebase)
  };
  return result;
}
