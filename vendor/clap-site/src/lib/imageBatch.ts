export function convertedImageName(original: string, used: Set<string>) {
  const cleaned = Array.from(original.replace(/\.[^.]+$/, ""))
    .map(char => char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? "_" : char).join("").trim();
  const base = (cleaned || "image") + "-clap-role";
  let name = `${base}.png`;
  let suffix = 2;
  while (used.has(name.toLocaleLowerCase("fr"))) name = `${base}-${suffix++}.png`;
  used.add(name.toLocaleLowerCase("fr"));
  return name;
}
