// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { rememberPlayerSession, rememberedPlayerSession } from './player-session';
const session = { room: 'ABCDEF123456', id: 'alice', token: 'epoch:private', name: 'Alice', role: 'player' as const, characterId: 'hero', roomDirectoryId: 'room-project' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
it('keeps the player-to-hero binding after the Owlbear tab is closed', () => {
  rememberPlayerSession('owl-room', 'alice', session); sessionStorage.clear();
  expect(rememberedPlayerSession('owl-room', 'alice', session.room, 'alice', 'epoch')).toEqual(session);
  rememberPlayerSession('owl-room', 'alice', { ...session, characterId: undefined });
  expect(rememberedPlayerSession('owl-room', 'alice', session.room, 'alice', 'epoch')?.characterId).toBe('hero');
});
it('never restores another account, room, member, or a closed game generation', () => {
  rememberPlayerSession('owl-room', 'alice', session);
  expect(rememberedPlayerSession('owl-room', 'bob', session.room, 'alice', 'epoch')).toBeUndefined();
  expect(rememberedPlayerSession('other-room', 'alice', session.room, 'alice', 'epoch')).toBeUndefined();
  expect(rememberedPlayerSession('owl-room', 'alice', 'OTHER', 'alice', 'epoch')).toBeUndefined();
  expect(rememberedPlayerSession('owl-room', 'alice', session.room, 'bob', 'epoch')).toBeUndefined();
  expect(rememberedPlayerSession('owl-room', 'alice', session.room, 'alice', 'new-epoch')).toBeUndefined();
});
it('ignores missing or malformed storage and never persists an MJ session', () => {
  expect(rememberedPlayerSession('owl-room', 'alice', session.room, 'alice')).toBeUndefined();
  rememberPlayerSession('owl-room', 'alice', { ...session, role: 'mj' });
  expect(localStorage.length).toBe(0);
  localStorage.setItem('clap-owlbear-player-session:v1:owl-room:alice', '{broken');
  expect(rememberedPlayerSession('owl-room', 'alice', session.room, 'alice')).toBeUndefined();
});

it('replaces an old hero binding with a cleared session after a project reset', () => {
  rememberPlayerSession('owl-room', 'alice', { ...session, gameGeneration: 'old-game' });
  rememberPlayerSession('owl-room', 'alice', { ...session, characterId: undefined, gameGeneration: 'new-game' });
  expect(rememberedPlayerSession('owl-room', 'alice', session.room, 'alice', 'epoch')).toBeUndefined();
});
