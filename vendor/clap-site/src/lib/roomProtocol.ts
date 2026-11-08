import { z } from 'zod/v3';
import { characterInputSchema, directoryIdSchema, resourceSchemas } from "./dataValidation";
import { richTextToHtml } from "./richText";
import { chatEntrySchema, rollRequestSchema, gameCommandSchema, localGameSchema } from "./localRoomGame";

export const owlbearRoomUrlSchema = z.string().max(2048).url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['owlbear.rodeo', 'www.owlbear.rodeo'].includes(url.hostname) && !url.port && !url.username && !url.password && /^\/room\/[^/]+\/[^/]+\/?$/.test(url.pathname);
  } catch { return false; }
}, 'Colle le lien complet de la salle Owlbear.');

const text = z.string().max(100000);
const score = z.number().finite().min(-10000).max(10000);
const checks = z.array(z.boolean()).max(7);
const colors = z.array(z.string().max(20)).max(7);
const facet = z.object({ core: score, skills: z.record(z.string().max(80), score), supernatural: z.record(z.string().max(80), score) });
// Validate every remote field before it is used by the existing character card renderer.
export const roomCharacterSchema = z.object({
  directoryId: directoryIdSchema.optional(),
  id: z.string().max(100), nom: text, age: text, taille: text, poids: text, concept: text, replique: text,
  portrait: z.string().max(4000000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
  facets: z.object({ corps: facet, esprit: facet, ame: facet }),
  traits: text, specialite: text, lore: text, notes: text,
  armes: z.array(z.object({ nom: text, degats: text, proprietes: text })).max(100),
  armures: z.array(z.object({ nom: text, poids: text, protection: text, proprietes: text })).max(100),
  autresAccessoires: z.array(z.object({ nom: text, proprietes: text, quantite: z.number().int().min(0).max(999999).optional() })).max(100),
  injuries: z.record(z.string().max(80), checks), stress: checks, griefs: checks,
  cardInk: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cardCheckColors: z.object({ injuries: z.record(z.string().max(80), colors), stress: colors, griefs: colors }),
  criticalStates: z.object({ agony: z.record(z.string().max(80), z.boolean()), mentalBreak: z.boolean(), emotionalBreak: z.boolean() }),
  pointsRecits: score, destinDiceCount: score, supernaturalEnabled: z.boolean(), mandatoryComplication: z.boolean(), climaxUsed: z.boolean().default(false),
  linkedResources: z.array(z.object({ id: z.string().max(100), type: z.enum(["key-role", "figurant", "profile", "power", "vehicle"]) })).max(200),
  updatedAt: z.number().finite(),
}).superRefine((value, ctx) => {
  if (!characterInputSchema.safeParse(value).success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fiche invalide." });
}).transform(value => ({ ...value, traits: richTextToHtml(value.traits), specialite: richTextToHtml(value.specialite) }));
const resourceIdentity = { id: z.string().min(1).max(100), titre: z.string().max(100000), image: z.string().max(4000000).regex(/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/).optional() };
export const roomResourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('key-role'), item: resourceSchemas['key-role'].extend(resourceIdentity) }),
  z.object({ type: z.literal('figurant'), item: resourceSchemas.figurant.extend(resourceIdentity) }),
  z.object({ type: z.literal('profile'), item: resourceSchemas.profile.extend(resourceIdentity) }),
  z.object({ type: z.literal('power'), item: resourceSchemas.power.extend(resourceIdentity) }),
  z.object({ type: z.literal('vehicle'), item: resourceSchemas.vehicle.extend(resourceIdentity) }),
]);
const gameScope = { roomGeneration: z.string().uuid().optional() };
export const publicRollSchema = z.object({
  ...gameScope,
  kind: z.literal("roll"), id: z.string().uuid(), sender: z.string().max(100),
  label: z.string().max(300), summary: z.string().max(1500),
});
export type PublicRoll = z.infer<typeof publicRollSchema>;
export const roomMessageSchema = z.discriminatedUnion("kind", [
  z.object({ ...gameScope, kind: z.literal('hero-select'), id: z.string().uuid(), characterId: z.string().min(1).max(100) }),
  z.object({ ...gameScope, kind: z.literal('hero-proposal'), id: z.string().uuid(), character: roomCharacterSchema, resources: z.array(roomResourceSchema).max(200) }),
  z.object({ ...gameScope, kind: z.literal('hero-proposal-result'), id: z.string().uuid(), accepted: z.boolean() }),
  z.object({ ...gameScope, kind: z.literal('game-command'), command: gameCommandSchema }),
  z.object({ ...gameScope, kind: z.literal('game-result'), id: z.string().uuid(), error: z.string().max(250).optional() }),
  z.object({ ...gameScope, kind: z.literal('game-state'), owlbearUrl: owlbearRoomUrlSchema.optional(), roomHeroes: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().max(160), ownerId: z.string().max(100).optional() })).max(116).optional(), messages: z.array(chatEntrySchema).max(3200), requests: z.array(rollRequestSchema).max(100), heroes: z.array(z.object({ id: z.string().max(100), heroName: z.string().max(160), heroConcept: z.string().max(300) })).max(16).optional() }),
  z.object({ ...gameScope, kind: z.literal('game-handoff'), id: z.string().uuid(), game: localGameSchema }),
  z.object({ ...gameScope, kind: z.literal('game-handoff-ready'), id: z.string().uuid() }),
  publicRollSchema,
  z.object({ ...gameScope, kind: z.literal('hero-action'), operationId: z.string().uuid(), characterId: z.string().max(100), action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('edit-sheet'), character: roomCharacterSchema, expectedUpdatedAt: z.number().finite(), expectedState: z.string().max(1000000).optional() }),
    z.object({ type: z.literal('add-item'), category: z.enum(['armes', 'armures', 'autresAccessoires']), item: z.object({ nom: z.string().min(1).max(300), proprietes: z.string().max(2000), degats: z.string().max(100), poids: z.string().max(100), protection: z.string().max(100) }) }),
    z.object({ type: z.literal('remove-item'), category: z.enum(['armes', 'armures', 'autresAccessoires']), index: z.number().int().min(0).max(99), expected: z.string().max(10000) }),
    z.object({ type: z.literal('unlink-resource'), resourceType: z.enum(['key-role', 'figurant', 'profile', 'power', 'vehicle']), id: z.string().max(100) }),
  ]) }),
  z.object({ ...gameScope, kind: z.literal('link-resource'), operationId: z.string().uuid(), characterId: z.string().max(100), resource: roomResourceSchema }),
  z.object({ ...gameScope, kind: z.literal('resource-linked'), operationId: z.string().uuid(), error: z.string().max(250).optional() }),
  z.object({ ...gameScope, kind: z.literal('sheet-resource'), characterId: z.string().max(100), resource: roomResourceSchema }),
  z.object({ ...gameScope, kind: z.literal("assign-sheet"), assignmentId: z.string().uuid(), character: roomCharacterSchema, resources: z.array(roomResourceSchema).max(200).optional(), project: z.object({ id: z.string().min(1).max(100), title: z.string().trim().min(1).max(80) }).optional() }),
  z.object({ ...gameScope, kind: z.literal("assigned-sheet"), assignmentId: z.string().uuid() }),
  z.object({ ...gameScope, kind: z.literal("sheet"), character: roomCharacterSchema.nullable() }),
]);
export type RoomMessage = z.infer<typeof roomMessageSchema>;
export type RoomSession = { room: string; id: string; token: string; name: string; role: "mj" | "player"; localRoomId?: string; roomDirectoryId?: string; gameGeneration?: string; retiredGameGenerations?: string[]; receivedAssignment?: string; receivedResourceOps?: string[]; characterId?: string };
export type RoomMember = { id: string; name: string; role: "mj" | "player"; instance: string; online: boolean; owlbearRole?: "GM" | "PLAYER"; platform?: 'owlbear'; heroName?: string; heroConcept?: string };
export type RoomSignal = { seq: number; sender: string; senderInstance: string; connection: string; description: RTCSessionDescriptionInit };
export type RoomChatMessage = import('./localRoomGame').LocalGame['messages'][number];
export type RoomRollRequest = z.infer<typeof rollRequestSchema>;
export type RoomPoll = { room?: { title: string; locked: boolean }; self?: { role: "mj" | "player"; hideRolls: boolean }; roomRevision?: number; requests?: RoomRollRequest[]; messages?: RoomChatMessage[]; members: RoomMember[]; signals: RoomSignal[]; iceServers: RTCIceServer[]; relayConfigured: boolean };
export const roomCode = (input: string) => {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try { value = new URL(value).searchParams.get("room") || ""; } catch { return ""; }
  }
  return value.replace(/[\s-]/g, "").toUpperCase();
};

export type RoomListing = { id: string; title: string; host: string; locked: boolean; participants: number; returning?: boolean };
