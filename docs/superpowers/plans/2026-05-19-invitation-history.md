# 邀請歷史協作者 / 歷史邀請人 — 實作計畫

**日期**: 2026-05-19
**狀態**: 規劃中（尚未實作）
**範圍**: voyage-backend + voyage-frontend
**前置 PR**: 2026-05-18-kick-member, 2026-05-19-trip-detail-v2

---

## 1. 資料模型決策

### 方案比較

| 方案 | 優點 | 缺點 |
|------|------|------|
| A. 新增 `invitation_history` 表（推薦） | 軟隱藏單純（單一 `hidden_at`）；查詢 O(1)；可獨立加欄位（顯示名稱快照、最後使用時間）；不耦合 `trip_invitations` 生命週期 | 多一張表，需在邀請事件同步寫入 |
| B. 從現有 `trip_invitations` aggregate | 不加表 | `trip_invitations` 在 accepted / declined 後仍存在但語意混亂；軟隱藏需在 invitations 表加 `hidden_by_inviter_at`，跨多 row（同一 invitee 多個 trip）；查詢需 DISTINCT + JOIN，較慢 |
| C. 混合：history 表只存「被軟隱藏」紀錄，預設從 invitations aggregate | 沒明顯好處 | 兩來源合併邏輯複雜，UI 易出 bug |

**推薦：方案 A**。理由：(1) 隱藏狀態語意乾淨；(2) 未來可擴充「最後互動時間」「邀請次數」等；(3) 寫入點少（只在 handle 邀請成功處 upsert）；(4) `trip_invitations` 不被汙染。

### Schema

```sql
CREATE TABLE invitation_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invite_count    INTEGER NOT NULL DEFAULT 1,
  hidden_at       TIMESTAMPTZ NULL,
  UNIQUE (inviter_user_id, invitee_user_id)
);
CREATE INDEX idx_invitation_history_inviter ON invitation_history (inviter_user_id) WHERE hidden_at IS NULL;
```

- `ON DELETE CASCADE`：使用者刪帳號連帶清掉雙向歷史，避免顯示 ghost。
- `UNIQUE(inviter,invitee)`：保證 upsert 一致；同人重複邀請只更新 `last_invited_at` + `invite_count++`。
- partial index：歷史列表查詢只看未隱藏，常用 query 快速命中。

---

## 2. Migration

**檔案**：`voyage-backend/src/migrations/1779408000000-InvitationHistory.ts`

```ts
import { MigrationInterface, QueryRunner } from "typeorm";
export class InvitationHistory1779408000000 implements MigrationInterface {
    name = 'InvitationHistory1779408000000'
    public async up(q: QueryRunner): Promise<void> {
        await q.query(`CREATE TABLE "invitation_history" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "inviter_user_id" uuid NOT NULL,
          "invitee_user_id" uuid NOT NULL,
          "first_invited_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "last_invited_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
          "invite_count" integer NOT NULL DEFAULT 1,
          "hidden_at" TIMESTAMPTZ,
          CONSTRAINT "uq_invitation_history" UNIQUE ("inviter_user_id","invitee_user_id"),
          CONSTRAINT "fk_ih_inviter" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          CONSTRAINT "fk_ih_invitee" FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON DELETE CASCADE
        )`);
        await q.query(`CREATE INDEX "idx_ih_inviter_visible" ON "invitation_history"("inviter_user_id") WHERE "hidden_at" IS NULL`);
    }
    public async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP INDEX "idx_ih_inviter_visible"`);
        await q.query(`DROP TABLE "invitation_history"`);
    }
}
```

**Backfill（可選）**：一次性從現有 `trip_invitations` 灌入歷史：
```sql
INSERT INTO invitation_history (inviter_user_id, invitee_user_id, first_invited_at, last_invited_at, invite_count)
SELECT invited_by_user_id, invited_user_id, MIN(created_at), MAX(created_at), COUNT(*)
FROM trip_invitations
GROUP BY invited_by_user_id, invited_user_id
ON CONFLICT DO NOTHING;
```
建議寫在同一 migration 的 up() 末段。

---

## 3. 後端 API 設計

### 新增 endpoints

| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET | `/api/users/me/invitation-history?excludeTripId=:id` | 取我邀請過的人（已扣除：軟隱藏 / 已是該 trip 成員 / 該 trip 有 pending 邀請） | authed; caller-only |
| POST | `/api/users/me/invitation-history/:userId/hide` | 軟隱藏（設 `hidden_at = now()`） | authed; caller-only |
| POST | `/api/trips/:tripId/invitations/batch` | 一次邀請多人 | Owner，或 Editor + canInvite |

### 修改 endpoints

| Method | Path | 修改 |
|--------|------|------|
| POST `/api/trips/:tripId/invitations` | 邀請成功後 upsert `invitation_history` |
| DELETE `/api/trips/:tripId/invitations/:userId` | 已支援；前端「取消邀請」直接複用 |
| GET `/api/trips/:tripId/invitations` | 已支援；用於「尚未加入」分段 |

### Request/Response

**GET invitation-history**
```
Query: excludeTripId?: string
Response 200:
[{ userId, name, handle, avatar, lastInvitedAt, inviteCount }]
```

**POST hide**
```
Path: /api/users/me/invitation-history/:userId/hide
Response 200: { ok: true }
Errors: 404 NOT_FOUND
```

**POST batch invite**
```
Body: { userIds: string[] }   // 上限 20
Response 200: { invited: [{ userId, name, handle }], skipped: [{ userId, reason: 'ALREADY_MEMBER' | 'ALREADY_INVITED' | 'NOT_FOUND' }] }
Errors: 400 BAD_REQUEST (空陣列 / >20), 403 FORBIDDEN, 404 NOT_FOUND
```

---

## 4. 後端寫入點

**唯一寫入點：handle 邀請成功處**
- `voyage-backend/src/modules/trips/trip.router.ts` 的 `POST /:tripId/invitations`：在 `invitationRepo.create(...)` 成功後呼叫 `invitationHistoryRepo.upsert(invitedByUserId, invitedUserId)`。
- 新增 `batch invite` controller 同樣每筆成功後 upsert。

**不寫入的情境（需在文件明示）**
- 連結邀請（`POST /trips/join` 經 `joinByInviteCode`）：請求只有「邀請碼 + 接受者」，**沒有原始 inviter**，無法追蹤。
- 直接 join by tripId（`POST /:tripId/join`）：同上。

**新檔案**
- `modules/invitation-history/invitation-history.entity.ts`
- `modules/invitation-history/invitation-history.repository.ts`（含 `upsert`、`listForInviter(excludeUserIds)`、`hide(inviter, invitee)`）
- `modules/invitation-history/invitation-history.controller.ts`
- Mount 於 `userRouter` (附加路由) 與 `trip.router.ts`（batch endpoint）。

---

## 5. 前端 — TripSettingsDrawer 修改

**檔案**：`voyage-frontend/src/app/(app)/trips/[id]/_components/TripSettingsDrawer.tsx`

### 5.1 「邀請歷史協辦者」區塊（放在「以 Handle 邀請」**上方**，Owner only）
- 標題：`<UserPlus />` + 「邀請歷史協辦者」+ 計數徽章
- 列表：每列 checkbox + 頭像 + 名稱 + handle + 「上次：N 天前」灰字
- 底部黏底列：`已選 N 人` + 主按鈕 `邀請選取的 N 人`（disabled when 0）
- 空狀態：「還沒邀請過任何人；輸入下方 Handle 開始邀請。」
- Loading skeleton：3 列灰塊
- 資料來源：`useQuery(['invitation-history', trip.id], () => userApi.getInvitationHistory({ excludeTripId: trip.id }, token))`
- batch invite 成功後 → `qc.invalidateQueries(['invitation-history'])` + `qc.invalidateQueries(['pending-invitees', trip.id])` + toast `已邀請 N 人`（若 skipped 非空也提示）

### 5.2 「目前成員」拆兩段
- **目前成員**（現有實作不動，但 header 文字改成 `已加入 · ${members.length}`）
- **尚未加入**（新區塊，現有 `pendingInvitees` 邏輯抽出）
  - header：`尚未加入 · ${pendingInvitees.length}`
  - 每列：頭像 + 名稱 + handle + 「邀請於 X 天前」+ 「取消邀請」按鈕（紅色文字 link）
  - 取消 → confirm dialog → `userApi.cancelInvitation` → 從 state 移除
- 把 `pendingInvitees` 從 `useState` 改成 `useQuery(['pending-invitees', trip.id])`，避免 manual sync bug

### React Query keys
- `['invitation-history', tripId]`（用 tripId 因為要 excludeTripId）
- `['pending-invitees', tripId]`
- `['trip', tripId]`（現有）

### 工具：`formatRelativeDays(date)` → 「3 天前 / 剛剛 / 1 週前」，新增 helper `voyage-frontend/src/lib/utils/relative-time.ts`（若無）。

---

## 6. 前端 — 個人頁修改

**檔案**：`voyage-frontend/src/app/(app)/profile/ProfileClient.tsx`

### 「歷史邀請人」區塊
- 位置：放在「行程邀請」section **下方**
- 容器：白卡片 + `border-slate-100` + `shadow-sm`（與其他卡片一致）
- header：`<Users />` + 「我邀請過的人」+ 計數徽章
- 列表 row：頭像 + 名稱 + handle + 「上次邀請：N 天前」+ 右側「移除」按鈕（紅 ghost）
- 點「移除」→ `useConfirm({ title: '從歷史中移除？', message: '下次在行程設定不會再看到此人，但已建立的邀請不受影響。', danger: true })` → `userApi.hideInvitationHistory(userId, token)` → optimistic update
- 空狀態：「你還沒邀請過任何人」
- 不需 `excludeTripId`，呼叫 `getInvitationHistory({})`

### API helper 補強（`voyage-frontend/src/lib/api/user.api.ts`）
新增：
- `interface InvitationHistoryEntry { userId; name; handle; avatar; lastInvitedAt; inviteCount }`
- `getInvitationHistory(opts: { excludeTripId?: string }, token)`
- `hideInvitationHistory(userId, token)`
- `batchInviteByUserIds(tripId, userIds[], token)`

---

## 7. 邊界情況

1. **已是該 trip 成員** → 後端 `listForInviter` 內 `WHERE invitee_user_id NOT IN (SELECT userId FROM trip_members WHERE tripId = :exclude)`，UI 不顯示。
2. **已有 pending invitation** → 同上條件，多 join `trip_invitations status='pending'` 排除。
3. **自己邀請自己** → handle 邀請端已隱含（用戶不會搜到自己 handle），但保險：upsert 前 `if (inviter === invitee) return;`。
4. **batch invite 全部失敗** → 200 OK，response `invited: []`, `skipped: [...]`，前端 toast `沒有成功邀請任何人`。
5. **對方刪除帳號** → FK `ON DELETE CASCADE`，歷史自動清除，不會出現 ghost row。
6. **同一人重複邀請（取消後再邀）** → upsert 邏輯：`invite_count++`、`last_invited_at = now()`，不會新增 row。
7. **大量邀請** → batch 上限 20。Future：rate limit `30 invites/hour/user`（暫不實作，記在 follow-up）。
8. **連結邀請後再 handle 邀請** → handle 邀請才會寫入；連結加入的人**不會**出現在歷史。文件 README 須註明此限制。
9. **Owner kick 一個成員後** → 該成員仍在歷史（合理：Owner 主動邀請過 → 想再邀請可直接勾選）。
10. **軟隱藏後重新邀請（直接打 handle）** → 後端 upsert 時 `hidden_at = NULL`（取消隱藏）。

---

## 8. 隱私 / 安全

- 所有 `GET/POST /me/invitation-history*` endpoint 只用 `req.user!.id` 作為 inviter 條件，**永遠不接受 query 指定 inviterId**，避免列舉他人歷史。
- `POST .../hide`：repo 層 `WHERE inviter_user_id = :caller AND invitee_user_id = :target`，找不到回 404，不洩漏存在性。
- **軟隱藏 vs 硬刪**：選軟隱藏。理由：(a) 重新邀請可恢復；(b) `invite_count` 統計連續性；(c) 未來可加「顯示已隱藏」管理 UI。
- 不在 response 暴露 invitee 的 email（只給 name + handle + avatar），與現有 `getPendingInvitees` 一致。
- `excludeTripId` 必須驗證 caller 對該 trip 有讀取權（已透過 `authMiddleware` 取 userId + 後端 join trip_members；惡意傳他人 tripId 會自動扣到 0 個人，不洩漏資料）。

---

## 9. 開發步驟順序

1. **Backend migration + entity**（small）
   - 寫 migration、entity、repo `upsert/list/hide`
2. **Backend controller + router**（medium）
   - 建立 `invitation-history.controller.ts`
   - 在 `user.controller.ts` 掛新 GET / hide route
   - 在 `trip.router.ts` 加 batch invite endpoint
   - 在現有 `POST /:tripId/invitations` 寫入歷史
3. **Backend 手動測試**（curl）
   ```bash
   curl -H "Authorization: Bearer $T" $API/api/users/me/invitation-history
   curl -X POST -H "Authorization: Bearer $T" -d '{"userIds":["..."]}' $API/api/trips/$TID/invitations/batch
   curl -X POST -H "Authorization: Bearer $T" $API/api/users/me/invitation-history/$UID/hide
   ```
4. **Frontend API helpers**（small）— 補 `user.api.ts`
5. **Frontend TripSettingsDrawer**（large）
   - 抽 `pendingInvitees` → useQuery
   - 加「邀請歷史協辦者」section + batch select 邏輯
   - 「目前成員」拆兩段
   - 加 `formatRelativeDays` helper
6. **Frontend ProfileClient**（medium）
   - 加「歷史邀請人」section + confirm dialog + optimistic update
7. **E2E checklist**
   - [ ] 375px 與 desktop 兩寬度檢查（per UI QA checklist）
   - [ ] Owner 邀請 A → Profile 出現 A → Owner 在另一 trip 看到歷史含 A
   - [ ] Batch invite 3 人 → trip 內「尚未加入」顯示 3 人 → A 接受 → 自動消失於歷史 excludeTrip 查詢
   - [ ] Profile 移除 A → 對話框確認 → 列表消失 → trip 內歷史不再含 A
   - [ ] 取消 pending invitation → A 個人頁待加入消失
   - [ ] 連結邀請的人**不**出現在歷史（驗證限制）
   - [ ] Dialog scroll-lock 正常

---

## 10. 預估與風險

| 項目 | 規模 | 備註 |
|------|------|------|
| Backend migration + entity | S | 一張表 |
| Backend repo + endpoints | M | 4 個 endpoint，1 個 upsert |
| Backend wiring | S | 1 處寫入點 |
| Frontend API | S | 3 個 helper |
| Frontend TripSettingsDrawer | L | UI 重構 + useQuery 遷移 |
| Frontend ProfileClient | M | 1 個新 section + dialog |
| **總計** | **M-L** | ~2-3 個工作天 |

### 主要風險

1. **隱私洩漏（高）**：`GET /me/invitation-history` 若任何條件忘加 `inviter_user_id = caller`，會列出他人歷史 → 嚴格 code review + 寫單元測試強制 inviter scope。
2. **`pendingInvitees` 重構破壞既有功能（中）**：目前用 `useState` 手動同步，改 useQuery 後若忘記 invalidate 會看到陳舊資料 → 列出所有寫入 pending 的點（invite、cancel、batch、accept 通知），全部加 invalidateQueries。
3. **連結邀請限制 UX 困惑（低-中）**：使用者可能困惑「為什麼某個朋友沒出現」→ 在「歷史協辦者」section 加 tooltip 或 footer：「只記錄以 Handle 直接邀請的人；透過分享連結加入的不會記錄」。
4. **Migration backfill 風險（低）**：若 prod 已有 trip_invitations，backfill `ON CONFLICT DO NOTHING` 是安全的，但建議 migration 上線前在 staging 跑一次驗證 count。

---

**完。下一個工程師可從第 9 節步驟 1 開始。**
