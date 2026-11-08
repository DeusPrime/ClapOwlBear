import { MAX_PAYLOAD_LENGTH, parseJsonData, validateImportedCharacter } from "./dataValidation";
import { Character, migrateCharacter } from "./characters";

const PDF_PAYLOAD_PREFIX = "clap-role-character-json-v1:";
export const CHARACTER_PDF_PAYLOAD_FIELD = "ClapRoleCharacterData";
export const CHARACTER_PDF_ATTACHMENT_NAME = "clap-role-character.json";
export const CHARACTER_PDF_MARKER = "clap-role-character-json-attached-v1";

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export const encodeCharacterPdfPayload = (character: Character) => {
  const json = JSON.stringify(character);
  const bytes = new TextEncoder().encode(json);
  return `${PDF_PAYLOAD_PREFIX}${bytesToBase64(bytes)}`;
};

export const decodeCharacterPdfPayload = (value?: string | null): Character | null => {
  if (!value || value.length > MAX_PAYLOAD_LENGTH || !value.startsWith(PDF_PAYLOAD_PREFIX)) return null;
  try {
    const bytes = base64ToBytes(value.slice(PDF_PAYLOAD_PREFIX.length));
    const json = new TextDecoder().decode(bytes);
    return migrateCharacter(validateImportedCharacter(parseJsonData(json)));
  } catch {
    return null;
  }
};
