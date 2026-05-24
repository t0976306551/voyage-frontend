# Delete Trip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓行程擁有者（Owner）可以永久刪除一趟行程，刪除時自動級聯清除所有關聯資料，並透過 WebSocket 即時通知所有在線成員。

**Architecture:** 後端以 TypeORM transaction 按依賴順序刪除所有關聯資料表的記錄，再刪除 Trip 本身。Controller 在 transaction 完成後對每位成員呼叫 `forceLeaveTrip` 踢出 socket 房間並觸發 `trip:deleted` 廣播。前端 TripSettingsDrawer 新增「危險區域」按鈕（isOwner 限定），mutation 成功後導向 `/trips`；其他成員的 TripDetailClient 監聽 `trip:deleted` 事件並彈 toast 後重導。

**Tech Stack:** TypeORM (transaction, manager.delete, createQueryBuilder), Express, Socket.io, React Query (useMutation), Next.js (useRouter), Playwright (E2E)

---

## File Map

| 動作 | 路徑 |
|------|------|
| Modify | `voyage-backend/src/modules/trips/trip.service.ts` |
| Modify | `voyage-backend/src/modules/trips/trip.controller.ts` |
| Modify | `voyage-backend/src/modules/trips/trip.router.ts` |
| Modify | `voyage-frontend/src/lib/api/trips.api.ts` |
| Modify | `voyage-frontend/src/app/(app)/trips/[id]/_components/TripSettingsDrawer.tsx` |
| Modify | `voyage-frontend/src/app/(app)/trips/[id]/TripDetailClient.tsx` |

---

## Task 1: Backend service — `deleteTrip()`

**Files:**
- Modify: `voyage-backend/src/modules/trips/trip.service.ts`

- [ ] **Step 1: 在 trip.service.ts 頂部加入缺少的 imports**

在現有 `import` 區塊中（第 1–17 行附近）追加兩個新 entity：

```typescript
import { Itinerary } from '../itinerary/itinerary.entity';
import { TripInvitation } from '../invitations/invitation.entity';
```

完整的 import 區塊範例（追加到第 17 行後面）：

```typescript
import { Itinerary } from '../itinerary/itinerary.entity';
import { TripInvitation } from '../invitations/invitation.entity';
```

- [ ] **Step 2: 在 TripService class 結尾（`}` 前）加入 `deleteTrip` 方法**

找到 `trip.service.ts` 最後一個 method（`_buildPreview`）的結束 `}`，在它後面、class 結束 `}` 前插入：

```typescript
  async deleteTrip(tripId: string): Promise<string[]> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');
    const memberIds = trip.members.map((m) => m.userId);

    await AppDataSource.transaction(async (manager) => {
      // 1. 刪除清單分配記錄（FK 依賴 checklist_items.id，必須先刪）
      await manager
        .createQueryBuilder()
        .delete()
        .from(ChecklistAssignment)
        .where(
          'item_id IN (SELECT id FROM checklist_items WHERE trip_id = :tripId)',
          { tripId },
        )
        .execute();

      // 2. 刪除清單項目
      await manager.delete(ChecklistItem, { tripId });

      // 3. 刪除費用（splitInfo 是 jsonb，無獨立子表）
      await manager.delete(Expense, { tripId });

      // 4. 刪除待辦
      await manager.delete(Task, { tripId });

      // 5. 刪除行程景點
      await manager.delete(Itinerary, { tripId });

      // 6. 刪除個人費用
      await manager.delete(PersonalExpense, { tripId });

      // 7. 刪除個人備忘 items（FK 依賴 personal_memos.id）
      const memos = await manager.find(PersonalMemo, { where: { tripId } });
      if (memos.length > 0) {
        await manager.delete(PersonalMemoItem, { memoId: In(memos.map((m) => m.id)) });
      }

      // 8. 刪除個人備忘
      await manager.delete(PersonalMemo, { tripId });

      // 9. 刪除邀請記錄
      await manager.delete(TripInvitation, { tripId });

      // 10. 刪除行程本體
      await manager.delete(Trip, { id: tripId });
    });

    return memberIds;
  }
```

- [ ] **Step 3: 手動驗證 imports 完整性**

確認 `trip.service.ts` 的 import 清單包含所有用到的 entity：
- `In` from `typeorm` ✓（已有）
- `AppDataSource` ✓（已有）
- `Trip` ✓（已有）
- `ChecklistAssignment` ✓（已有）
- `ChecklistItem` ✓（已有）
- `Expense` ✓（已有）
- `Task` ✓（已有）
- `PersonalMemo` ✓（已有）
- `PersonalMemoItem` ✓（已有）
- `PersonalExpense` ✓（已有）
- `Itinerary` ← 新加
- `TripInvitation` ← 新加（注意：entity class 名稱是 `TripInvitation`，非 `Invitation`）

- [ ] **Step 4: TypeScript 編譯確認**

```bash
cd voyage-backend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 無錯誤輸出（或只有既有的非相關警告）。

- [ ] **Step 5: Commit**

```bash
git add voyage-backend/src/modules/trips/trip.service.ts
git commit -m "feat(trips): add deleteTrip service method with cascade transaction"
```

---

## Task 2: Backend controller handler

**Files:**
- Modify: `voyage-backend/src/modules/trips/trip.controller.ts`

- [ ] **Step 1: 在 trip.controller.ts 加入 `deleteTrip` handler**

在 `joinByInviteCode` 之後（第 269 行後）加入：

```typescript
export async function deleteTrip(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const memberIds = await service.deleteTrip(tripId);
    // 先廣播 trip:deleted 讓在線成員即時得知
    broadcastToTrip(tripId, 'trip:deleted', { tripId });
    // 再踢出所有成員的 socket 房間（含 Owner 自己）
    for (const userId of memberIds) {
      forceLeaveTrip(userId, tripId);
    }
    res.json(ok({ ok: true }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
```

- [ ] **Step 2: TypeScript 編譯確認**

```bash
cd voyage-backend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 無錯誤。

- [ ] **Step 3: Commit**

```bash
git add voyage-backend/src/modules/trips/trip.controller.ts
git commit -m "feat(trips): add deleteTrip controller handler"
```

---

## Task 3: Backend router — `DELETE /:tripId`

**Files:**
- Modify: `voyage-backend/src/modules/trips/trip.router.ts`

- [ ] **Step 1: 更新 import，加入 `deleteTrip`**

找到 `trip.router.ts` 第 4–11 行的 controller import：

```typescript
import {
  getMyTrips, getTripById, createTrip, updateTrip, joinByInviteCode, patchModules,
  removeMember, getTripPreviewByCode, getTripPreviewById, joinByTripId, leaveTrip,
  patchCollaboratorPermissions, getLeavePreview,
} from './trip.controller';
```

替換為：

```typescript
import {
  getMyTrips, getTripById, createTrip, updateTrip, joinByInviteCode, patchModules,
  removeMember, getTripPreviewByCode, getTripPreviewById, joinByTripId, leaveTrip,
  patchCollaboratorPermissions, getLeavePreview, deleteTrip,
} from './trip.controller';
```

- [ ] **Step 2: 在 router 中加入 DELETE /:tripId 路由**

找到這一行（目前最後的 member 操作路由前後）：

```typescript
router.delete('/:tripId/members/me', requireTripRole('Owner', 'Editor', 'Viewer'), leaveTrip);
router.delete('/:tripId/members/:userId', requireTripRole('Owner'), removeMember);
```

在 `leaveTrip` 那行前面插入 deleteTrip 路由（必須在 `/:tripId/members/*` 之前，避免路由衝突）：

```typescript
router.delete('/:tripId', requireTripRole('Owner'), deleteTrip);
```

最終路由順序應為：

```typescript
router.delete('/:tripId', requireTripRole('Owner'), deleteTrip);
router.delete('/:tripId/members/me', requireTripRole('Owner', 'Editor', 'Viewer'), leaveTrip);
router.delete('/:tripId/members/:userId', requireTripRole('Owner'), removeMember);
```

- [ ] **Step 3: TypeScript 編譯確認**

```bash
cd voyage-backend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 無錯誤。

- [ ] **Step 4: 重啟後端，用 curl 驗證路由存在**

```bash
# 先取得有效 token（從瀏覽器 cookie 複製 authjs.session-token）
TOKEN="<paste-token-here>"
TRIP_ID="<any-existing-trip-id>"

# 以非 Owner 身份呼叫應得 403
curl -s -X DELETE http://localhost:4000/api/trips/$TRIP_ID \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{"error": {"code": "FORBIDDEN", ...}}` 或 `{"error": {"code": "NOT_FOUND", ...}}`（取決於 token 身份）。重點是 404 表示「路由找不到」的情況已消失。

- [ ] **Step 5: Commit**

```bash
git add voyage-backend/src/modules/trips/trip.router.ts
git commit -m "feat(trips): register DELETE /:tripId route for Owner"
```

---

## Task 4: Frontend API — `deleteTrip()`

**Files:**
- Modify: `voyage-frontend/src/lib/api/trips.api.ts`

- [ ] **Step 1: 在 trips.api.ts 的 `tripsApi` 物件中加入 `deleteTrip`**

找到 `tripsApi` 的最後一個方法（例如 `updateCollaboratorPermissions`），在它後面加入：

```typescript
  deleteTrip: (tripId: string, token: string) =>
    fetchWithAuth<{ ok: boolean }>(`/api/trips/${tripId}`, { method: 'DELETE' }, token),
```

- [ ] **Step 2: TypeScript 編譯確認**

```bash
cd voyage-frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 無錯誤。

- [ ] **Step 3: Commit**

```bash
git add voyage-frontend/src/lib/api/trips.api.ts
git commit -m "feat(trips): add deleteTrip API function"
```

---

## Task 5: Frontend UI — 刪除按鈕 in TripSettingsDrawer

**Files:**
- Modify: `voyage-frontend/src/app/(app)/trips/[id]/_components/TripSettingsDrawer.tsx`

- [ ] **Step 1: 加入 `Trash2` icon import**

在 `TripSettingsDrawer.tsx` 第 9 行的 lucide-react import 中加入 `Trash2`：

```typescript
import {
  X, Settings, CheckSquare, DollarSign, ListChecks, Users, Copy, Check, Link2,
  Calendar, Save, UserPlus, UserMinus, LogOut, Shield, Trash2,
} from 'lucide-react';
```

- [ ] **Step 2: 加入 `deleteMutation`**

在 `permMutation` 之後（第 239 行後）加入：

```typescript
  const deleteMutation = useMutation({
    mutationFn: () => tripsApi.deleteTrip(trip.id, token),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['trip', trip.id] });
      qc.invalidateQueries({ queryKey: ['trips'] });
      onClose();
      router.push('/trips');
      toast.show({ message: '行程已刪除', variant: 'success' });
    },
    onError: () => toast.show({ message: '刪除失敗，請稍後再試', variant: 'error' }),
  });
```

- [ ] **Step 3: 加入 `handleDeleteTrip` async function**

在 `copyText` function 之後加入：

```typescript
  async function handleDeleteTrip() {
    const confirmed = await confirm({
      title: `刪除「${trip.title}」？`,
      message: '此操作無法復原。行程的所有景點、費用、待辦、清單、個人備忘都將永久刪除，所有成員也會同時被移出。',
      confirmLabel: '確認刪除',
      cancelLabel: '取消',
      danger: true,
    });
    if (!confirmed) return;
    deleteMutation.mutate();
  }
```

- [ ] **Step 4: 在行程 tab 底部（isOwner 限定）加入危險區域 UI**

在 `activeTab === 'trip'` 的區塊末尾（即 `(isOwner || perms.canManageModules)` 區塊的閉合 `}` 之後，`</>` 之前）加入：

```tsx
              {/* ── 危險區域：刪除行程（Owner 限定）── */}
              {isOwner && (
                <section className="pt-2 border-t border-red-100">
                  <h3 className="text-sm font-semibold text-red-600 mb-1 inline-flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" />
                    危險區域
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    刪除後無法復原。所有行程資料（景點、費用、待辦、清單）將永久消失。
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTrip()}
                    disabled={deleteMutation.isPending}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleteMutation.isPending ? '刪除中…' : '刪除此行程'}
                  </button>
                </section>
              )}
```

- [ ] **Step 5: TypeScript 編譯確認**

```bash
cd voyage-frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add voyage-frontend/src/app/"(app)"/trips/"[id]"/_components/TripSettingsDrawer.tsx
git commit -m "feat(trips): add delete trip button in settings drawer (Owner only)"
```

---

## Task 6: Frontend socket — `trip:deleted` handler

**Files:**
- Modify: `voyage-frontend/src/app/(app)/trips/[id]/TripDetailClient.tsx`

- [ ] **Step 1: 在 socket.on('trip:kicked') 之前加入 trip:deleted handler**

找到 TripDetailClient.tsx 第 134–137 行：

```typescript
    socket.on('trip:kicked', ({ tripId }: { tripId: string }) => {
      if (tripId !== trip.id) return;
      router.push('/trips');
    });
```

在它之前插入：

```typescript
    socket.on('trip:deleted', ({ tripId: deletedId }: { tripId: string }) => {
      if (deletedId !== trip.id) return;
      qc.removeQueries({ queryKey: ['trip', trip.id] });
      qc.invalidateQueries({ queryKey: ['trips'] });
      router.push('/trips');
    });
```

說明：Owner 本身透過 mutation onSuccess 重導，這個 handler 主要服務非 Owner 成員（他們會同時收到 `trip:deleted` 和 `trip:kicked`，兩者都觸發重導，不影響正確性）。

- [ ] **Step 2: TypeScript 編譯確認**

```bash
cd voyage-frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 無錯誤。

- [ ] **Step 3: Commit**

```bash
git add voyage-frontend/src/app/"(app)"/trips/"[id]"/TripDetailClient.tsx
git commit -m "feat(trips): handle trip:deleted socket event for non-owner members"
```

---

## Task 7: 後端 API 邊界測試（curl）

前置條件：後端已重啟（`npm run dev` 在 voyage-backend），已準備好兩個測試帳號（Owner 和 Editor），並取得各自的 JWT token。

**取得 Token 方式：** 登入後，從瀏覽器 DevTools > Application > Cookies 複製 `authjs.session-token` 的值。

- [ ] **Step 1: 準備測試資料**

```bash
# 以 Owner 建立一個測試行程
OWNER_TOKEN="<owner-token>"
EDITOR_TOKEN="<editor-token>"
EDITOR_USER_ID="<editor-user-id>"

TRIP=$(curl -s -X POST http://localhost:4000/api/trips \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"刪除測試行程"}' | jq .)
TRIP_ID=$(echo $TRIP | jq -r '.data.id')
echo "TRIP_ID=$TRIP_ID"

# 讓 Editor 加入
curl -s -X POST "http://localhost:4000/api/trips/$TRIP_ID/join" \
  -H "Authorization: Bearer $EDITOR_TOKEN" | jq .
```

- [ ] **Step 2: 邊界測試 — 非成員無法刪除（應得 403）**

```bash
# 取一個完全沒加入此行程的 token
STRANGER_TOKEN="<stranger-token>"
curl -s -X DELETE "http://localhost:4000/api/trips/$TRIP_ID" \
  -H "Authorization: Bearer $STRANGER_TOKEN" | jq .
```

Expected:
```json
{"error": {"code": "FORBIDDEN", "message": "Access denied"}}
```

- [ ] **Step 3: 邊界測試 — Editor 無法刪除（應得 403）**

```bash
curl -s -X DELETE "http://localhost:4000/api/trips/$TRIP_ID" \
  -H "Authorization: Bearer $EDITOR_TOKEN" | jq .
```

Expected:
```json
{"error": {"code": "FORBIDDEN", "message": "Access denied"}}
```

- [ ] **Step 4: 邊界測試 — 無效 tripId（應得 404）**

```bash
curl -s -X DELETE "http://localhost:4000/api/trips/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $OWNER_TOKEN" | jq .
```

Expected:
```json
{"error": {"code": "NOT_FOUND", "message": "Trip not found"}}
```

- [ ] **Step 5: 核心測試 — Owner 刪除成功**

```bash
# 先在行程加一些資料以測試 cascade
# 加一個景點
curl -s -X POST "http://localhost:4000/api/trips/$TRIP_ID/itinerary" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"測試景點","day":1}' | jq .

# 加一個費用
curl -s -X POST "http://localhost:4000/api/trips/$TRIP_ID/expenses" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"currency":"TWD","description":"測試費用","splitInfo":{}}' | jq .

# 正式刪除
curl -s -X DELETE "http://localhost:4000/api/trips/$TRIP_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" | jq .
```

Expected:
```json
{"data": {"ok": true}, "error": null}
```

同時觀察後端 log 確認：
- 無 transaction error
- 無 500 錯誤
- 正常回應

- [ ] **Step 6: 邊界測試 — 重複刪除（應得 404）**

```bash
# 對同一個剛剛刪除的 tripId 再次呼叫
curl -s -X DELETE "http://localhost:4000/api/trips/$TRIP_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" | jq .
```

Expected:
```json
{"error": {"code": "NOT_FOUND", "message": "Trip not found"}}
```

- [ ] **Step 7: 驗證 DB 已清空（無殘留資料）**

```bash
# 確認行程已不存在
curl -s -X GET "http://localhost:4000/api/trips/$TRIP_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" | jq .
```

Expected: `{"error": {"code": "NOT_FOUND", ...}}`

- [ ] **Step 8: 確認 invitation_history 未受影響（不應被刪）**

```bash
# invitation_history 是 global inviter/invitee 關係，刪除行程不應影響它
# 只需確認後端 log 沒有 invitation_history delete 操作即可
# 觀察 Step 5 的 server log，不應看到 DELETE FROM invitation_history
```

---

## Task 8: 前端 E2E 測試（Playwright）

**前置條件：** 前後端都已啟動（前端 `localhost:3000`，後端 `localhost:4000`）。使用 Playwright（`mcp__playwright__*` 工具），不使用 Chrome 擴充套件。

- [ ] **Step 1: 建立測試行程**

```
1. 瀏覽 http://localhost:3000
2. 登入（若尚未登入）
3. 建立新行程「E2E 刪除測試」
4. 記錄 tripId（從 URL 取得）
```

- [ ] **Step 2: 驗證刪除按鈕出現（Owner 才可見）**

```
1. 開啟行程詳情頁 /trips/<tripId>
2. 點擊右上角齒輪圖示（Settings）
3. 確認「行程」tab 是選取狀態
4. 滾動到底部
5. 確認看到「刪除此行程」按鈕（帶紅色樣式）
6. 確認看到「危險區域」section 標題
```

同時觀察前後端 log 確認無錯誤。

- [ ] **Step 3: 驗證確認對話框出現**

```
1. 點擊「刪除此行程」按鈕
2. 確認彈出確認對話框
3. 對話框標題應含行程名稱「刪除「E2E 刪除測試」？」
4. 確認對話框有「確認刪除」和「取消」按鈕
5. 點擊「取消」
6. 確認對話框關閉，行程詳情頁仍正常顯示
```

- [ ] **Step 4: 核心 E2E — 刪除流程完整測試**

```
1. 再次點擊「刪除此行程」按鈕
2. 對話框出現後點「確認刪除」
3. 觀察前後端 log：
   - 後端應出現 DELETE /api/trips/<tripId> 200
   - 無 500 錯誤
4. 確認頁面重導至 /trips（行程列表頁）
5. 確認出現「行程已刪除」的 toast 通知
6. 確認已刪除的行程不再出現在行程列表中
```

- [ ] **Step 5: 邊界測試 — 行程列表頁無此行程（直接訪問已刪除的 URL）**

```
1. 直接訪問 /trips/<剛刪除的tripId>
2. 應顯示 404 頁面（Trip not found）或重導至 /trips
3. 確認不會出現 500 錯誤
```

同時觀察後端 log 確認 GET /trips/<tripId> 回傳 404。

- [ ] **Step 6: 邊界測試 — Editor 在其他成員刪除行程時的即時通知**

此測試需要兩個瀏覽器 session（或兩個標籤），一個 Owner，一個 Editor（已加入行程）：

```
方案 A（若有第二個測試帳號）：
1. 在另一個隱私視窗以 Editor 身份登入並開啟行程詳情頁
2. Owner 視窗執行刪除流程
3. 確認 Editor 視窗自動重導至 /trips

方案 B（若只有一個帳號，用 curl 模擬 Editor）：
1. 確認後端 log 在刪除時有呼叫 forceLeaveTrip（看到 socket 相關 log）
2. 確認 DELETE API 回應成功
3. 記錄「此測試需雙帳號環境，已跳過手動 E2E，改由 socket 邏輯 code review 確認」
```

- [ ] **Step 7: 觀察整體 log，確認無殘留錯誤**

```bash
# 檢查前端 dev.log 最後 50 行
Get-Content "C:\website\vibelog\voyage-frontend\dev.log" -Tail 50

# 確認後端 log 無未處理例外
```

Expected: 無 500 錯誤，無 TypeORM error，無 socket.io uncaught exception。

---

## Self-Review 清單

完成所有 Task 後，對照下列清單確認：

- [ ] `DELETE /api/trips/:tripId` 只有 Owner 可呼叫（`requireTripRole('Owner')`）
- [ ] Transaction 包含所有關聯表的刪除，無遺漏
- [ ] `checklist_assignments` 在 `checklist_items` 之前刪除（避免 FK 衝突）
- [ ] `personal_memo_items` 在 `personal_memos` 之前刪除（避免 FK 衝突）
- [ ] `invitation_history` **未被刪除**（它是 global 關係，不屬於行程）
- [ ] 後端在 transaction 完成後才廣播 `trip:deleted` 和 `forceLeaveTrip`
- [ ] 前端刪除按鈕只在 `isOwner === true` 時顯示
- [ ] `deleteMutation.onSuccess` 清除 React Query cache 並重導至 /trips
- [ ] `socket.on('trip:deleted', ...)` 讓非 Owner 成員也能即時被重導
- [ ] 全流程 curl + Playwright 測試通過，後端 log 無錯誤
