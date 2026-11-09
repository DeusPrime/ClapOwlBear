// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { blankCharacter } from '@/lib/characters';
import RoomHeroReserve from '@/components/RoomHeroReserve';
import RoomHeroProposalDialog from '@/components/RoomHeroProposalDialog';
const state = vi.hoisted(() => ({ room: {} as any, assign: vi.fn(async () => {}), decide: vi.fn(async () => {}) }));
vi.mock('@/hooks/use-room', () => ({ useRoom: () => state.room }));
vi.mock('@/lib/roomClient', () => ({ roomClient: { assignCharacter: state.assign, resolveHeroProposal: state.decide } }));
vi.mock('@/components/RoomLibraryPicker', () => ({ default: () => null }));
vi.mock('@/components/RoomHeroStateEditor', () => ({ default: () => null }));
vi.mock('@/components/RoomRollRequests', () => ({ default: () => null }));
vi.mock('@/components/RoomPlayersBoard', () => ({ PlayerSheet: () => null }));
vi.mock('@/pages/CharacterEditor', () => ({ CharacterCards: ({ c, activeCardTab }: any) => <div data-page={activeCardTab}>{c.nom} · {activeCardTab}</div> }));
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  state.room = { session: { role: 'mj', id: 'host' }, roomHeroes: [], sheets: {}, savedSheets: {}, members: [{ id: 'sam', name: 'Sam', role: 'player', online: true }], connected: ['sam'], heroProposals: [] };
});
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.clearAllMocks(); });
const button = (name: string) => [...document.querySelectorAll('button')].find(node => node.textContent === name)!;
it('shows each hero once with its player and lets the MJ assign an available hero from the player list', async () => {
  const assigned = { ...blankCharacter(), nom: 'Ariane' }, available = { ...blankCharacter(), nom: 'Boris' };
  state.room.roomHeroes = [assigned, available]; state.room.savedSheets = { sam: assigned }; state.room.sheets = { sam: assigned };
  await act(async () => root.render(<RoomHeroReserve characters={[]} />));
  expect(document.querySelectorAll('section > ul > li')).toHaveLength(2);
  expect(document.body.textContent).toContain('Sam');
  expect(document.body.textContent).not.toContain('Les héros de la table');
  await act(async () => button('Attribuer').click());
  await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(node => node.textContent?.includes('Sam'))!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(state.assign).toHaveBeenCalledWith('sam', available.id);
});
it('lets the MJ inspect every page of a proposal before approving it', async () => {
  state.room.heroProposals = [{ id: 'proposal', playerId: 'sam', character: { ...blankCharacter(), nom: 'Proposition' } }];
  await act(async () => root.render(<RoomHeroProposalDialog />));
  for (const [label, page] of [['Identité','identity'],['Attributs','attributes'],['Équipement','traits'],['État','state'],['Notes','notes'],['Portrait','back']]) {
    await act(async () => button(label).click());
    expect(document.querySelector(`[data-page="${page}"]`)).not.toBeNull();
    expect(state.decide).not.toHaveBeenCalled();
  }
  await act(async () => button('Autoriser').click());
  expect(state.decide).toHaveBeenCalledWith('proposal', true);
});
