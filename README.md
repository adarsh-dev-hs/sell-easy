# SellEasy — Frontend

Agentic GTM platform UI built with **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui**.
All data is mocked: a seeded dataset lives in a persisted [zustand](https://github.com/pmndrs/zustand) store
(`localStorage` key `sell-easy-demo`) that behaves like the backend services in the architecture doc.

```bash
npm install
npm run dev        # http://localhost:3000  (demo login is pre-filled)
npm run build && npm start
```

Use **Reset demo data** (user menu or Settings → Organization) to restore the seed dataset.

## Pages ↔ services

| Route | Service | What you can do |
|---|---|---|
| `/login` | Auth | Mock email/SSO sign-in and sign-up |
| `/dashboard` | Analytics | KPIs, signal activity, pipeline by stage, hot accounts, agent feed |
| `/accounts`, `/accounts/[id]` | Entity | Search/filter/sort, add/edit/delete, waterfall enrichment, re-score, owner routing, dedup merge, score breakdown, version history, activity timeline |
| `/contacts` | Entity | Contacts table, email verification, sequence enrollment, detail sheet |
| `/signals` | Signal ingestion | Live feed, manual ingest, simulation, process pending signals |
| `/scoring` | ICP/Scoring | ICP criteria, fit/intent weights, signal weights, tier thresholds with live preview → re-score all |
| `/agent` | Orchestration agent | Autopilot, run log with step timeline, approval queue for AI drafts, playbook rules |
| `/outreach`, `/outreach/[id]` | Outreach | Sequences + step builder, enrollments, reply inbox, mailbox deliverability |
| `/pipeline` | CRM/Pipeline | Drag-and-drop kanban, table view, deal sheet, CRM sync |
| `/analytics` | Analytics | Attribution, funnel, tier performance, sequence and rep leaderboards, CSV export |
| `/integrations` | Vendors | Connect/configure/sync Clearbit, Apollo, Bombora, RB2B, HeyReach, HubSpot, Anthropic… |
| `/settings` | Auth | Profile, organization & plan, team & roles, API keys, notifications, appearance |

Press **⌘K** anywhere for global search, and use **Simulate signal** in the header to watch the orchestration
agent re-score an account, match a playbook and route, draft, enroll or open a deal end-to-end.

## Structure

```
src/
  app/(app)/…            authenticated pages (sidebar layout + auth guard)
  app/login              sign-in
  components/ui          shadcn/ui primitives
  components/layout      sidebar, header, command menu, notifications
  components/shared      page header, score/tier badges, avatars, status badges…
  lib/types.ts           domain model (mirrors service boundaries)
  lib/mock-data.ts       deterministic seed generator
  lib/scoring.ts         fit / intent / tier scoring engine
  lib/store.ts           mock backend: state + all service actions
```

Swapping in the real API later means replacing store actions with calls to the API gateway; page components only
talk to the store.
