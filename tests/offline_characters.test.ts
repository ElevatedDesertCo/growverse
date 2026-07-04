import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteOfflineCharacter,
  getOfflineCharacter,
  listOfflineCharacters,
  offlineCharacterId,
  saveOfflineCharacter,
} from '../src/game/offline_characters';
import { type CharacterState, Sim } from '../src/sim/sim';

// Plain-node test env: no DOM, so stub localStorage (mirrors keybinds.test.ts).
function installStorage(): void {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
}

// A minimal CharacterState is enough: the module treats it as an opaque blob and
// only reads `.level` for the roster line.
function fakeState(level: number): CharacterState {
  return { level } as CharacterState;
}

beforeEach(() => installStorage());

describe('offlineCharacterId', () => {
  it('keys by class + lowercased name', () => {
    expect(offlineCharacterId('mage', 'Anderz')).toBe('mage:anderz');
    expect(offlineCharacterId('warrior', '  Grok  ')).toBe('warrior:grok');
  });
});

describe('offline character roster', () => {
  it('starts empty', () => {
    expect(listOfflineCharacters()).toEqual([]);
    expect(getOfflineCharacter('mage:anderz')).toBeNull();
  });

  it('saves and reads back a character', () => {
    saveOfflineCharacter({ cls: 'mage', name: 'Anderz', skin: 2, state: fakeState(7) });
    const all = listOfflineCharacters();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id: 'mage:anderz',
      name: 'Anderz',
      cls: 'mage',
      skin: 2,
      level: 7,
    });
    expect(getOfflineCharacter('mage:anderz')?.state.level).toBe(7);
  });

  it('upserts the same slot instead of duplicating', () => {
    saveOfflineCharacter({ cls: 'mage', name: 'Anderz', skin: 0, state: fakeState(3) });
    saveOfflineCharacter({ cls: 'mage', name: 'anderz', skin: 0, state: fakeState(9) });
    const all = listOfflineCharacters();
    expect(all).toHaveLength(1);
    expect(all[0].level).toBe(9);
  });

  it('keeps distinct classes with the same name apart', () => {
    saveOfflineCharacter({ cls: 'mage', name: 'Twin', skin: 0, state: fakeState(1) });
    saveOfflineCharacter({ cls: 'warrior', name: 'Twin', skin: 0, state: fakeState(1) });
    expect(listOfflineCharacters()).toHaveLength(2);
  });

  it('orders most-recently-saved first', async () => {
    saveOfflineCharacter({ cls: 'mage', name: 'First', skin: 0, state: fakeState(1) });
    await new Promise((r) => setTimeout(r, 2));
    saveOfflineCharacter({ cls: 'warrior', name: 'Second', skin: 0, state: fakeState(1) });
    const names = listOfflineCharacters().map((c) => c.name);
    expect(names[0]).toBe('Second');
  });

  it('deletes a slot', () => {
    saveOfflineCharacter({ cls: 'mage', name: 'Gone', skin: 0, state: fakeState(1) });
    deleteOfflineCharacter('mage:gone');
    expect(listOfflineCharacters()).toEqual([]);
  });

  it('survives a corrupt localStorage payload', () => {
    localStorage.setItem('growverse.offline.characters.v1', '{ not json');
    expect(listOfflineCharacters()).toEqual([]);
  });

  it('caps the roster at 16 slots', () => {
    for (let i = 0; i < 20; i++) {
      saveOfflineCharacter({ cls: 'mage', name: `Char${i}`, skin: 0, state: fakeState(1) });
    }
    expect(listOfflineCharacters().length).toBeLessThanOrEqual(16);
  });
});

// The end-to-end offline persistence flow the player actually hits: a fresh
// character is serialized by the running Sim, saved to the roster on entry, read
// back on reload, and restored into a new Sim. This guards the exact regression
// reported in the field (a newly created offline character not surviving a tab
// close) against a break anywhere along serialize -> save -> load -> restore.
describe('offline persistence end-to-end (Sim <-> roster)', () => {
  it('a freshly created character serializes to a non-null state and persists', () => {
    const sim = new Sim({ seed: 99, playerClass: 'warrior', playerName: 'Anderz' });
    const meta = sim.players.get(sim.playerId);
    expect(meta).toBeTruthy();
    // A brand-new (non-resumed) player MUST serialize; a null here is exactly the
    // silent-skip that would leave the roster empty after a tab close.
    const state = sim.serializeCharacter(sim.playerId);
    expect(state).not.toBeNull();

    saveOfflineCharacter({ cls: meta!.cls, name: meta!.name, skin: 0, state: state! });
    const saved = getOfflineCharacter(offlineCharacterId('warrior', 'Anderz'));
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe('Anderz');
    expect(saved!.cls).toBe('warrior');
  });

  it('restores a saved character back into a fresh Sim with progression intact', () => {
    // Author a character with some progression, then run the real save path.
    const sim = new Sim({ seed: 3, playerClass: 'mage', playerName: 'Emberz', noPlayer: true });
    const pid = sim.addPlayer('mage', 'Emberz');
    sim.setPlayerLevel(8, pid);
    sim.meta(pid)!.copper = 777;
    const state = sim.serializeCharacter(pid)!;
    saveOfflineCharacter({ cls: 'mage', name: 'Emberz', skin: 2, state });

    // Reload: read the roster slot and resume it into a brand-new Sim (mirrors
    // startOffline's resume branch: noPlayer + addPlayer({ state })).
    const rec = getOfflineCharacter(offlineCharacterId('mage', 'Emberz'))!;
    const resumed = new Sim({ seed: 3, playerClass: 'mage', playerName: 'Emberz', noPlayer: true });
    const rpid = resumed.addPlayer('mage', 'Emberz', { state: rec.state });
    const m = resumed.meta(rpid)!;
    expect(resumed.entities.get(rpid)!.level).toBe(8);
    expect(m.copper).toBe(777);
    expect(rec.skin).toBe(2);
    expect(rec.level).toBe(8);
  });
});
