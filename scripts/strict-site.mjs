import { readFileSync, writeFileSync } from "node:fs";
const root = "vendor/clap-site/src/";
const edit = (p, fn) => {
  const full = root + p;
  writeFileSync(full, fn(readFileSync(full, "utf8")));
};
// Compatibility fixes for the strict TypeScript build; these keep upstream runtime behavior.
edit("hooks/use-scroll-list.ts", (s) =>
  s.replace(
    "if ('IntersectionObserver' in window)",
    "if (typeof IntersectionObserver !== 'undefined')",
  ),
);
edit("lib/characterPdf.ts", (s) =>
  s
    .replace(
      'ef?.lookupMaybe(PDFName.of("F"), PDFRawStream)',
      'ef?.lookup(PDFName.of("F"))',
    )
    .replace(
      "if (!stream) continue;",
      "if (!(stream instanceof PDFRawStream)) continue;",
    ),
);
edit("lib/resourceBundle.ts", (s) =>
  s
    .replace(
      'ef?.lookupMaybe(PDFName.of("F"), PDFRawStream)',
      'ef?.lookup(PDFName.of("F"))',
    )
    .replace("if (stream) {", "if (stream instanceof PDFRawStream) {")
    .replace(
      "migrations[value.type](item)",
      "migrations[value.type as keyof typeof migrations](item)",
    ),
);
edit("lib/clapProject.ts", (s) =>
  s.replace(
    "...(item.backImage ?",
    '...("backImage" in item && item.backImage ?',
  ),
);
edit("lib/pokerTextCard.ts", (s) =>
  s.replace(
    "const ctx = canvas.getContext('2d');",
    "const ctx = canvas.getContext('2d')!;",
  ),
);
edit("lib/toolOutput.ts", (s) =>
  s.replace(
    "const images = [];",
    "const images: Parameters<typeof exportPokerFrontsZip>[0] = [];",
  ),
);
edit("lib/toolPdf.ts", (s) =>
  s.replace(
    "const images = [];",
    "const images: Parameters<typeof exportPokerPdf>[0] = [];",
  ),
);
// Preserve the complete character flag in the integration's archive and P2P payload.
edit("lib/roomProtocol.ts", (s) =>
  s.includes("climaxUsed: z.boolean()") ? s : s.replace(
    "mandatoryComplication: z.boolean(),",
    "mandatoryComplication: z.boolean(), climaxUsed: z.boolean().default(false),",
  ),
);
edit("pages/CharacterEditor.tsx", (s) =>
  s
    .replace(
      "const Icon = TAB_ICONS[tab];",
      "const Icon = tab === 'back' ? BookOpen : TAB_ICONS[tab];",
    )
    .replace("values.forEach((element) => {", "for (const element of values) {")
    .replace(
      "if (rect.width === 0 || rect.height === 0) return;",
      "if (rect.width === 0 || rect.height === 0) continue;",
    )
    .replace(
      "    });\r\n\r\n    if (!nearest || nearest.distance",
      "    }\r\n\r\n    if (!nearest || nearest.distance",
    )
    .replace(
      "    });\n\n    if (!nearest || nearest.distance",
      "    }\n\n    if (!nearest || nearest.distance",
    )
    .replace(
      "setSelection(requested);",
      "setSelection(requested as RollSelection[]);",
    )
    .replace(/\bc\./g, "c!."),
);
edit(
  "pages/ResourcesList.tsx",
  (s) =>
    "import type { ComponentType } from 'react';\n" +
    s.replace(
      "icon: typeof Crown;",
      "icon: typeof Crown | ComponentType<{size?:number;className?:string}>;",
    ),
);
