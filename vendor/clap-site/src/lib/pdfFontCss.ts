// SVG images cannot load external fonts: include the page's font faces as data URLs.
export const collectPdfFontCss = async (
  sheets: StyleSheetList,
  inlineUrl: (url: string) => Promise<string>,
) => {
  const visited = new Set<string>();
  const readCss = async (css: string, base: string): Promise<string> => {
    const imports = Array.from(css.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["'][^;]*;/g));
    const imported = await Promise.all(imports.map((match) => readUrl(new URL(match[1], base).href)));
    const faces = await Promise.all(Array.from(css.matchAll(/@font-face\s*\{[^}]*\}/g)).map(async ([face]) => {
      for (const [match, url] of face.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        if (url.startsWith("data:")) continue;
        face = face.replace(match, `url("${await inlineUrl(new URL(url, base).href)}")`);
      }
      return face;
    }));
    return [...imported, ...faces].join("\n");
  };
  const readUrl = async (url: string): Promise<string> => {
    if (visited.has(url)) return "";
    visited.add(url);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Impossible de charger les polices du PDF.");
    return readCss(await response.text(), url);
  };
  const fonts = await Promise.all(Array.from(sheets).map(async (sheet) => {
    let css: string;
    try {
      css = Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
    } catch {
      return sheet.href ? readUrl(sheet.href) : "";
    }
    return readCss(css, sheet.href || document.baseURI);
  }));
  return fonts.join("\n");
};
