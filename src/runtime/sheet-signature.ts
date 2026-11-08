/** Storage timestamps alone do not require uploading an unchanged sheet and portrait. */
export const sheetSignature=<T extends {updatedAt:number}>(character:T|null)=>JSON.stringify({kind:'sheet',character:character?{...character,updatedAt:0}:null});
