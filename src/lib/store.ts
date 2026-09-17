"use client"

import { useMemo } from "react"
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { ACTION_LABELS, DEAL_STAGES, SIGNAL_SOURCES } from "./constants"
import { generateSeed, type SeedData } from "./mock-data"
import { scoreAccount } from "./scoring"
import { uid } from "./format"
import type {
  Account,
  Activity,
  AgentRun,
  AgentStep,
  AppNotification,
  Contact,
  Deal,
  DealStage,
  IcpConfig,
  Integration,
  Mailbox,
  OutreachDraft,
  PlaybookRule,
  Sequence,
  SequenceStep,
  Signal,
  SignalType,
  User,
} from "./types"

const now = () => new Date().toISOString()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface AppState extends SeedData {
  isAuthenticated: boolean
  autopilot: boolean

  // Auth / org
  login: (email: string) => void
  logout: () => void
  updateProfile: (patch: Partial<User>) => void
  updateOrg: (patch: Partial<SeedData["org"]>) => void
  inviteUser: (email: string, role: User["role"]) => void
  updateUser: (id: string, patch: Partial<User>) => void
  removeUser: (id: string) => void
  createApiKey: (name: string, scopes: string[]) => string
  revokeApiKey: (id: string) => void

  // Entity
  addAccount: (input: Pick<Account, "name" | "domain" | "industry" | "employees" | "country"> & Partial<Account>) => string
  updateAccount: (id: string, patch: Partial<Account>, source?: string) => void
  deleteAccounts: (ids: string[]) => void
  assignOwner: (ids: string[], ownerId: string | null) => void
  enrichAccounts: (ids: string[]) => Promise<void>
  rescoreAccount: (id: string, reason: string) => { before: number; after: number }
  rescoreAll: (reason: string) => number
  mergeDuplicate: (dupId: string) => void
  dismissDuplicate: (dupId: string) => void
  addNote: (input: { accountId?: string; contactId?: string; dealId?: string; title: string; detail?: string; type?: Activity["type"] }) => void

  // Contacts
  addContact: (input: Omit<Contact, "id" | "createdAt" | "status" | "emailStatus"> & Partial<Contact>) => string
  updateContact: (id: string, patch: Partial<Contact>) => void
  deleteContacts: (ids: string[]) => void
  verifyEmails: (ids: string[]) => Promise<void>
  enrollContacts: (contactIds: string[], sequenceId: string) => number

  // Signals + agent
  ingestSignal: (input: { type: SignalType; accountId: string; title: string; detail: string; strength: number; source?: string; contactId?: string }) => AgentRun | null
  simulateSignal: () => AgentRun | null
  processSignal: (signalId: string) => AgentRun
  processPending: () => number
  setAutopilot: (on: boolean) => void
  addRule: (rule: Omit<PlaybookRule, "id" | "runs">) => void
  updateRule: (id: string, patch: Partial<PlaybookRule>) => void
  deleteRule: (id: string) => void
  approveDraft: (id: string, edits?: Partial<Pick<OutreachDraft, "subject" | "body">>) => void
  rejectDraft: (id: string) => void
  regenerateDraft: (id: string) => Promise<void>

  // ICP
  updateIcp: (patch: Partial<IcpConfig>) => number

  // Outreach
  addSequence: (input: Pick<Sequence, "name"> & Partial<Sequence>) => string
  updateSequence: (id: string, patch: Partial<Sequence>) => void
  deleteSequence: (id: string) => void
  duplicateSequence: (id: string) => string
  addStep: (sequenceId: string, step: Omit<SequenceStep, "id">) => void
  updateStep: (sequenceId: string, stepId: string, patch: Partial<SequenceStep>) => void
  removeStep: (sequenceId: string, stepId: string) => void
  moveStep: (sequenceId: string, stepId: string, dir: -1 | 1) => void
  setEnrollmentStatus: (ids: string[], status: "active" | "paused" | "completed") => void
  removeEnrollments: (ids: string[]) => void
  addMailbox: (input: Pick<Mailbox, "email" | "provider" | "dailyLimit">) => void
  updateMailbox: (id: string, patch: Partial<Mailbox>) => void
  removeMailbox: (id: string) => void
  markMessage: (id: string, patch: { read?: boolean; archived?: boolean; sentiment?: InboxSentiment }) => void
  replyToMessage: (id: string, body: string) => void
  bookMeeting: (messageId: string) => string | null

  // Pipeline
  addDeal: (input: Pick<Deal, "name" | "accountId" | "amount" | "stage" | "closeDate"> & Partial<Deal>) => string
  updateDeal: (id: string, patch: Partial<Deal>) => void
  moveDeal: (id: string, stage: DealStage) => void
  deleteDeal: (id: string) => void
  syncCrm: () => Promise<number>

  // Integrations
  connectIntegration: (id: string, apiKey: string) => Promise<void>
  disconnectIntegration: (id: string) => void
  updateIntegrationSettings: (id: string, settings: Integration["settings"]) => void
  syncIntegration: (id: string) => Promise<void>

  // Notifications
  notify: (n: Omit<AppNotification, "id" | "at" | "read">) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void

  resetDemo: () => void
}

type InboxSentiment = SeedData["inbox"][number]["sentiment"]

const SIM_TEMPLATES: Record<SignalType, { title: string; detail: string }> = {
  intent_topic: { title: "Surging on “AI SDR tools”", detail: "Topic score 84, 9 researchers in the last 48h" },
  website_visit: { title: "Visited pricing page", detail: "2 identified visitors, 5 pageviews in 6 minutes" },
  hiring: { title: "Hiring 3 Account Executives", detail: "New GTM job posts detected" },
  funding: { title: "Raised Series B", detail: "$40M led by Sequoia" },
  job_change: { title: "New VP Sales joined", detail: "Former champion at a customer account" },
  tech_install: { title: "Installed Salesforce", detail: "CRM migration detected" },
  social_engagement: { title: "Engaged with LinkedIn post", detail: "Liked and commented on our launch post" },
  news: { title: "Announced EMEA expansion", detail: "Press release mentions 40 new GTM hires" },
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      const pushActivity = (a: Omit<Activity, "id" | "at"> & { at?: string }) =>
        set((s) => ({ activities: [{ id: uid("act"), at: now(), ...a }, ...s.activities] }))

      const nextOwner = () => {
        const sellers = get().users.filter((u) => u.status === "active" && u.role !== "viewer")
        const counts = sellers.map((u) => ({ u, n: get().accounts.filter((a) => a.ownerId === u.id).length }))
        counts.sort((a, b) => a.n - b.n)
        return counts[0]?.u.id ?? null
      }

      const bestContact = (accountId: string) => {
        const order = ["C-Level", "VP", "Director", "Manager", "IC"]
        return get()
          .contacts.filter((c) => c.accountId === accountId && c.status !== "unsubscribed" && c.status !== "bounced")
          .sort((a, b) => order.indexOf(a.seniority) - order.indexOf(b.seniority))[0]
      }

      return {
        ...generateSeed(),
        isAuthenticated: false,
        autopilot: true,

        // ---------------- Auth ----------------
        login: (email) =>
          set((s) => {
            const existing = s.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
            return { isAuthenticated: true, currentUserId: existing?.id ?? s.currentUserId }
          }),
        logout: () => set({ isAuthenticated: false }),
        updateProfile: (patch) =>
          set((s) => ({ users: s.users.map((u) => (u.id === s.currentUserId ? { ...u, ...patch } : u)) })),
        updateOrg: (patch) => set((s) => ({ org: { ...s.org, ...patch } })),
        inviteUser: (email, role) =>
          set((s) => ({
            users: [
              ...s.users,
              {
                id: uid("usr"),
                email,
                name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                role,
                status: "invited",
                avatarColor: "bg-slate-500",
              },
            ],
          })),
        updateUser: (id, patch) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
        removeUser: (id) =>
          set((s) => ({
            users: s.users.filter((u) => u.id !== id),
            accounts: s.accounts.map((a) => (a.ownerId === id ? { ...a, ownerId: null } : a)),
          })),
        createApiKey: (name, scopes) => {
          const secret = `se_live_${Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 62)]).join("")}`
          set((s) => ({
            apiKeys: [
              { id: uid("key"), name, scopes, prefix: secret.slice(0, 12), createdAt: now(), createdBy: s.currentUserId, revoked: false },
              ...s.apiKeys,
            ],
          }))
          return secret
        },
        revokeApiKey: (id) => set((s) => ({ apiKeys: s.apiKeys.map((k) => (k.id === id ? { ...k, revoked: true } : k)) })),

        // ---------------- Entity ----------------
        addAccount: (input) => {
          const id = uid("acc")
          const domain = input.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase()
          const dup = get().accounts.find((a) => a.domain === domain && !a.duplicateOf)
          const base: Account = {
            city: "",
            revenue: input.employees * 120_000,
            technologies: [],
            fundingStage: "Series A",
            description: "",
            linkedinUrl: "",
            ownerId: null,
            stage: "new",
            enrichmentSources: [],
            tags: [],
            ...input,
            id,
            domain,
            fitScore: 0,
            intentScore: 0,
            score: 0,
            tier: "D",
            scoreHistory: [],
            versions: [{ version: 1, at: now(), source: "Manual entry", changes: [{ field: "record", from: "—", to: "created" }] }],
            duplicateOf: dup?.id,
            createdAt: now(),
            updatedAt: now(),
          }
          const sc = scoreAccount(base, get().signals, get().icp)
          base.fitScore = sc.fit
          base.intentScore = sc.intent
          base.score = sc.score
          base.tier = sc.tier
          base.scoreHistory = [{ at: now(), fit: sc.fit, intent: sc.intent, score: sc.score, reason: "Initial score" }]
          set((s) => ({ accounts: [base, ...s.accounts] }))
          pushActivity({ accountId: id, type: "note", title: "Account created", actorId: get().currentUserId })
          return id
        },
        updateAccount: (id, patch, source = "Manual edit") =>
          set((s) => ({
            accounts: s.accounts.map((a) => {
              if (a.id !== id) return a
              const changes = Object.entries(patch)
                .filter(([k, v]) => JSON.stringify(a[k as keyof Account]) !== JSON.stringify(v))
                .filter(([k]) => !["updatedAt", "scoreHistory", "versions"].includes(k))
                .map(([k, v]) => ({ field: k, from: String(a[k as keyof Account] ?? "—"), to: String(v ?? "—") }))
              const versions = changes.length
                ? [...a.versions, { version: a.versions.length + 1, at: now(), source, changes }]
                : a.versions
              return { ...a, ...patch, versions, updatedAt: now() }
            }),
          })),
        deleteAccounts: (ids) =>
          set((s) => ({
            accounts: s.accounts.filter((a) => !ids.includes(a.id)),
            contacts: s.contacts.filter((c) => !ids.includes(c.accountId)),
            deals: s.deals.filter((d) => !ids.includes(d.accountId)),
            signals: s.signals.filter((x) => !ids.includes(x.accountId)),
            drafts: s.drafts.filter((d) => !ids.includes(d.accountId)),
          })),
        assignOwner: (ids, ownerId) => {
          ids.forEach((id) => get().updateAccount(id, { ownerId }, "Owner assignment"))
          set((s) => ({ contacts: s.contacts.map((c) => (ids.includes(c.accountId) ? { ...c, ownerId } : c)) }))
        },
        enrichAccounts: async (ids) => {
          await sleep(1400)
          const TECH = ["Snowflake", "Segment", "HubSpot", "Salesforce", "Outreach", "Gong"]
          for (const id of ids) {
            const a = get().accounts.find((x) => x.id === id)
            if (!a) continue
            const addTech = TECH.find((t) => !a.technologies.includes(t))
            get().updateAccount(
              id,
              {
                employees: Math.round(a.employees * (1 + Math.random() * 0.08)),
                technologies: addTech ? [...a.technologies, addTech] : a.technologies,
                city: a.city || "San Francisco",
                description: a.description || `${a.name} is a ${a.industry} company headquartered in ${a.country}.`,
                linkedinUrl: a.linkedinUrl || `https://linkedin.com/company/${a.domain.split(".")[0]}`,
                enrichedAt: now(),
                enrichmentSources: Array.from(new Set([...a.enrichmentSources, "Clearbit", "FullEnrich"])),
              },
              "Waterfall enrichment (Clearbit → FullEnrich)",
            )
            pushActivity({ accountId: id, type: "enrichment", title: "Account enriched", detail: "Clearbit → FullEnrich waterfall", actorId: "system" })
            get().rescoreAccount(id, "Enrichment updated firmographics")
          }
        },
        rescoreAccount: (id, reason) => {
          const s = get()
          const a = s.accounts.find((x) => x.id === id)
          if (!a) return { before: 0, after: 0 }
          const sc = scoreAccount(a, s.signals, s.icp)
          set((st) => ({
            accounts: st.accounts.map((x) =>
              x.id === id
                ? {
                    ...x,
                    fitScore: sc.fit,
                    intentScore: sc.intent,
                    score: sc.score,
                    tier: sc.tier,
                    scoreHistory: [...x.scoreHistory, { at: now(), fit: sc.fit, intent: sc.intent, score: sc.score, reason }].slice(-20),
                  }
                : x,
            ),
          }))
          if (sc.score !== a.score)
            pushActivity({ accountId: id, type: "score_change", title: `Score ${a.score} → ${sc.score} (Tier ${sc.tier})`, detail: reason, actorId: "system" })
          return { before: a.score, after: sc.score }
        },
        rescoreAll: (reason) => {
          const s = get()
          let changed = 0
          const accounts = s.accounts.map((a) => {
            const sc = scoreAccount(a, s.signals, s.icp)
            if (sc.score !== a.score || sc.tier !== a.tier) changed++
            return {
              ...a,
              fitScore: sc.fit,
              intentScore: sc.intent,
              score: sc.score,
              tier: sc.tier,
              scoreHistory: [...a.scoreHistory, { at: now(), fit: sc.fit, intent: sc.intent, score: sc.score, reason }].slice(-20),
            }
          })
          set({ accounts })
          return changed
        },
        mergeDuplicate: (dupId) => {
          const s = get()
          const dup = s.accounts.find((a) => a.id === dupId)
          if (!dup?.duplicateOf) return
          const target = dup.duplicateOf
          set((st) => ({
            accounts: st.accounts.filter((a) => a.id !== dupId),
            contacts: st.contacts.map((c) => (c.accountId === dupId ? { ...c, accountId: target } : c)),
            signals: st.signals.map((x) => (x.accountId === dupId ? { ...x, accountId: target } : x)),
            deals: st.deals.map((d) => (d.accountId === dupId ? { ...d, accountId: target } : d)),
          }))
          get().updateAccount(target, { tags: Array.from(new Set([...(s.accounts.find((a) => a.id === target)?.tags ?? []), ...dup.tags])) }, `Merged duplicate “${dup.name}”`)
          pushActivity({ accountId: target, type: "note", title: `Merged duplicate record “${dup.name}”`, actorId: s.currentUserId })
        },
        dismissDuplicate: (dupId) =>
          set((s) => ({ accounts: s.accounts.map((a) => (a.id === dupId ? { ...a, duplicateOf: undefined } : a)) })),
        addNote: ({ type = "note", ...rest }) => pushActivity({ ...rest, type, actorId: get().currentUserId }),

        // ---------------- Contacts ----------------
        addContact: (input) => {
          const id = uid("con")
          set((s) => ({
            contacts: [
              { status: "new", emailStatus: input.email ? "unverified" : "missing", ...input, id, createdAt: now() } as Contact,
              ...s.contacts,
            ],
          }))
          pushActivity({ accountId: input.accountId, contactId: id, type: "note", title: `Contact ${input.firstName} ${input.lastName} added`, actorId: get().currentUserId })
          return id
        },
        updateContact: (id, patch) => set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
        deleteContacts: (ids) =>
          set((s) => ({
            contacts: s.contacts.filter((c) => !ids.includes(c.id)),
            enrollments: s.enrollments.filter((e) => !ids.includes(e.contactId)),
          })),
        verifyEmails: async (ids) => {
          await sleep(1200)
          set((s) => ({
            contacts: s.contacts.map((c) => {
              if (!ids.includes(c.id)) return c
              if (c.emailStatus === "missing") {
                const domain = s.accounts.find((a) => a.id === c.accountId)?.domain ?? "example.com"
                return { ...c, email: `${c.firstName}.${c.lastName}@${domain}`.toLowerCase(), emailStatus: "verified" }
              }
              return { ...c, emailStatus: Math.random() > 0.12 ? "verified" : "invalid" }
            }),
          }))
        },
        enrollContacts: (contactIds, sequenceId) => {
          const s = get()
          const seq = s.sequences.find((x) => x.id === sequenceId)
          if (!seq) return 0
          const eligible = contactIds.filter((id) => {
            const c = s.contacts.find((x) => x.id === id)
            return (
              c &&
              !["unsubscribed", "bounced"].includes(c.status) &&
              c.emailStatus !== "invalid" &&
              !s.enrollments.some((e) => e.contactId === id && e.sequenceId === sequenceId && e.status === "active")
            )
          })
          set((st) => ({
            enrollments: [
              ...eligible.map((contactId) => ({
                id: uid("enr"),
                sequenceId,
                contactId,
                currentStep: 0,
                status: "active" as const,
                enrolledAt: now(),
                nextStepAt: now(),
              })),
              ...st.enrollments,
            ],
            contacts: st.contacts.map((c) => (eligible.includes(c.id) ? { ...c, status: "in_sequence" as const } : c)),
            sequences: st.sequences.map((q) =>
              q.id === sequenceId ? { ...q, stats: { ...q.stats, enrolled: q.stats.enrolled + eligible.length } } : q,
            ),
          }))
          return eligible.length
        },

        // ---------------- Signals & agent ----------------
        ingestSignal: (input) => {
          const signal: Signal = {
            id: uid("sig"),
            source: input.source ?? SIGNAL_SOURCES[input.type][0],
            occurredAt: now(),
            processed: false,
            ...input,
          }
          set((s) => ({ signals: [signal, ...s.signals] }))
          pushActivity({ accountId: signal.accountId, contactId: signal.contactId, type: "signal", title: signal.title, detail: `${signal.source} · strength ${signal.strength}`, actorId: "system" })
          if (!get().autopilot) return null
          return get().processSignal(signal.id)
        },
        simulateSignal: () => {
          const s = get()
          const types = Object.keys(SIM_TEMPLATES) as SignalType[]
          const type = types[Math.floor(Math.random() * types.length)]
          const pool = [...s.accounts].filter((a) => !a.duplicateOf).sort((a, b) => b.fitScore - a.fitScore).slice(0, 30)
          const account = pool[Math.floor(Math.random() * pool.length)]
          const contact = bestContact(account.id)
          const sources = SIGNAL_SOURCES[type]
          return get().ingestSignal({
            type,
            accountId: account.id,
            contactId: ["website_visit", "job_change", "social_engagement"].includes(type) ? contact?.id : undefined,
            source: sources[Math.floor(Math.random() * sources.length)],
            strength: 60 + Math.floor(Math.random() * 38),
            ...SIM_TEMPLATES[type],
          })
        },
        processSignal: (signalId) => {
          const started = Date.now()
          const s0 = get()
          const signal = s0.signals.find((x) => x.id === signalId)!
          const { before, after } = get().rescoreAccount(signal.accountId, `Signal: ${signal.title}`)
          const account = get().accounts.find((a) => a.id === signal.accountId)!
          const steps: AgentStep[] = []
          const rules = get().rules.filter((r) => r.enabled && (r.trigger === "any" || r.trigger === signal.type))
          const rule = rules.find((r) => account.score >= r.minScore && r.tiers.includes(account.tier))
          steps.push({
            action: "evaluate",
            label: "Evaluate signal against playbooks",
            status: "done",
            detail: rule
              ? `Matched “${rule.name}”`
              : rules.length
                ? `${rules.length} playbook(s) considered — score ${account.score} / Tier ${account.tier} below threshold`
                : "No enabled playbook for this signal type",
          })
          steps.push({ action: "rescore", label: "Re-score account", status: "done", detail: `${before} → ${after} (Tier ${account.tier})` })

          let status: AgentRun["status"] = rule ? "completed" : "skipped"
          const runId = uid("run")
          if (rule) {
            for (const action of rule.actions.filter((x) => x !== "rescore")) {
              const label = ACTION_LABELS[action]
              if (action === "route_owner") {
                if (account.ownerId) {
                  steps.push({ action, label, status: "skipped", detail: `Already owned by ${get().users.find((u) => u.id === account.ownerId)?.name}` })
                } else {
                  const owner = nextOwner()
                  get().assignOwner([account.id], owner)
                  steps.push({ action, label, status: "done", detail: `Round-robin assigned to ${get().users.find((u) => u.id === owner)?.name}` })
                }
              } else if (action === "enrich") {
                get().updateAccount(account.id, { enrichedAt: now(), enrichmentSources: Array.from(new Set([...account.enrichmentSources, "FullEnrich"])) }, "Agent enrichment")
                steps.push({ action, label, status: "done", detail: "Clearbit → FullEnrich waterfall refreshed" })
              } else if (action === "draft_outreach") {
                const contact = bestContact(account.id)
                if (!contact) {
                  steps.push({ action, label, status: "failed", detail: "No reachable contact on account" })
                  continue
                }
                const draft: OutreachDraft = {
                  id: uid("drf"),
                  runId,
                  accountId: account.id,
                  contactId: contact.id,
                  channel: signal.type === "job_change" ? "linkedin" : "email",
                  subject: `${account.name}: ${signal.title.toLowerCase()}`,
                  body: `Hi ${contact.firstName},\n\nSaw that ${account.name} ${signal.title.charAt(0).toLowerCase() + signal.title.slice(1)} — ${signal.detail.toLowerCase()}. Teams in ${account.industry} at your stage often use this moment to tighten how they prioritize accounts.\n\nWe help ${contact.department} leaders route the right accounts to reps automatically using live fit + intent scoring. Open to a quick 15-minute look next week?\n\nBest,\n${get().users.find((u) => u.id === (account.ownerId ?? get().currentUserId))?.name.split(" ")[0] ?? "Jordan"}`,
                  rationale: `Tier ${account.tier} (score ${account.score}). Trigger: ${signal.source} — ${signal.title}. Chose ${contact.title} as the most senior reachable contact.`,
                  status: rule.requireApproval ? "pending" : "sent",
                  createdAt: now(),
                  sequenceId: rule.sequenceId,
                }
                set((st) => ({ drafts: [draft, ...st.drafts] }))
                if (rule.requireApproval) {
                  status = "awaiting_approval"
                  steps.push({ action, label: "Draft outreach with Claude", status: "pending", detail: `Draft for ${contact.firstName} ${contact.lastName} awaiting approval` })
                } else {
                  get().updateContact(contact.id, { status: "in_sequence", lastContactedAt: now() })
                  steps.push({ action, label: "Draft outreach with Claude", status: "done", detail: `Sent to ${contact.firstName} ${contact.lastName}` })
                }
              } else if (action === "enroll_sequence") {
                const seq = get().sequences.find((q) => q.id === rule.sequenceId)
                const contact = bestContact(account.id)
                if (!seq || !contact) {
                  steps.push({ action, label, status: "failed", detail: !seq ? "Sequence not configured" : "No reachable contact" })
                  status = "failed"
                  continue
                }
                const n = get().enrollContacts([contact.id], seq.id)
                steps.push({ action, label, status: n ? "done" : "skipped", detail: n ? `${contact.firstName} ${contact.lastName} → “${seq.name}”` : "Contact already enrolled" })
              } else if (action === "create_deal") {
                const open = get().deals.find((d) => d.accountId === account.id && !d.stage.startsWith("closed"))
                if (open) {
                  steps.push({ action, label, status: "skipped", detail: `Open deal exists: ${open.name}` })
                } else {
                  get().addDeal({
                    name: `${account.name} – Discovery`,
                    accountId: account.id,
                    amount: Math.round(account.employees * 40 / 1000) * 1000 || 12000,
                    stage: "discovery",
                    closeDate: new Date(Date.now() + 45 * 86_400_000).toISOString(),
                    source: `Agent: ${signal.type.replace("_", " ")}`,
                    ownerId: account.ownerId ?? get().currentUserId,
                  })
                  steps.push({ action, label, status: "done", detail: "Discovery deal opened" })
                }
              } else if (action === "notify") {
                get().notify({
                  kind: "agent",
                  title: `${account.name}: ${signal.title}`,
                  body: `Tier ${account.tier} · score ${account.score}. ${rule.name}.`,
                  href: `/accounts/${account.id}`,
                })
                steps.push({ action, label, status: "done", detail: "Owner notified in app + Slack" })
              }
            }
          }

          const run: AgentRun = {
            id: runId,
            signalId,
            accountId: account.id,
            ruleId: rule?.id,
            trigger: `${signal.source}: ${signal.title}`,
            startedAt: now(),
            durationMs: Date.now() - started + 800 + Math.floor(Math.random() * 2500),
            status,
            steps,
            scoreBefore: before,
            scoreAfter: after,
          }
          set((st) => ({
            runs: [run, ...st.runs],
            signals: st.signals.map((x) => (x.id === signalId ? { ...x, processed: true } : x)),
            rules: st.rules.map((r) => (r.id === rule?.id ? { ...r, runs: r.runs + 1 } : r)),
          }))
          pushActivity({ accountId: account.id, type: "agent", title: rule ? `Agent ran “${rule.name}”` : "Agent evaluated signal", detail: steps.map((x) => x.label).join(" → "), actorId: "agent" })
          return run
        },
        processPending: () => {
          const pending = get().signals.filter((x) => !x.processed)
          pending.forEach((x) => get().processSignal(x.id))
          return pending.length
        },
        setAutopilot: (on) => set({ autopilot: on }),
        addRule: (rule) => set((s) => ({ rules: [...s.rules, { ...rule, id: uid("rule"), runs: 0 }] })),
        updateRule: (id, patch) => set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
        deleteRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
        approveDraft: (id, edits) => {
          const d = get().drafts.find((x) => x.id === id)
          if (!d) return
          set((s) => ({
            drafts: s.drafts.map((x) => (x.id === id ? { ...x, ...edits, status: "sent" } : x)),
            runs: s.runs.map((r) =>
              r.id === d.runId
                ? { ...r, status: "completed", steps: r.steps.map((st) => (st.status === "pending" ? { ...st, status: "done", detail: `Approved & sent by ${s.users.find((u) => u.id === s.currentUserId)?.name}` } : st)) }
                : r,
            ),
          }))
          get().updateContact(d.contactId, { status: "in_sequence", lastContactedAt: now() })
          if (d.sequenceId) get().enrollContacts([d.contactId], d.sequenceId)
          pushActivity({ accountId: d.accountId, contactId: d.contactId, type: d.channel === "email" ? "email" : "note", title: `Sent: ${edits?.subject ?? d.subject}`, detail: "Agent draft approved", actorId: get().currentUserId })
        },
        rejectDraft: (id) => {
          const d = get().drafts.find((x) => x.id === id)
          set((s) => ({
            drafts: s.drafts.map((x) => (x.id === id ? { ...x, status: "rejected" } : x)),
            runs: s.runs.map((r) =>
              r.id === d?.runId
                ? { ...r, status: "completed", steps: r.steps.map((st) => (st.status === "pending" ? { ...st, status: "skipped", detail: "Draft rejected by reviewer" } : st)) }
                : r,
            ),
          }))
        },
        regenerateDraft: async (id) => {
          await sleep(1100)
          const openers = [
            "Quick thought after seeing your team's recent activity",
            "Noticed some momentum at your company this week",
            "Timely idea given what your team is working on",
          ]
          set((s) => ({
            drafts: s.drafts.map((d) => {
              if (d.id !== id) return d
              const c = s.contacts.find((x) => x.id === d.contactId)
              const a = s.accounts.find((x) => x.id === d.accountId)
              return {
                ...d,
                subject: `${openers[Math.floor(Math.random() * openers.length)]}, ${c?.firstName}`,
                body: `Hi ${c?.firstName},\n\n${a?.name} looks like it's investing in growth right now. Most ${a?.industry} teams we work with see reps waste ~30% of their week on accounts that aren't ready to buy.\n\nWe fix that by scoring every account on fit + live intent and routing only the hot ones. Worth comparing notes for 15 minutes?\n\nCheers`,
              }
            }),
          }))
        },

        // ---------------- ICP ----------------
        updateIcp: (patch) => {
          set((s) => ({ icp: { ...s.icp, ...patch, updatedAt: now() } }))
          return get().rescoreAll("ICP configuration updated")
        },

        // ---------------- Outreach ----------------
        addSequence: (input) => {
          const id = uid("seq")
          set((s) => ({
            sequences: [
              {
                status: "draft",
                ownerId: s.currentUserId,
                mailboxIds: [],
                steps: [{ id: uid("step"), channel: "email", dayOffset: 0, subject: "", body: "" }],
                ...input,
                id,
                createdAt: now(),
                stats: { enrolled: 0, sent: 0, opened: 0, replied: 0, meetings: 0, bounced: 0 },
              },
              ...s.sequences,
            ],
          }))
          return id
        },
        updateSequence: (id, patch) => set((s) => ({ sequences: s.sequences.map((q) => (q.id === id ? { ...q, ...patch } : q)) })),
        deleteSequence: (id) =>
          set((s) => ({
            sequences: s.sequences.filter((q) => q.id !== id),
            enrollments: s.enrollments.filter((e) => e.sequenceId !== id),
            rules: s.rules.map((r) => (r.sequenceId === id ? { ...r, sequenceId: undefined } : r)),
          })),
        duplicateSequence: (id) => {
          const src = get().sequences.find((q) => q.id === id)!
          return get().addSequence({
            ...src,
            name: `${src.name} (copy)`,
            status: "draft",
            steps: src.steps.map((st) => ({ ...st, id: uid("step") })),
          })
        },
        addStep: (sequenceId, step) =>
          set((s) => ({
            sequences: s.sequences.map((q) => (q.id === sequenceId ? { ...q, steps: [...q.steps, { ...step, id: uid("step") }] } : q)),
          })),
        updateStep: (sequenceId, stepId, patch) =>
          set((s) => ({
            sequences: s.sequences.map((q) =>
              q.id === sequenceId ? { ...q, steps: q.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) } : q,
            ),
          })),
        removeStep: (sequenceId, stepId) =>
          set((s) => ({
            sequences: s.sequences.map((q) => (q.id === sequenceId ? { ...q, steps: q.steps.filter((st) => st.id !== stepId) } : q)),
          })),
        moveStep: (sequenceId, stepId, dir) =>
          set((s) => ({
            sequences: s.sequences.map((q) => {
              if (q.id !== sequenceId) return q
              const i = q.steps.findIndex((st) => st.id === stepId)
              const j = i + dir
              if (i < 0 || j < 0 || j >= q.steps.length) return q
              const steps = [...q.steps]
              ;[steps[i], steps[j]] = [steps[j], steps[i]]
              return { ...q, steps }
            }),
          })),
        setEnrollmentStatus: (ids, status) =>
          set((s) => ({ enrollments: s.enrollments.map((e) => (ids.includes(e.id) ? { ...e, status } : e)) })),
        removeEnrollments: (ids) => set((s) => ({ enrollments: s.enrollments.filter((e) => !ids.includes(e.id)) })),
        addMailbox: (input) =>
          set((s) => ({
            mailboxes: [...s.mailboxes, { ...input, id: uid("mb"), sentToday: 0, warmupEnabled: true, healthScore: 70, status: "warning" }],
          })),
        updateMailbox: (id, patch) => set((s) => ({ mailboxes: s.mailboxes.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
        removeMailbox: (id) =>
          set((s) => ({
            mailboxes: s.mailboxes.filter((m) => m.id !== id),
            sequences: s.sequences.map((q) => ({ ...q, mailboxIds: q.mailboxIds.filter((x) => x !== id) })),
          })),
        markMessage: (id, patch) => set((s) => ({ inbox: s.inbox.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
        replyToMessage: (id, body) => {
          const m = get().inbox.find((x) => x.id === id)
          set((s) => ({
            inbox: s.inbox.map((x) => (x.id === id ? { ...x, read: true, thread: [...x.thread, { from: "us", body, at: now() }] } : x)),
          }))
          if (m) {
            const c = get().contacts.find((x) => x.id === m.contactId)
            pushActivity({ accountId: c?.accountId, contactId: m.contactId, type: "email", title: `Replied: ${m.subject}`, detail: body.slice(0, 120), actorId: get().currentUserId })
          }
        },
        bookMeeting: (messageId) => {
          const m = get().inbox.find((x) => x.id === messageId)
          if (!m) return null
          const c = get().contacts.find((x) => x.id === m.contactId)
          if (!c) return null
          get().updateContact(c.id, { status: "meeting" })
          set((s) => ({
            enrollments: s.enrollments.map((e) => (e.contactId === c.id && e.status === "active" ? { ...e, status: "replied" } : e)),
            sequences: s.sequences.map((q) => (q.id === m.sequenceId ? { ...q, stats: { ...q.stats, meetings: q.stats.meetings + 1 } } : q)),
          }))
          const existing = get().deals.find((d) => d.accountId === c.accountId && !d.stage.startsWith("closed"))
          if (existing) {
            if (existing.stage === "discovery") get().moveDeal(existing.id, "qualified")
            return existing.id
          }
          const acc = get().accounts.find((a) => a.id === c.accountId)
          return get().addDeal({
            name: `${acc?.name ?? "New"} – Discovery`,
            accountId: c.accountId,
            contactId: c.id,
            amount: 24000,
            stage: "discovery",
            closeDate: new Date(Date.now() + 40 * 86_400_000).toISOString(),
            source: "Sequence reply",
          })
        },

        // ---------------- Pipeline ----------------
        addDeal: (input) => {
          const id = uid("deal")
          const prob = DEAL_STAGES.find((s) => s.id === input.stage)?.probability ?? 10
          set((s) => ({
            deals: [
              {
                ownerId: s.currentUserId,
                probability: prob,
                source: "Manual",
                notes: "",
                ...input,
                id,
                createdAt: now(),
                updatedAt: now(),
              },
              ...s.deals,
            ],
            accounts: s.accounts.map((a) =>
              a.id === input.accountId && ["new", "researching", "engaged"].includes(a.stage) ? { ...a, stage: "opportunity" } : a,
            ),
          }))
          pushActivity({ accountId: input.accountId, dealId: id, type: "stage_change", title: `Deal created: ${input.name}`, actorId: get().currentUserId })
          return id
        },
        updateDeal: (id, patch) =>
          set((s) => ({ deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: now(), syncedAt: undefined } : d)) })),
        moveDeal: (id, stage) => {
          const d = get().deals.find((x) => x.id === id)
          if (!d || d.stage === stage) return
          const prob = DEAL_STAGES.find((s) => s.id === stage)?.probability ?? d.probability
          get().updateDeal(id, { stage, probability: prob, ...(stage.startsWith("closed") ? { closeDate: now() } : {}) })
          if (stage === "closed_won") {
            get().updateAccount(d.accountId, { stage: "customer" }, "Deal closed won")
            get().notify({ kind: "deal", title: "🎉 Deal won", body: `${d.name} closed for $${d.amount.toLocaleString()}`, href: "/pipeline" })
          }
          pushActivity({
            accountId: d.accountId,
            dealId: id,
            type: "stage_change",
            title: `${d.name}: ${DEAL_STAGES.find((s) => s.id === d.stage)?.label} → ${DEAL_STAGES.find((s) => s.id === stage)?.label}`,
            actorId: get().currentUserId,
          })
        },
        deleteDeal: (id) => set((s) => ({ deals: s.deals.filter((d) => d.id !== id) })),
        syncCrm: async () => {
          await sleep(1600)
          const unsynced = get().deals.filter((d) => !d.syncedAt).length
          set((s) => ({
            deals: s.deals.map((d) => ({ ...d, crmId: d.crmId ?? `HS-${Math.floor(100000 + Math.random() * 899999)}`, syncedAt: now() })),
            integrations: s.integrations.map((i) => (i.category === "crm" && i.connected ? { ...i, lastSyncAt: now(), status: "ok" } : i)),
          }))
          return unsynced
        },

        // ---------------- Integrations ----------------
        connectIntegration: async (id, apiKey) => {
          set((s) => ({ integrations: s.integrations.map((i) => (i.id === id ? { ...i, status: "syncing" } : i)) }))
          await sleep(1300)
          set((s) => ({
            integrations: s.integrations.map((i) =>
              i.id === id
                ? {
                    ...i,
                    connected: true,
                    status: "ok",
                    lastSyncAt: now(),
                    apiKeyMasked: `••••••••${apiKey.slice(-4)}`,
                    usage: i.usage ?? { used: 0, limit: 10000, unit: i.category === "llm" ? "k tokens" : "credits" },
                  }
                : i,
            ),
          }))
        },
        disconnectIntegration: (id) =>
          set((s) => ({
            integrations: s.integrations.map((i) =>
              i.id === id ? { ...i, connected: false, status: "disconnected", apiKeyMasked: undefined, lastSyncAt: undefined } : i,
            ),
          })),
        updateIntegrationSettings: (id, settings) =>
          set((s) => ({ integrations: s.integrations.map((i) => (i.id === id ? { ...i, settings: { ...i.settings, ...settings } } : i)) })),
        syncIntegration: async (id) => {
          set((s) => ({ integrations: s.integrations.map((i) => (i.id === id ? { ...i, status: "syncing" } : i)) }))
          await sleep(1500)
          set((s) => ({
            integrations: s.integrations.map((i) =>
              i.id === id
                ? { ...i, status: "ok", lastSyncAt: now(), usage: i.usage && { ...i.usage, used: Math.min(i.usage.limit, i.usage.used + Math.floor(Math.random() * 150)) } }
                : i,
            ),
          }))
        },

        // ---------------- Notifications ----------------
        notify: (n) =>
          set((s) => ({ notifications: [{ ...n, id: uid("ntf"), at: now(), read: false }, ...s.notifications].slice(0, 50) })),
        markNotificationRead: (id) =>
          set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

        resetDemo: () => set({ ...generateSeed(), autopilot: true }),
      }
    },
    {
      name: "sell-easy-demo",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) =>
        Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== "function")) as Partial<AppState>,
    },
  ),
)

// ---------- Selectors / helpers ----------
export const useCurrentUser = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId)!)

export function useLookup() {
  const accounts = useStore((s) => s.accounts)
  const contacts = useStore((s) => s.contacts)
  const users = useStore((s) => s.users)
  const sequences = useStore((s) => s.sequences)
  return useMemo(() => {
    const maps = {
      accounts: new Map(accounts.map((x) => [x.id, x])),
      contacts: new Map(contacts.map((x) => [x.id, x])),
      users: new Map(users.map((x) => [x.id, x])),
      sequences: new Map(sequences.map((x) => [x.id, x])),
    }
    return {
      account: (id?: string | null) => (id ? maps.accounts.get(id) : undefined),
      contact: (id?: string | null) => (id ? maps.contacts.get(id) : undefined),
      user: (id?: string | null) => (id ? maps.users.get(id) : undefined),
      sequence: (id?: string | null) => (id ? maps.sequences.get(id) : undefined),
    }
  }, [accounts, contacts, users, sequences])
}
