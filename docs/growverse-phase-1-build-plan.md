# GROWVERSE — Phase 1 Build Plan

## Goal
Single-player playable game with a real grow loop and base building. Local save only. Installable as a PWA. Roughly 4-6 weeks at 4-7 hrs/week.

## Definition of Done for Phase 1
You can play it on your phone for 20+ minutes without being bored, and progress survives closing the app.

## Stack (locked)
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Zustand for game state
- Framer Motion for animations
- LocalStorage via Zustand persist middleware
- next-pwa for PWA install
- Lucide React for icons
- Vercel for deployment
- Dev server runs on port 4200

## Sprint 1 — Foundation (~5 hrs)
Empty game shell. ResourceBar, BottomNav, 6x6 grid, Edit Base + Build buttons. No mechanics yet.

## Sprint 2 — Building Placement (~6 hrs)
Build Menu drawer, 4 buildings defined, placement flow, Edit Base mode.

## Sprint 3 — Grow Loop + Resources (~7 hrs)
Zustand store, growth timers, tap-to-harvest, passive Fire generation, live resource updates.

## Sprint 4 — Costs + Upgrades (~6 hrs)
Cost gating, spending decrements resources, upgrade modal, 5 tiers with 1.5x cost scaling.

## Sprint 5 — Save + Polish + PWA (~8 hrs)
LocalStorage persistence, offline progress, animations, PWA manifest, home screen install.

## Phase 1 Done Checklist
- PWA installs on phone
- Save survives app close
- Offline progress works
- All 4 building types placeable
- Grow Tent harvest loop works
- 5 tier upgrades work
- 20+ min voluntary play test
- 1 friend tested on their phone

## Risks
1. Art is your bottleneck — batch all illustrations in one art day between Sprint 1 and 2
2. Timer math is sneaky — test with 10-30 sec timers, scale up only in Sprint 5
3. Scope creep kills indie games — every 'what if' goes in PHASE-2-BACKLOG.md
4. No animations or sound until Sprint 5

Version 1.0 — locked.
