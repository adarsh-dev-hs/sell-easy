# SellEasy — Frontend

Agentic GTM platform UI built with **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui**.
The frontend holds **no data**: every page reads and writes through the SellEasy API (`../backend`) using
[TanStack Query](https://tanstack.com/query). Only the session token is kept in the browser.

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                  # http://localhost:3000 (start the backend first)
npm run build && npm start
```

## Pages ↔ services

| Route | Service | What you can do |
|---|---|---|
| `/login` | Auth | Sign in, create a workspace, accept an invite |
| `/dashboard` | Analytics | KPIs, signal activity, pipeline by stage, hot accounts, agent feed |
| `/accounts`, `/accounts/[id]` | Entity | CSV/JSON import, search/filter/sort, add/edit/delete, waterfall enrichment, re-score, owner routing, dedup merge, score breakdown, version history, activity timeline |
| `/contacts` | Entity | CSV/JSON import, contacts table, email verification, sequence enrollment, detail sheet |
| `/signals` | Signal ingestion | Live feed, manual ingest, simulation, process pending signals |
| `/scoring` | ICP/Scoring | ICP criteria, fit/intent weights, signal weights, tier thresholds with live preview → re-score all |
| `/agent` | Orchestration agent | Autopilot, run log with step timeline, approval queue for AI drafts, playbook rules |
| `/outreach`, `/outreach/[id]` | Outreach | Sequences + step builder, enrollments, reply inbox, mailbox deliverability |
| `/pipeline` | CRM/Pipeline | Drag-and-drop kanban, table view, deal sheet, CRM sync |
| `/analytics` | Analytics | Attribution, funnel, tier performance, sequence and rep leaderboards, CSV export |
| `/integrations` | Vendors | Connect/configure/sync Clearbit, Apollo, Bombora, RB2B, HeyReach, HubSpot, Anthropic… |
| `/settings` | Auth | Profile, organization & plan, team & roles, API keys, notifications, appearance |

Press **⌘K** anywhere for global search. **Simulate signal** in the header (enabled by the backend's
`ENABLE_SIMULATION`) runs the orchestration agent end to end: it re-scores the account, matches a playbook, and routes, drafts, enrolls or opens a deal.

## Structure

```
src/
  app/(app)/…            authenticated pages (sidebar layout + session guard)
  app/login              sign in · create workspace · accept invite
  components/ui          shadcn/ui primitives
  components/layout      sidebar, header, command menu, notifications
  components/shared      page header, score/tier badges, avatars, status badges, query states…
  lib/api/client.ts      fetch wrapper (base URL, bearer token, error envelope)
  lib/api/hooks/*        typed TanStack Query hooks per service
  lib/api/auth-store.ts  persisted session (token + cached user/org)
  lib/types.ts           API contract types (mirrors backend/src/domain/types.ts)
  lib/constants.ts       UI labels
```
