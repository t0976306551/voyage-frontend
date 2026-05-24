# Kick Member Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow trip Owners to remove (kick) any non-Owner member from the trip, both via backend API and a UI button in TripSettingsDrawer.

**Architecture:** Backend adds `DELETE /api/trips/:tripId/members/:userId` protected by `requireTripRole('Owner')`. Frontend adds `removeMember()` to trips.api.ts, then renders a kick button with inline confirmation in the member list (only for Owner, only on non-Owner rows).

**Tech Stack:** Express (backend), Next.js App Router + TanStack Query (frontend), TypeORM JSONB member array.

---

## File Map

| Action | Path | Change |
|--------|------|--------|
| Modify | `voyage-backend/src/modules/trips/trip.service.ts` | Add `removeMember()` |
| Modify | `voyage-backend/src/modules/trips/trip.controller.ts` | Add `removeMember()` handler |
| Modify | `voyage-backend/src/modules/trips/trip.router.ts` | Register `DELETE /:tripId/members/:userId` |
| Modify | `voyage-frontend/src/lib/api/trips.api.ts` | Add `removeMember()` |
| Modify | `voyage-frontend/src/app/(app)/trips/[id]/_components/TripSettingsDrawer.tsx` | Kick button + inline confirm |

---

### Task 1: Backend service — removeMember

**Files:**
- Modify: `voyage-backend/src/modules/trips/trip.service.ts`

- [ ] **Step 1: Add removeMember to TripService**

Add after `joinByInviteCode` method in the service class:

```typescript
async removeMember(tripId: string, targetUserId: string): Promise<Trip> {
  const trip = await this.repo.findById(tripId);
  if (!trip) throw new Error('NOT_FOUND');

  const target = trip.members.find((m) => m.userId === targetUserId);
  if (!target) throw new Error('NOT_MEMBER');
  if (target.role === 'Owner') throw new Error('CANNOT_KICK_OWNER');

  const updatedMembers = trip.members.filter((m) => m.userId !== targetUserId);
  return this.repo.update(tripId, { members: updatedMembers });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd C:\website\vibelog\voyage-backend && npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: Backend controller + router

**Files:**
- Modify: `voyage-backend/src/modules/trips/trip.controller.ts`
- Modify: `voyage-backend/src/modules/trips/trip.router.ts`

- [ ] **Step 1: Add removeMember controller**

Add to `trip.controller.ts` (after `joinByInviteCode`):

```typescript
export async function removeMember(req: Request, res: Response): Promise<void> {
  try {
    const { tripId, userId } = req.params as { tripId: string; userId: string };
    const trip = await service.removeMember(tripId, userId);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'NOT_MEMBER') res.status(404).json(fail('NOT_MEMBER', 'User is not a member'));
    else if (msg === 'CANNOT_KICK_OWNER') res.status(400).json(fail('CANNOT_KICK_OWNER', 'Cannot remove the trip owner'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
```

- [ ] **Step 2: Import removeMember in router and register route**

In `trip.router.ts`, add to the import line:
```typescript
import { getMyTrips, getTripById, createTrip, updateTrip, joinByInviteCode, patchModules, removeMember } from './trip.controller';
```

Add after `router.patch('/:tripId/modules', ...)`:
```typescript
router.delete('/:tripId/members/:userId', requireTripRole('Owner'), removeMember);
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd C:\website\vibelog\voyage-backend && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3: Frontend API client

**Files:**
- Modify: `voyage-frontend/src/lib/api/trips.api.ts`

- [ ] **Step 1: Add removeMember to tripsApi**

Add inside `export const tripsApi = { ... }` after `joinByInviteCode`:

```typescript
removeMember: (tripId: string, userId: string, token: string) =>
  fetchWithAuth<Trip>(`/api/trips/${tripId}/members/${userId}`, {
    method: 'DELETE',
  }, token),
```

---

### Task 4: Frontend UI — kick button in TripSettingsDrawer

**Files:**
- Modify: `voyage-frontend/src/app/(app)/trips/[id]/_components/TripSettingsDrawer.tsx`

- [ ] **Step 1: Add UserMinus import**

Change the lucide-react import line to add `UserMinus`:
```typescript
import {
  X, Settings, CheckSquare, DollarSign, ListChecks, Users, Copy, Check, Link2,
  Image as ImageIcon, Calendar, Save, UserPlus, UserMinus,
} from 'lucide-react';
```

- [ ] **Step 2: Add kickingId state**

Add after `const [inviting, setInviting] = useState(false);`:
```typescript
const [kickingId, setKickingId] = useState<string | null>(null);
```

- [ ] **Step 3: Add removeMember mutation**

Add after `coverMutation`:
```typescript
const kickMutation = useMutation({
  mutationFn: (userId: string) => tripsApi.removeMember(trip.id, userId, token),
  onSuccess: (updated) => {
    qc.setQueryData(['trip', trip.id], updated);
    qc.invalidateQueries({ queryKey: ['trips'] });
    setKickingId(null);
    toast.show({ message: '已移除成員', variant: 'success' });
  },
  onError: () => toast.show({ message: '移除失敗，請稍後再試', variant: 'error' }),
});
```

- [ ] **Step 4: Replace the member list `<li>` to add kick button**

Replace the entire members `<ul>` block (lines 433–461) with:

```tsx
<ul className="space-y-1.5">
  {trip.members.map((m) => {
    const isConfirming = kickingId === m.userId;
    const canKick = isOwner && m.role !== 'Owner';
    return (
      <li
        key={m.userId}
        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 border border-slate-200 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
          {(m.name || m.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {m.name || m.email?.split('@')[0] || m.userId.slice(0, 6)}
          </p>
          {m.email && (
            <p className="text-xs text-slate-500 truncate">{m.email}</p>
          )}
        </div>

        {isConfirming ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-500">確定移除？</span>
            <button
              type="button"
              onClick={() => kickMutation.mutate(m.userId)}
              disabled={kickMutation.isPending}
              className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {kickMutation.isPending ? '…' : '移除'}
            </button>
            <button
              type="button"
              onClick={() => setKickingId(null)}
              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              m.role === 'Owner'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : m.role === 'Editor'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-600'
            }`}>
              {m.role === 'Owner' ? '擁有者' : m.role === 'Editor' ? '編輯' : '檢視'}
            </span>
            {canKick && (
              <button
                type="button"
                onClick={() => setKickingId(m.userId)}
                aria-label={`移除 ${m.name || m.email}`}
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <UserMinus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </li>
    );
  })}
</ul>
```

---

### Task 5: Manual test

- [ ] **Step 1:** Open a trip as Owner → 行程設定 → 目前成員
  - Expected: non-Owner members show a `UserMinus` icon button; Owner row has no button

- [ ] **Step 2:** Click `UserMinus` on a member
  - Expected: row shows "確定移除？ [移除] [取消]" inline

- [ ] **Step 3:** Click 取消
  - Expected: row returns to normal view

- [ ] **Step 4:** Click 移除
  - Expected: member disappears from list, toast "已移除成員"

- [ ] **Step 5:** Try to kick Owner (should be impossible)
  - Expected: no button shown on Owner row

---

### Task 6: Commit

- [ ] **Step 1: Stage and commit backend**

```bash
cd C:\website\vibelog\voyage-backend
git add src/modules/trips/trip.service.ts src/modules/trips/trip.controller.ts src/modules/trips/trip.router.ts
git commit -m "feat: add DELETE /api/trips/:tripId/members/:userId to remove member (Owner only)"
```

- [ ] **Step 2: Stage and commit frontend**

```bash
cd C:\website\vibelog\voyage-frontend
git add src/lib/api/trips.api.ts src/app/\(app\)/trips/\[id\]/_components/TripSettingsDrawer.tsx
git commit -m "feat: add kick member UI in TripSettingsDrawer (Owner only, inline confirm)"
```
