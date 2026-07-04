import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteOfflineCharacter,
  getOfflineCharacter,
  listOfflineCharacters,
  offlineCharacterId,
  saveOfflineCharacter,
} from '../src/game/offline_characters';
import type { CharacterState } from '../src/sim/sim';

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
