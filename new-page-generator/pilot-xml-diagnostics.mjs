const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
export function countXmlTag(xml, qualifiedName) {
  if (typeof xml !== "string" || typeof qualifiedName !== "string" || !XML_NAME.test(qualifiedName)) {
    throw new TypeError("XML text and a valid qualified tag name are required.");
  }
  const escaped = qualifiedName.replace(/\./g, "\\.");
  return [...xml.matchAll(new RegExp("<" + escaped + "(?=\\s|/|>)", "g"))].length;
}
