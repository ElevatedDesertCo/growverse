import { beforeEach, describe, expect, it, vi } from 'vitest';

// db.ts builds a pg Pool and requires DATABASE_URL at import time; stub both so
// the module loads and every query goes through a spy we can assert against.
const dbMock = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://test/test';
});
vi.mock('pg', () => ({
  Pool: function Pool() {
    return { query: dbMock.query, connect: dbMock.connect };
  },
}));

import {
  APPEARANCE_CREATOR_CUTOFF,
  appearanceRerollAvailable,
  createCharacter,
  spendAppearanceReroll,
} from '../server/db';
import { REALM } from '../server/realm';
import { sanitizeAppearance } from '../src/world_api/appearance';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.connect.mockReset();
});

const LOOK = { gender: 'female', hair: 'afro', brows: 'thick' };

describe('appearance persistence', () => {
  it('stores an authored look as jsonb on creation', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ id: 7 }], rowCount: 1 });
    await createCharacter(1, 'Thornia', 'warrior', null, LOOK);
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toContain('appearance');
    // Serialized, not handed to pg as an object: the column is JSONB and the
    // driver would otherwise coerce it per its own rules.
    expect(params[5]).toBe(JSON.stringify(LOOK));
  });

  it('stores NULL when no look was authored, leaving the legacy class rig', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ id: 8 }], rowCount: 1 });
    await createCharacter(1, 'Plainly', 'mage', null, null);
    const [, params] = dbMock.query.mock.calls[0];
    expect(params[5]).toBeNull();
  });
});

describe('one-shot redesign', () => {
  it('writes the look and burns the token in ONE statement', async () => {
    // Two concurrent redesigns must not both succeed. A read-then-write would
    // let both pass the eligibility check before either wrote, so the guard has
    // to be the UPDATE's own WHERE arm.
    dbMock.query.mockResolvedValueOnce({ rowCount: 1 });
    await spendAppearanceReroll(5, 1, LOOK);
    expect(dbMock.query).toHaveBeenCalledTimes(1);
    const [sql] = dbMock.query.mock.calls[0];
    expect(sql).toContain('UPDATE characters');
    expect(sql).toContain('appearance_reroll_used = TRUE');
    expect(sql).toContain('appearance_reroll_used = FALSE');
  });

  it('scopes the write by owner AND realm, so one account cannot restyle another', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 0 });
    await spendAppearanceReroll(5, 1, LOOK);
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toContain('id = $1 AND account_id = $2 AND realm = $4');
    expect(params[0]).toBe(5);
    expect(params[1]).toBe(1);
    expect(params[3]).toBe(REALM);
  });

  it('admits a character by EITHER the cutoff or a null look', async () => {
    // Both arms matter: the date is the product rule, and `appearance IS NULL`
    // is the safety net for a character created after the cutoff by a client
    // too old to post a look, which would otherwise have neither a look nor
    // any way to choose one.
    dbMock.query.mockResolvedValueOnce({ rowCount: 1 });
    await spendAppearanceReroll(5, 1, LOOK);
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toContain('created_at < $5 OR appearance IS NULL');
    expect(params[4]).toEqual(APPEARANCE_CREATOR_CUTOFF);
  });

  it('reports no redesign left when the update matched no row', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await spendAppearanceReroll(5, 1, LOOK)).toBe(false);
  });

  it('availability mirrors the write guard, so the button matches the outcome', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await appearanceRerollAvailable(5, 1)).toBe(true);
    const [sql] = dbMock.query.mock.calls[0];
    expect(sql).toContain('created_at < $4 OR appearance IS NULL');
    expect(sql).toContain('appearance_reroll_used = FALSE');
  });
});

describe('untrusted look input', () => {
  it('drops unknown keys rather than storing them', () => {
    const out = sanitizeAppearance({ hair: 'afro', evil: 'DROP TABLE characters' });
    expect(out).not.toBeNull();
    expect(out).not.toHaveProperty('evil');
    expect(out?.hair).toBe('afro');
  });

  it('rejects an empty document, so "chose nothing" cannot spend the token', () => {
    // The redesign's whole precondition is that the player authored a design.
    expect(sanitizeAppearance({})).toBeNull();
    expect(sanitizeAppearance({ nothing: 'known' })).toBeNull();
    expect(sanitizeAppearance(null)).toBeNull();
    expect(sanitizeAppearance('a string')).toBeNull();
  });
});
