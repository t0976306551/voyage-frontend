# Join Confirmation Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a non-member visits either `/trips/join?code=XXX` (invite link) or `/trips/:id` (direct trip URL), show a confirmation dialog with trip name, owner, and dates — letting them click 確定 to join or 取消 to decline.

**Architecture:** Two new backend endpoints — `GET /api/trips/preview?code=XXX` (by invite code) and `GET /api/trips/:tripId/preview` (by trip ID) — return public trip info without membership checks. The frontend's join page becomes a server-prefetch + client-confirm flow; the trip detail page catches FORBIDDEN and renders a join confirmation instead of 404.

**Tech Stack:** Express + TypeORM (backend), Next.js App Router server + client components, TanStack Query (frontend).

---

## File Map

| Action | Path | Change |
|--------|------|--------|
| Modify | `voyage-backend/src/modules/trips/trip.service.ts` | Add `getTripPreview()`, `joinByTripId()` |
| Modify | `voyage-backend/src/modules/trips/trip.controller.ts` | Add `getTripPreview`, `joinByTripId` handlers |
| Modify | `voyage-backend/src/modules/trips/trip.router.ts` | Register 3 new routes (before `/:tripId`) |
| Modify | `voyage-frontend/src/lib/api/trips.api.ts` | Add `TripPreview` type + `getTripPreviewByCode()`, `getTripPreviewById()`, `joinByTripId()` |
| Create | `voyage-frontend/src/app/(app)/trips/_components/JoinConfirmDialog.tsx` | Reusable client confirm UI (shared between both entry points) |
| Modify | `voyage-frontend/src/app/(app)/trips/join/page.tsx` | Server-fetch preview → pass to JoinConfirmDialog |
| Modify | `voyage-frontend/src/app/(app)/trips/[id]/page.tsx` | Catch FORBIDDEN → fetch preview → render JoinConfirmDialog |

---

## Data Shape

### TripPreview (backend response + frontend type)
```typescript
interface TripPreview {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  ownerName: string;
  memberCount: number;
}
```

---

### Task 1: Backend — getTripPreview + joinByTripId in service

**Files:**
- Modify: `voyage-backend/src/modules/trips/trip.service.ts`

- [ ] **Step 1: Add TripPreview interface and two service methods**

Add after the `HydratedTrip` interface (before the class):

```typescript
export interface TripPreview {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  ownerName: string;
  memberCount: number;
}
```

Add inside `TripService` class after `removeMember`:

```typescript
async getTripPreviewByCode(code: string): Promise<TripPreview> {
  const trip = await this.repo.findByInviteCode(code);
  if (!trip) throw new Error('NOT_FOUND');
  return this._buildPreview(trip);
}

async getTripPreviewById(tripId: string): Promise<TripPreview> {
  const trip = await this.repo.findById(tripId);
  if (!trip) throw new Error('NOT_FOUND');
  return this._buildPreview(trip);
}

async joinByTripId(tripId: string, userId: string): Promise<HydratedTrip> {
  const trip = await this.repo.findById(tripId);
  if (!trip) throw new Error('NOT_FOUND');

  const alreadyMember = trip.members.some((m) => m.userId === userId);
  if (alreadyMember) return hydrateMembers(trip);

  const updatedMembers = [...trip.members, { userId, role: 'Viewer' as const }];
  const updated = await this.repo.update(tripId, { members: updatedMembers });
  return hydrateMembers(updated);
}

private async _buildPreview(trip: Trip): Promise<TripPreview> {
  const ownerMember = trip.members.find((m) => m.role === 'Owner');
  let ownerName = '未知';
  if (ownerMember) {
    const users = await AppDataSource.getRepository(User).find({
      where: { id: ownerMember.userId },
      select: ['name', 'email'],
    });
    const owner = users[0];
    ownerName = owner?.name || owner?.email?.split('@')[0] || '未知';
  }
  return {
    id: trip.id,
    title: trip.title,
    startDate: trip.startDate ?? undefined,
    endDate: trip.endDate ?? undefined,
    ownerName,
    memberCount: trip.members.length,
  };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd C:\website\vibelog\voyage-backend && npx tsc --noEmit 2>&1 | grep -v "trip.router\|user.controller"
```

Expected: no new errors from trip.service.ts.

---

### Task 2: Backend — controllers + routes

**Files:**
- Modify: `voyage-backend/src/modules/trips/trip.controller.ts`
- Modify: `voyage-backend/src/modules/trips/trip.router.ts`

- [ ] **Step 1: Add three controller functions**

Add to `trip.controller.ts` after `removeMember`:

```typescript
export async function getTripPreviewByCode(req: Request, res: Response): Promise<void> {
  try {
    const code = typeof req.query['code'] === 'string' ? req.query['code'].trim().toUpperCase() : '';
    if (!code) { res.status(400).json(fail('BAD_REQUEST', 'code is required')); return; }
    const preview = await service.getTripPreviewByCode(code);
    res.json(ok(preview));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Invite code not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function getTripPreviewById(req: Request, res: Response): Promise<void> {
  try {
    const preview = await service.getTripPreviewById(req.params['tripId'] as string);
    res.json(ok(preview));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function joinByTripId(req: Request, res: Response): Promise<void> {
  try {
    const trip = await service.joinByTripId(req.params['tripId'] as string, req.user!.id);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
```

- [ ] **Step 2: Register routes in trip.router.ts**

Update the import line:
```typescript
import {
  getMyTrips, getTripById, createTrip, updateTrip, joinByInviteCode, patchModules,
  removeMember, getTripPreviewByCode, getTripPreviewById, joinByTripId,
} from './trip.controller';
```

Add BEFORE `router.get('/:tripId', getTripById)` (order matters — specific routes must precede `:tripId` wildcard):

```typescript
// Preview routes — no membership check, auth required
router.get('/preview', getTripPreviewByCode);               // GET /api/trips/preview?code=XXX
router.get('/:tripId/preview', getTripPreviewById);          // GET /api/trips/:tripId/preview
router.post('/:tripId/join', joinByTripId);                  // POST /api/trips/:tripId/join
```

---

### Task 3: Frontend API client

**Files:**
- Modify: `voyage-frontend/src/lib/api/trips.api.ts`

- [ ] **Step 1: Add TripPreview type and three API methods**

Add after the `Trip` interface:

```typescript
export interface TripPreview {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  ownerName: string;
  memberCount: number;
}
```

Add inside `export const tripsApi = { ... }` after `removeMember`:

```typescript
getTripPreviewByCode: (code: string, token: string) =>
  fetchWithAuth<TripPreview>(`/api/trips/preview?code=${encodeURIComponent(code)}`, {}, token),

getTripPreviewById: (tripId: string, token: string) =>
  fetchWithAuth<TripPreview>(`/api/trips/${tripId}/preview`, {}, token),

joinByTripId: (tripId: string, token: string) =>
  fetchWithAuth<Trip>(`/api/trips/${tripId}/join`, { method: 'POST' }, token),
```

---

### Task 4: JoinConfirmDialog — shared client component

**Files:**
- Create: `voyage-frontend/src/app/(app)/trips/_components/JoinConfirmDialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Users, Loader2, LogIn } from 'lucide-react';
import { tripsApi, TripPreview } from '@/lib/api/trips.api';

interface Props {
  preview: TripPreview;
  token: string;
  /** 'code' = joined via invite code, 'id' = joined via direct link */
  joinMode: 'code' | 'id';
  /** invite code (only when joinMode === 'code') */
  inviteCode?: string;
}

function formatDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function JoinConfirmDialog({ preview, token, joinMode, inviteCode }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      let trip;
      if (joinMode === 'code' && inviteCode) {
        trip = await tripsApi.joinByInviteCode(inviteCode, token);
      } else {
        trip = await tripsApi.joinByTripId(preview.id, token);
      }
      router.push(`/trips/${trip.id}`);
    } catch {
      setError('加入失敗，請稍後再試');
      setLoading(false);
    }
  }

  const startStr = formatDate(preview.startDate);
  const endStr = formatDate(preview.endDate);

  return (
    <main
      className="flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 px-4"
      style={{ minHeight: '100dvh' }}
    >
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-500/10 border border-slate-100 overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

          <div className="p-7">
            {/* Invitation label */}
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              <LogIn className="w-3.5 h-3.5" />
              你被邀請加入行程
            </div>

            {/* Trip name */}
            <h1 className="text-2xl font-bold text-slate-900 mb-1 leading-snug">
              {preview.title}
            </h1>
            <p className="text-sm text-slate-500 mb-5">
              由 <span className="font-semibold text-slate-700">{preview.ownerName}</span> 主辦
            </p>

            {/* Info pills */}
            <div className="space-y-2.5 mb-7">
              {(startStr || endStr) && (
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <span>
                    {startStr ?? '未設日期'}
                    {endStr && endStr !== startStr ? ` — ${endStr}` : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm text-slate-600">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <span>目前 {preview.memberCount} 位成員</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-slate-600">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span>加入後身份為「檢視」</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 加入中...</>
                ) : (
                  <><LogIn className="w-4 h-4" /> 確定加入</>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push('/trips')}
                disabled={loading}
                className="w-full px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                取消，回到我的行程
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
```

---

### Task 5: Modify /trips/join page — show confirm dialog

**Files:**
- Modify: `voyage-frontend/src/app/(app)/trips/join/page.tsx`

- [ ] **Step 1: Replace server page to fetch preview and show dialog**

```tsx
import { redirect } from 'next/navigation';
import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi } from '@/lib/api/trips.api';
import InvalidCode from './InvalidCode';
import JoinConfirmDialog from '../_components/JoinConfirmDialog';

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const { code } = await searchParams;

  if (!code) redirect('/trips');

  const token = await getServerToken();
  if (!token) redirect('/');

  // Check if already a member by trying to join first
  // (backend is idempotent — returns trip if already member)
  // Instead, fetch preview to show confirmation dialog
  let preview;
  try {
    preview = await tripsApi.getTripPreviewByCode(code.trim().toUpperCase(), token);
  } catch {
    return <InvalidCode />;
  }

  return (
    <JoinConfirmDialog
      preview={preview}
      token={token}
      joinMode="code"
      inviteCode={code.trim().toUpperCase()}
    />
  );
}
```

**Note:** If user is already a member, after confirming, `joinByInviteCode` returns the existing trip and redirects — works correctly.

---

### Task 6: Modify /trips/[id] page — handle FORBIDDEN with join confirm

**Files:**
- Modify: `voyage-frontend/src/app/(app)/trips/[id]/page.tsx`

- [ ] **Step 1: Update page to handle FORBIDDEN differently from NOT_FOUND**

```tsx
import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi } from '@/lib/api/trips.api';
import { itineraryApi, ItineraryItem } from '@/lib/api/itinerary.api';
import { tasksApi, Task } from '@/lib/api/tasks.api';
import { expensesApi, Expense } from '@/lib/api/expenses.api';
import { checklistsApi, ChecklistItem } from '@/lib/api/checklists.api';
import { notFound } from 'next/navigation';
import { auth } from '../../../../../auth';
import TripDetailClient from './TripDetailClient';
import JoinConfirmDialog from '../_components/JoinConfirmDialog';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: Props) {
  const { id } = await params;
  const token = await getServerToken();
  if (!token) notFound();

  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? '';

  // Try to fetch trip — distinguish between NOT_FOUND and FORBIDDEN
  let trip = null;
  let isForbidden = false;
  try {
    trip = await tripsApi.getTripById(id, token);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'Access denied') {
      isForbidden = true;
    }
  }

  // Non-member visited a valid trip link — show join confirmation
  if (isForbidden) {
    let preview = null;
    try {
      preview = await tripsApi.getTripPreviewById(id, token);
    } catch {
      notFound();
    }
    if (!preview) notFound();
    return (
      <JoinConfirmDialog
        preview={preview}
        token={token}
        joinMode="id"
      />
    );
  }

  if (!trip) notFound();

  const [itinerary, tasks, expenses, checklists] = await Promise.all([
    itineraryApi.getByTrip(id, token).catch((): ItineraryItem[] => []),
    tasksApi.getByTrip(id, token).catch((): Task[] => []),
    expensesApi.getByTrip(id, token).catch((): Expense[] => []),
    checklistsApi.list(id, token).catch((): ChecklistItem[] => []),
  ]);

  return (
    <TripDetailClient
      trip={trip}
      itinerary={itinerary}
      initialTasks={tasks}
      initialExpenses={expenses}
      initialChecklists={checklists}
      token={token}
      currentUserId={currentUserId}
    />
  );
}
```

---

### Task 7: Manual test

- [ ] **Test A — Invite code (new member)**
  1. Get invite code from 行程設定
  2. Open incognito → log in as different account
  3. Visit `http://localhost:3000/trips/join?code=XXXXX`
  4. Expected: shows "你被邀請加入行程" card with trip name, owner, dates
  5. Click 確定加入 → redirected to the trip → second user appears in member list

- [ ] **Test B — Direct trip URL (non-member)**
  1. Copy trip page URL `/trips/:id`
  2. Open incognito → log in as different account
  3. Paste the URL
  4. Expected: shows the same join confirmation dialog
  5. Click 確定加入 → redirected to trip

- [ ] **Test C — Already a member**
  1. Visit invite link as existing member
  2. Expected: shows confirmation dialog (not auto-joined)
  3. Click 確定加入 → `joinByInviteCode` returns existing trip → redirected normally

- [ ] **Test D — Invalid code**
  1. Visit `/trips/join?code=FAKECODE`
  2. Expected: "邀請連結無效" error page

- [ ] **Test E — Cancel**
  1. Visit any invite link → see dialog
  2. Click 取消 → redirected to `/trips`

---

### Task 8: Commit

- [ ] **Backend commit**
```bash
cd C:\website\vibelog\voyage-backend
git add src/modules/trips/trip.service.ts src/modules/trips/trip.controller.ts src/modules/trips/trip.router.ts
git commit -m "feat: add trip preview endpoints and join-by-id endpoint"
```

- [ ] **Frontend commit**
```bash
cd C:\website\vibelog\voyage-frontend
git add src/lib/api/trips.api.ts "src/app/(app)/trips/_components/JoinConfirmDialog.tsx" "src/app/(app)/trips/join/page.tsx" "src/app/(app)/trips/[id]/page.tsx"
git commit -m "feat: show join confirmation dialog for invite links and direct trip URLs"
```
