/** Storage timestamps alone do not require uploading an unchanged sheet and portrait. */
export const sheetSignature=<T extends {updatedAt:number}>(character:T|null)=>JSON.stringify({kind:'sheet',character:character?{...character,updatedAt:0}:null});

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'updatedAt' && key !== 'directoryId').sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,item]) => [key,canonical(item)]));
  return value;
};
export async function contentDigest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}
