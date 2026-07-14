import type { ReputationView } from '../sim/types';

// Reputation: the commune-standing seam. A read-only facet (standing is earned server-side
// through cultivation/breeding, never a direct client command): one ReputationView per
// faction with points, tier, and progress toward the next tier. Mirrored from the
// self-snapshot online, computed live offline.
export interface IWorldReputation {
  reputation: ReputationView[];
}
