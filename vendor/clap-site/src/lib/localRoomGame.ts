import { z } from 'zod/v3';

export const chatEntrySchema = z.object({
  id: z.number().int().nonnegative(), sender: z.string().max(100), name: z.string().max(40),
  role: z.enum(['mj', 'player']), text: z.string().max(2400), created: z.number().finite().nonnegative(),
  kind: z.enum(['chat', 'roll', 'request', 'system', 'whisper']).optional(), hidden: z.boolean().optional(),
  requestId: z.string().max(100).optional(), privateTo: z.string().max(100).optional(),
});
export const rollRequestSchema = z.object({
  id: z.string().uuid(), requester: z.string().max(100), target: z.string().max(100), label: z.string().min(1).max(160),
  attributes: z.array(z.object({ facet: z.enum(['corps', 'esprit', 'ame']), name: z.string().min(1).max(80) })).min(1).max(2),
  die: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12)]), created: z.number().finite(),
});
export const gameCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat'), id: z.string().uuid(), text: z.string().trim().min(1).max(2000), target: z.string().max(100).optional() }),
  z.object({ type: z.literal('roll'), id: z.string().uuid(), label: z.string().trim().min(1).max(300), summary: z.string().trim().min(1).max(1500), requestId: z.string().uuid().optional(), public: z.boolean().optional() }),
]);
export const localGameSchema = z.object({
  messages: z.array(chatEntrySchema).max(3200), requests: z.array(rollRequestSchema).max(100),
  hideRolls: z.boolean(), sequence: z.number().int().nonnegative(), events: z.array(z.string().max(210)).max(2000),
});
export type LocalGame = z.infer<typeof localGameSchema>;
export type GameCommand = z.infer<typeof gameCommandSchema>;
export type GameMember = { id: string; name: string; role: 'mj' | 'player' };
export const emptyGame = (): LocalGame => ({ messages: [], requests: [], hideRolls: false, sequence: 0, events: [] });
export function gameView(game: LocalGame, member: GameMember) {
  return {
    messages: game.messages.filter(message => !message.privateTo || message.privateTo === member.id || (message.kind === 'whisper' && message.sender === member.id)),
    requests: game.requests.filter(request => member.role === 'mj' || request.target === member.id),
  };
}
export function applyGameCommand(game: LocalGame, input: GameCommand, member: GameMember, members: GameMember[], now = Date.now()): LocalGame {
  const command = gameCommandSchema.parse(input);
  const event = member.id + ':' + command.id;
  if (game.events.includes(event)) return game;
  let privateTo: string | undefined;
  let kind: 'chat' | 'whisper' | 'roll' = 'chat';
  let text: string;
  let requestId: string | undefined;
  let requests = game.requests;
  if (command.type === 'chat') {
    text = command.text;
    if (command.target) {
      if (command.target === member.id || !members.some(value => value.id === command.target)) throw new Error('Destinataire privé invalide.');
      privateTo = command.target; kind = 'whisper';
    }
  } else {
    kind = 'roll';
    const request = command.requestId ? requests.find(value => value.id === command.requestId && value.target === member.id) : undefined;
    if (command.requestId && !request) throw new Error('Cette demande de jet est expirée ou ne t’est pas destinée.');
    requestId = request?.id;
    text = `${request ? request.label + ' · ' : ''}${command.label}\n${command.summary}`;
    requests = requests.filter(value => value.id !== requestId);
    if (member.role === 'mj' && game.hideRolls && !command.public) privateTo = member.id;
  }
  const message = { id: game.sequence + 1, sender: member.id, name: member.name, role: member.role, text, created: now, kind, hidden: Boolean(privateTo), ...(privateTo ? { privateTo } : {}), ...(requestId ? { requestId } : {}) };
  const messages = [...game.messages, message];
  // Bound each private conversation separately from the public discussion.
  const scope = privateTo || '';
  const keep = new Set(messages.filter(value => (value.privateTo || '') === scope).slice(-200).map(value => value.id));
  return { ...game, sequence: message.id, requests, messages: messages.filter(value => (value.privateTo || '') !== scope || keep.has(value.id)).slice(-3200), events: [...game.events, event].slice(-2000) };
}
