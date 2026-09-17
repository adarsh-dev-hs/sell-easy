"use client"

import { useMemo, useRef, useState } from "react"
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { BotIcon, CalendarIcon, CheckCircle2Icon, MoreHorizontalIcon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CompanyAvatar, UserAvatar } from "@/components/shared/avatars"
import { DEAL_STAGE_LABEL, DEAL_STAGES } from "@/lib/constants"
import { currency, shortDate, timeAgo } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Deal, DealStage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { isAgentSourced, isOverdue } from "./deal-utils"

type Lookup = ReturnType<typeof useLookup>

const STAGE_ACCENT: Record<DealStage, string> = {
  discovery: "bg-slate-400",
  qualified: "bg-sky-500",
  demo: "bg-indigo-500",
  proposal: "bg-violet-500",
  negotiation: "bg-amber-500",
  closed_won: "bg-emerald-500",
  closed_lost: "bg-rose-500",
}

export function DealBoard({
  deals,
  nowMs,
  onOpen,
}: {
  deals: Deal[]
  nowMs: number
  onOpen: (id: string) => void
}) {
  const moveDeal = useStore((s) => s.moveDeal)
  const lookup = useLookup()
  const [activeId, setActiveId] = useState<string | null>(null)
  const lastDragEnd = useRef(0)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const columns = useMemo(
    () =>
      DEAL_STAGES.map((stage) => {
        const items = deals.filter((d) => d.stage === stage.id)
        return { ...stage, items, total: items.reduce((s, d) => s + d.amount, 0) }
      }),
    [deals],
  )
  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : undefined

  const move = (deal: Deal, stage: DealStage) => {
    if (deal.stage === stage) return
    moveDeal(deal.id, stage)
    toast.success(`${deal.name} moved to ${DEAL_STAGE_LABEL[stage]}`)
  }

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    lastDragEnd.current = Date.now()
    if (!e.over) return
    const deal = deals.find((d) => d.id === e.active.id)
    if (deal) move(deal, e.over.id as DealStage)
  }

  const open = (id: string) => {
    // Ignore the synthetic click that can follow a drop onto the same card.
    if (Date.now() - lastDragEnd.current < 150) return
    onOpen(id)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div className="flex min-w-max gap-3">
          {columns.map((col) => (
            <BoardColumn key={col.id} id={col.id} label={col.label} count={col.items.length} total={col.total}>
              {col.items.map((d) => (
                <DraggableDeal key={d.id} deal={d} nowMs={nowMs} lookup={lookup} onOpen={open} onMove={move} />
              ))}
            </BoardColumn>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <DealCardBody deal={activeDeal} nowMs={nowMs} lookup={lookup} className="rotate-2 shadow-lg ring-2 ring-primary/40" />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function BoardColumn({
  id,
  label,
  count,
  total,
  children,
}: {
  id: DealStage
  label: string
  count: number
  total: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className={cn("size-2 rounded-full", STAGE_ACCENT[id])} />
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
        <span className="ml-auto text-xs font-medium text-muted-foreground tabular-nums">{currency(total)}</span>
      </div>
      <div className="flex max-h-[calc(100vh-22rem)] min-h-40 flex-col gap-2 overflow-y-auto p-2">
        {children}
        {count === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-xs text-muted-foreground">
            Drop deals here
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableDeal({
  deal,
  nowMs,
  lookup,
  onOpen,
  onMove,
}: {
  deal: Deal
  nowMs: number
  lookup: Lookup
  onOpen: (id: string) => void
  onMove: (deal: Deal, stage: DealStage) => void
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: deal.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${deal.name}, ${DEAL_STAGE_LABEL[deal.stage]}. Press Enter to open.`}
      onClick={() => onOpen(deal.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen(deal.id)
        }
      }}
      className={cn(
        "cursor-grab rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <DealCardBody
        deal={deal}
        nowMs={nowMs}
        lookup={lookup}
        menu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Deal actions"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onSelect={() => onOpen(deal.id)}>Open deal</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Move to stage</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={deal.stage} onValueChange={(v) => onMove(deal, v as DealStage)}>
                {DEAL_STAGES.map((s) => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </div>
  )
}

function DealCardBody({
  deal,
  nowMs,
  lookup,
  menu,
  className,
}: {
  deal: Deal
  nowMs: number
  lookup: Lookup
  menu?: React.ReactNode
  className?: string
}) {
  const account = lookup.account(deal.accountId)
  const owner = lookup.user(deal.ownerId)
  const overdue = isOverdue(deal, nowMs)
  return (
    <div className={cn("space-y-2.5 rounded-lg border bg-card p-3 text-card-foreground shadow-xs hover:border-foreground/20", className)}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-sm leading-snug font-medium">{deal.name}</div>
        {menu}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CompanyAvatar name={account?.name ?? "?"} className="size-5 rounded text-[9px]" />
        <span className="truncate">{account?.name ?? "Unknown account"}</span>
      </div>
      {isAgentSourced(deal.source) && (
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          <BotIcon /> {deal.source}
        </Badge>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{currency(deal.amount)}</span>
        <span
          className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground",
            overdue && "font-medium text-rose-600 dark:text-rose-400",
          )}
        >
          <CalendarIcon className="size-3" />
          {shortDate(deal.closeDate)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                {deal.syncedAt ? (
                  <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Synced to CRM" />
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    unsynced
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {deal.syncedAt ? `Synced to HubSpot ${timeAgo(deal.syncedAt)}` : "Changes not yet pushed to CRM"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <UserAvatar user={owner} className="size-5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{owner?.name ?? "Unassigned"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
