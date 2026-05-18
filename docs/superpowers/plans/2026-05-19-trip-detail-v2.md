# Trip Detail v2 Implementation Plan

> **Goal:** Implement the v2 design (`docs/mockups/trip-detail-v2.html`) into the live React project at `/trips/[id]`. Major changes: ItinerarySection timeline + day pills, ChecklistSection rich vertical cards, gradient section headers across all 4 sections. **Zero functional regressions.**

## Files to Modify

| File | Change Scope |
|------|--------------|
| `src/app/(app)/trips/[id]/_sections/ItinerarySection.tsx` | **Major rewrite** — day pills + timeline panel |
| `src/app/(app)/trips/[id]/_sections/ChecklistSection.tsx` | **Major rewrite** — vertical rich cards + edit modal |
| `src/app/(app)/trips/[id]/_sections/TasksSection.tsx` | Polish — gradient header, hover-only delete |
| `src/app/(app)/trips/[id]/_sections/ExpensesSection.tsx` | Polish — gradient header, gradient totals card |
| `src/app/(app)/trips/[id]/_components/JumpBar.tsx` | Polish — pill chips style |
| `src/app/(app)/trips/[id]/_components/SectionHeader.tsx` | **NEW** — shared component |
| `src/components/ui/EditChecklistModal.tsx` | **NEW** — checklist edit dialog (reuse pattern from CreateChecklistModal) |

## Files to LEAVE UNCHANGED

- `src/app/(app)/trips/[id]/day/[day]/DayDetailClient.tsx` — drag-drop editor stays as-is
- `src/app/(app)/trips/[id]/TripDetailClient.tsx` — only minor prop pass-through if needed
- All API files (`lib/api/*.api.ts`) — backend contracts unchanged
- All backend code — unchanged

## Functionality Contract (MUST PRESERVE)

### ItinerarySection
- ✅ Bucket items (day === null) still shown at top
- ✅ Bucket drag-to-reorder still works
- ✅ Click day card title → navigate to `/trips/[id]/day/[day]` (existing edit page)
- ✅ `canEdit` controls add-day, add-spot, drag affordances
- ✅ `canDelete` controls bucket delete buttons
- ✅ Supports trips WITH dates (auto-derived 1..N days) AND WITHOUT dates (manual extraDays)
- ✅ Hot-reload via socket `itinerary:changed` invalidates query
- ✅ Empty trip (no items, no dates) shows "Day 1" as default

### ChecklistSection
- ✅ Optimistic toggle via `checklistsApi.toggle`
- ✅ Socket `checklist:*` events invalidate query
- ✅ `canEdit` controls add button; `canDelete` controls delete; creator can always delete own (existing rule)
- ✅ Create modal still works
- ✅ Confirm dialog before delete
- ✅ Toast feedback

### TasksSection / ExpensesSection
- ✅ All current functionality preserved (we're only polishing visual)

## Design System Decisions

```tsx
// Shared SectionHeader API
interface SectionHeaderProps {
  icon: LucideIcon;
  iconGradient: 'indigo' | 'violet' | 'emerald' | 'amber';
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}

// Gradient map
const GRADIENTS = {
  indigo: 'from-indigo-500 to-violet-600 shadow-indigo-500/30',
  violet: 'from-violet-500 to-purple-600 shadow-violet-500/30',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/30',
  amber: 'from-amber-500 to-orange-600 shadow-amber-500/30',
};
```

### Itinerary day pills
- Auto-render from trip date range (`tripTotalDays`) when dates set
- Auto-render from `extraDays + items.day` when dates not set
- Active day stored in local state (`useState<number | null>(null)` — defaults to today if in range, else first day)
- Empty day → big CTA "新增第一個景點" → opens SpotEditorModal (existing)
- Has-items day → timeline + small "+ 新增景點到 Day X" at end → opens SpotEditorModal

### Checklist cards
- Single-column (no more 2-col grid)
- Card states: `all-done` (emerald glow) / `partial` / `none-started`
- Three vertical sections per card: header (checkbox + title + actions), progress bar, members grouped (✓ done | ○ pending)
- Click title → open EditChecklistModal
- Hover row → delete + edit icons fade in
- New EditChecklistModal mirrors CreateChecklistModal but pre-fills + calls `checklistsApi.update`

## Implementation Order (Sequential to avoid conflicts)

1. SectionHeader shared component (new file, 0 risk)
2. ItinerarySection rewrite
3. ChecklistSection rewrite + EditChecklistModal
4. TasksSection / ExpensesSection polish
5. JumpBar polish

## Testing Plan (after each major change)

### Functional smoke test (Playwright)
1. **Navigation**: Open `/trips/[testTripId]` — page loads, no console errors
2. **Itinerary day switching**: Click Day 1 pill → see Day 1 items. Click Day 3 → see empty state.
3. **Itinerary navigation**: Click "編輯" → navigate to day detail page works
4. **Checklist toggle**: Click checkbox → completes optimistically, then confirmed via API
5. **Checklist edit**: Click title → modal opens with prefilled data → save → updates
6. **Checklist delete**: Hover → click trash → confirm → item removed
7. **Section settings**: Click gear → drawer opens; tabs switch; close works

### RWD test
- 375px (mobile): day pills horizontal scroll, no overflow, JumpBar scrolls, cards full-width
- 768px (tablet): cards still single-col for checklist (per design)
- 1280px (desktop): max-w-3xl centered, no broken layouts

### PWA test
- Open `/manifest.json` → still returns 200
- Service worker (if present) registers cleanly
- Install prompt still works (don't break `InstallPrompt.tsx` references)

### Real-time test (manual via 2 tabs not feasible via Playwright, smoke only)
- Verify socket connection in console logs

## Rollback Strategy

- Each section's rewrite is a separate diff
- If catastrophic issue: `git revert HEAD` (per-file) — sections are independent
- Mockup HTML stays in repo as visual reference

## Definition of Done

- [ ] All 4 sections updated per mockup
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Page loads at 375px and 1280px without overflow
- [ ] Click-through smoke test passes
- [ ] No new console errors
- [ ] PWA manifest still returns 200
- [ ] All commits pushed to dev
