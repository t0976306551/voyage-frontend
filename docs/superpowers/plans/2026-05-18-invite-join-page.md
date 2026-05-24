# Invite Join Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the missing `/trips/join?code=XXX` frontend page so users who click a share link are automatically joined to the trip and redirected to it.

**Architecture:** A Next.js server component at `src/app/(app)/trips/join/page.tsx` reads `code` from `searchParams`, calls the existing `tripsApi.joinByInviteCode()` API, then redirects to the trip on success or shows a styled error page on failure. The middleware already protects `/trips/*`, so unauthenticated users are redirected to `/` before reaching this page.

**Tech Stack:** Next.js 15 App Router (server components), `getServerToken()` for auth, `tripsApi.joinByInviteCode()` (already implemented), `redirect()` / `notFound()` from `next/navigation`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/app/(app)/trips/join/page.tsx` | Server component — join flow + redirect |
| **Create** | `src/app/(app)/trips/join/InvalidCode.tsx` | Client component — styled error UI |

---

### Task 1: Create the error UI component

**Files:**
- Create: `src/app/(app)/trips/join/InvalidCode.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/app/(app)/trips/join/InvalidCode.tsx
'use client';

import Link from 'next/link';
import { LinkIcon } from 'lucide-react';

export default function InvalidCode() {
  return (
    <main
      className="flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 px-4"
      style={{ minHeight: '100dvh' }}
    >
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-3xl bg-white shadow-lg shadow-indigo-500/20 flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="w-10 h-10 text-indigo-400" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">邀請連結無效</h1>
        <p className="text-sm text-slate-500 mb-8">
          這個邀請連結可能已過期，或者連結不正確，請向行程擁有者索取新的邀請連結。
        </p>
        <Link
          href="/trips"
          className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/25"
        >
          回到我的行程
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify file saved correctly**

```bash
cat src/app/\(app\)/trips/join/InvalidCode.tsx
```

Expected: file contents printed with no errors.

---

### Task 2: Create the join page (server component)

**Files:**
- Create: `src/app/(app)/trips/join/page.tsx`

- [ ] **Step 1: Create the server component**

```tsx
// src/app/(app)/trips/join/page.tsx
import { redirect } from 'next/navigation';
import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi } from '@/lib/api/trips.api';
import InvalidCode from './InvalidCode';

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const { code } = await searchParams;

  // No code in URL → nothing to join
  if (!code) redirect('/trips');

  const token = await getServerToken();
  // Middleware already protects /trips/* but be defensive
  if (!token) redirect('/');

  try {
    const trip = await tripsApi.joinByInviteCode(code.trim().toUpperCase(), token);
    redirect(`/trips/${trip.id}`);
  } catch {
    return <InvalidCode />;
  }
}
```

- [ ] **Step 2: Verify the file saved correctly**

```bash
cat src/app/\(app\)/trips/join/page.tsx
```

Expected: file contents printed with no errors.

---

### Task 3: Manual smoke test — happy path

> Prerequisites: dev server running (`npm run dev` in `voyage-frontend`), backend running, logged in as a user who owns at least one trip.

- [ ] **Step 1: Get a valid invite code**

Open the app → go to a trip → open 行程設定 → copy the 邀請碼 (e.g. `380ECCCEE863`).

- [ ] **Step 2: Visit the join URL as the trip owner**

Navigate to: `http://localhost:3000/trips/join?code=<YOUR_CODE>`

Expected: browser redirects immediately to `/trips/<id>` — the trip detail page loads normally.
(Owner is already a member — backend service returns the trip and the page still redirects correctly.)

- [ ] **Step 3: Visit the join URL with an invalid code**

Navigate to: `http://localhost:3000/trips/join?code=FAKECODE999`

Expected: page renders the "邀請連結無效" error UI with a "回到我的行程" button.

- [ ] **Step 4: Visit the join URL with no code**

Navigate to: `http://localhost:3000/trips/join`

Expected: browser redirects to `/trips`.

- [ ] **Step 5: Test as a second user (invite flow)**

If you have a second account:
1. Copy share link from trip owner's settings drawer
2. Log in as second user in a private/incognito window
3. Paste the share link into that window
4. Expected: page redirects to the trip detail page, and the second user appears in the member list

---

### Task 4: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/app/\(app\)/trips/join/page.tsx src/app/\(app\)/trips/join/InvalidCode.tsx
git commit -m "feat: add /trips/join page to handle invite link flow"
```

- [ ] **Step 2: Push to dev branch**

```bash
git push origin dev
```

---

## Edge Cases Covered

| Scenario | Behaviour |
|----------|-----------|
| No `code` query param | Redirect → `/trips` |
| No auth token (unauthenticated) | Redirect → `/` (middleware fires first) |
| Invalid / expired invite code | Render `InvalidCode` error page |
| Already a member | Backend returns trip, page redirects to trip ✅ |
| Valid code, not a member | Joined + redirected to trip ✅ |

## What Was Already Working (no changes needed)

- `tripsApi.joinByInviteCode()` — `src/lib/api/trips.api.ts:65-69`
- Backend `POST /api/trips/join` — `trip.router.ts:24` + `trip.controller.ts:86-101`
- Invite code generation — `trip.service.ts:8-10`
- Middleware route protection — `src/proxy.ts`
