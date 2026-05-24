# Google OAuth Auto-Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 Google OAuth 登入時自動比對後端 User 表，以 email 為鍵做 upsert，並把後端 UUID 寫進 NextAuth token.sub，解決 Google 使用者在後端找不到 User 記錄、名字顯示 "Unknown" 的問題。

**Architecture:** 前端 `auth.config.ts` 的 `jwt` callback 在 Google 首次登入時（`account?.provider === 'google'`）呼叫後端新 endpoint `POST /api/auth/google-upsert`，後端做「先查 googleId → 再查 email → 最後新建」的三段式 upsert，並回傳後端 UUID，前端以此取代 token.sub。Endpoint 用 `X-Internal-Token` shared secret（timingSafeEqual 比對）防止公開呼叫。Server-to-server 呼叫使用 `API_URL`（非 NEXT_PUBLIC）。

**Tech Stack:** TypeORM + Express（後端）、NextAuth v5 beta + Next.js 15 App Router（前端）、PostgreSQL

---

## 涉及檔案總覽

### 後端（`C:\website\vibelog\voyage-backend`）
| 動作 | 路徑 |
|------|------|
| 修改 | `src/modules/users/user.repository.ts` |
| 修改 | `src/modules/auth/auth.service.ts` |
| 修改 | `src/modules/auth/auth.controller.ts` |
| 修改 | `src/modules/auth/auth.router.ts` |
| 修改 | `.env` |

### 前端（`C:\website\vibelog\voyage-frontend`）
| 動作 | 路徑 |
|------|------|
| 修改 | `auth.config.ts` |
| 修改 | `.env.local` |

> **不需要 Migration**：`google_id`、`avatar`、`auth_providers`、`password_hash`（nullable）欄位均已在 `InitSchema` migration 中定義。

---

## 安全設計要點（含審查結果）

| 問題 | 解法 | 來源 |
|------|------|------|
| Timing attack on shared secret | `timingSafeEqual` 比對，長度不同時走 dummy compare branch | 初版 |
| Race condition（並發 upsert 同 email） | `create()` 失敗時 catch `QueryFailedError.code === '23505'`，重試 `findByEmail`；retry 後若仍 null 則 re-throw | 審查 C2、C3 |
| `profile.sub` 可能為 undefined | jwt callback 加 `profile?.sub` guard，sub 缺失時不呼叫 upsert | 審查 C4 |
| 多值 header 陣列 | `Array.isArray(rawToken) ? rawToken[0] : rawToken` 收窄型別 | 初版 |
| 降級模式缺乏可見性 | jwt callback catch 加 `console.error`，非 200 也 log | 初版 |
| NEXT_PUBLIC URL 暴露後端位址 | server-side call 改用 `API_URL`（無 NEXT_PUBLIC 前綴） | 初版 |
| name/avatar 無長度限制 | controller 截斷 name ≤ 100；avatar 需以 `https://` 開頭才存，否則存 null，上限 500 | 審查 M1 |
| authProviders 去重 | 用 `Set` 確保無重複值，normalize 後存回 | 審查 M2 |

**設計前提（email-based 合併的固有假設）：**
Gmail 地址是唯一的，Google 不允許兩個帳號共用同一個 `@gmail.com` 地址。「同 email 的 credentials 帳號 + Google 帳號」在現實中代表同一個人，這是 Slack、Linear、Vercel 等採用的業界標準做法。若部署環境需支援自訂網域（Workspace）用戶，應在後續版本加入 email ownership 驗證流程。

---

## 邊界條件完整清單

| # | 情境 | 預期行為 |
|---|------|---------|
| B1 | 全新 Google 使用者（email 和 googleId 都沒出現過） | 建立新 User，`passwordHash=null`，`authProviders=['google']`，`emailVerified=true` |
| B2 | 已有 credentials 帳號，用同 email Google 登入 | 合併：寫入 `googleId`，`authProviders` 加入 `'google'`（Set 去重），**不動** `passwordHash` |
| B3 | 已合併帳號，再次 Google 登入（googleId 已在 DB） | 直接查到，更新 name/avatar，不重複建立 |
| B4 | 已合併帳號，用原 email+密碼登入 | credentials 登入仍可用，`hasPassword` 仍為 true |
| B5 | 請求缺少 `googleId` 或 `email` | 回傳 422 VALIDATION_ERROR |
| B6 | `X-Internal-Token` 錯誤或缺少 | 回傳 401 UNAUTHORIZED（timingSafeEqual） |
| B7 | 後端 upsert endpoint 不可用（網路錯誤） | jwt callback catch 住錯誤並 console.error，Google 登入降級（token.sub 仍為 Google sub），不阻斷登入 |
| B8 | 兩個 Google session 同時 upsert 同 email（race condition） | create() catch `QueryFailedError.code===23505`，重試 findByEmail；若仍 null 則 re-throw |
| B9 | Google 使用者 `name` 為 null（罕見） | fallback 用 email 的 `@` 前半段 |
| B10 | Google 使用者 `avatar` 為 null | avatar 存 null，不影響功能 |
| B11 | 合併後 `hydrateMembers` 查詢 | 因 token.sub 已是後端 UUID，查詢正常，名字顯示正確 |
| B12 | 純 Google 使用者（無密碼），個人頁修改密碼按鈕 | `hasPassword=false`，修改密碼 UI 隱藏，不顯示 |
| B13 | `X-Internal-Token` 為陣列（多值 header） | 取 `[0]` 元素比對，其餘忽略 |
| B14 | name 超長字串 | controller 截斷 100 字元後存入 |
| B14b | avatar 非 https URL 或超長 | 非 `https://` 開頭存 null；超過 500 字元截斷 |
| B15 | 降級模式下使用者建立行程 | trip.members[].userId = Google sub，hydrateMembers 找不到 → 名字顯示 Unknown。**可接受的降級行為**，使用者重新登入後可恢復正常 |
| B16 | `profile.sub` 為 undefined（NextAuth/Google 異常） | jwt callback guard 攔截，不呼叫 upsert，token.sub 維持 Google 原值，console.error 記錄 |

---

## Task 1：後端 — UserRepository 加 `findByGoogleId`

**Files:**
- Modify: `src/modules/users/user.repository.ts`

- [ ] **Step 1: 修改 UserRepository**

將 `src/modules/users/user.repository.ts` 改為：

```typescript
import { AppDataSource } from '../../data-source';
import { User } from './user.entity';

export class UserRepository {
  private get repo() {
    return AppDataSource.getRepository(User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByHandle(handle: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.handle) = LOWER(:handle)', { handle })
      .getOne();
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.repo.findOne({ where: { googleId } });
  }

  async create(data: Partial<User>): Promise<User> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }
}
```

- [ ] **Step 2: TypeScript 確認**

```bash
cd C:\website\vibelog\voyage-backend
npx tsc --noEmit
```

預期：無任何錯誤輸出

- [ ] **Step 3: Commit**

```bash
git add src/modules/users/user.repository.ts
git commit -m "feat(auth): add findByGoogleId to UserRepository"
```

---

## Task 2：後端 — AuthService 加 `googleUpsert`

**Files:**
- Modify: `src/modules/auth/auth.service.ts`

- [ ] **Step 1: 將 `googleUpsert` 加入 AuthService**

將 `src/modules/auth/auth.service.ts` 改為：

```typescript
import bcrypt from 'bcryptjs';
import { QueryFailedError } from 'typeorm';
import { UserRepository } from '../users/user.repository';
import { signJWT } from '../../shared/utils/sign-jwt.utils';

const DUMMY_HASH = bcrypt.hashSync('dummy-never-used', 12);

interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string };
}

interface OAuthUpsertResult {
  id: string;
  email: string;
  name: string;
}

export class AuthService {
  constructor(private repo: UserRepository) {}

  async register(email: string, password: string, name: string): Promise<AuthResult> {
    const existing = await this.repo.findByEmail(email);
    if (existing) throw new Error('EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(password, 12);

    let handle: string;
    do {
      handle = this.generateHandle();
    } while (await this.repo.findByHandle(handle));

    const user = await this.repo.create({
      email,
      name,
      handle,
      passwordHash,
      emailVerified: false,
      authProviders: ['credentials'],
    });

    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) throw new Error('MISSING_SECRET');
    const token = signJWT({ sub: user.id, email: user.email, name: user.name }, secret);
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.repo.findByEmail(email);

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!user.passwordHash) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new Error('EMAIL_GOOGLE_ONLY');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('INVALID_CREDENTIALS');

    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) throw new Error('MISSING_SECRET');
    const token = signJWT({ sub: user.id, email: user.email, name: user.name }, secret);
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }

  /**
   * 三段式 Google OAuth upsert：
   * 1. 先查 googleId（已合併帳號直接返回）
   * 2. 再查 email（既有 credentials 帳號 → 合併）
   * 3. 都找不到 → 建立全新 Google 帳號
   *
   * Race condition（並發兩個 Google session）：
   * - create() 觸發 PG 23505（email UNIQUE violation）
   * - 用 QueryFailedError.driverError.code 判斷（比 e.message 可靠，升版不破壞）
   * - catch 後重試 findByEmail；仍 null 則 re-throw 避免靜默吞掉其他錯誤
   *
   * authProviders 用 Set 去重：防止 DB 中出現 ['google','google'] 的情況
   */
  async googleUpsert(
    googleId: string,
    email: string,
    name?: string,
    avatar?: string,
  ): Promise<OAuthUpsertResult> {
    // Step 1: 已綁定 googleId 的帳號 → 更新 name/avatar 後返回
    let user = await this.repo.findByGoogleId(googleId);
    if (user) {
      await this.repo.update(user.id, {
        name: name ?? user.name,
        avatar: avatar ?? user.avatar,
      });
      return { id: user.id, email: user.email, name: name ?? user.name };
    }

    // Step 2: 同 email 的 credentials 帳號 → 合併（Set 去重 authProviders）
    user = await this.repo.findByEmail(email);
    if (user) {
      const providers = new Set(user.authProviders);
      providers.add('google');
      const updated = await this.repo.update(user.id, {
        googleId,
        authProviders: Array.from(providers),
        avatar: user.avatar ?? avatar ?? null,
        emailVerified: true,
      });
      return { id: updated.id, email: updated.email, name: updated.name };
    }

    // Step 3: 全新 Google 使用者
    let handle: string;
    do {
      handle = this.generateHandle();
    } while (await this.repo.findByHandle(handle));

    try {
      const newUser = await this.repo.create({
        email,
        name: name ?? email.split('@')[0],
        googleId,
        avatar: avatar ?? null,
        handle,
        emailVerified: true,
        authProviders: ['google'],
        passwordHash: null,
      });
      return { id: newUser.id, email: newUser.email, name: newUser.name };
    } catch (e: unknown) {
      // PG 23505 = unique_violation（email UNIQUE constraint）
      // 使用 QueryFailedError.driverError.code 而非 e.message，避免版本升級後字串格式改變
      const isUniqueViolation =
        e instanceof QueryFailedError &&
        (e.driverError as { code?: string }).code === '23505';

      if (isUniqueViolation) {
        const existing = await this.repo.findByEmail(email);
        // 若 retry 後仍為 null（極端 race），re-throw 避免靜默回傳 undefined
        if (!existing) throw e;
        return { id: existing.id, email: existing.email, name: existing.name };
      }
      throw e;
    }
  }

  private generateHandle(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const suffix = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * 36)]).join('');
    return `vs_${suffix}`;
  }
}
```

- [ ] **Step 2: TypeScript 確認**

```bash
npx tsc --noEmit
```

預期：無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth.service.ts
git commit -m "feat(auth): add googleUpsert — QueryFailedError race retry, Set dedup providers"
```

---

## Task 3：後端 — Controller + Router

**Files:**
- Modify: `src/modules/auth/auth.controller.ts`
- Modify: `src/modules/auth/auth.router.ts`

- [ ] **Step 1: 加入 `googleUpsert` handler（含安全強化）**

將 `src/modules/auth/auth.controller.ts` 改為：

```typescript
import { Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { AuthService } from './auth.service';
import { UserRepository } from '../users/user.repository';
import { ok, fail } from '../../shared/types/response.types';

const service = new AuthService(new UserRepository());

const ERROR_STATUS: Record<string, number> = {
  EMAIL_TAKEN: 409,
  EMAIL_GOOGLE_ONLY: 401,
  INVALID_CREDENTIALS: 401,
  MISSING_SECRET: 500,
};

const ERROR_MSG: Record<string, string> = {
  EMAIL_TAKEN: '此 Email 已被使用',
  EMAIL_GOOGLE_ONLY: '請使用 Google 登入',
  INVALID_CREDENTIALS: 'Email 或密碼錯誤',
};

/**
 * Timing-safe 字串比對，防止 timing attack 爆破 INTERNAL_API_SECRET。
 * 長度不同時：走 dummy branch（不呼叫 timingSafeEqual，避免 RangeError），直接 return false。
 * 長度相同時：timingSafeEqual 在等長 buffer 之間比對，安全。
 */
function safeCompareToken(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // 長度不同已足以否定，不呼叫 timingSafeEqual（要求等長）
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  if (!email || !password || !name) {
    res.status(422).json(fail('VALIDATION_ERROR', 'email, password, name are required'));
    return;
  }
  if (!email.includes('@')) {
    res.status(422).json(fail('VALIDATION_ERROR', '請輸入有效的 Email'));
    return;
  }
  if (password.length < 8) {
    res.status(422).json(fail('VALIDATION_ERROR', '密碼至少 8 個字元'));
    return;
  }

  try {
    const result = await service.register(email.trim().toLowerCase(), password, name.trim());
    res.status(201).json(ok(result));
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : 'INTERNAL';
    res.status(ERROR_STATUS[code] ?? 500).json(fail(code, ERROR_MSG[code] ?? '伺服器錯誤'));
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(422).json(fail('VALIDATION_ERROR', 'email and password are required'));
    return;
  }

  try {
    const result = await service.login(email.trim().toLowerCase(), password);
    res.json(ok(result));
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : 'INTERNAL';
    res.status(ERROR_STATUS[code] ?? 500).json(fail(code, ERROR_MSG[code] ?? '伺服器錯誤'));
  }
}

export async function googleUpsert(req: Request, res: Response): Promise<void> {
  // 收窄 header 型別（Express 允許多值 header → string[]，取第一個）
  const rawToken = req.headers['x-internal-token'];
  const internalToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const expectedToken = process.env['INTERNAL_API_SECRET'];

  // timingSafeEqual 比對，防止 timing attack；缺少 header 或 secret 未設定皆拒絕
  if (!expectedToken || !internalToken || !safeCompareToken(internalToken, expectedToken)) {
    res.status(401).json(fail('UNAUTHORIZED', 'Invalid internal token'));
    return;
  }

  const { googleId, email, name, avatar } = req.body as {
    googleId?: string;
    email?: string;
    name?: string;
    avatar?: string;
  };

  if (!googleId || !email) {
    res.status(422).json(fail('VALIDATION_ERROR', 'googleId and email are required'));
    return;
  }

  // avatar 需為 https:// 開頭才接受，防止 http 或 javascript: 協議寫入 DB
  const safeAvatar =
    typeof avatar === 'string' && avatar.startsWith('https://')
      ? avatar.slice(0, 500)
      : null;

  try {
    const user = await service.googleUpsert(
      googleId.trim(),
      email.trim().toLowerCase(),
      name?.trim().slice(0, 100),  // 截斷超長 name
      safeAvatar ?? undefined,
    );
    res.json(ok({ id: user.id, email: user.email, name: user.name }));
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : 'INTERNAL';
    res.status(500).json(fail(code, '伺服器錯誤'));
  }
}
```

- [ ] **Step 2: 在 auth.router.ts 註冊新路由**

將 `src/modules/auth/auth.router.ts` 改為：

```typescript
import { Router } from 'express';
import { register, login, googleUpsert } from './auth.controller';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/google-upsert', googleUpsert);

export default authRouter;
```

- [ ] **Step 3: TypeScript 確認**

```bash
npx tsc --noEmit
```

預期：無錯誤

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/auth.controller.ts src/modules/auth/auth.router.ts
git commit -m "feat(auth): google-upsert endpoint — safeCompare, https avatar guard, input trim"
```

---

## Task 4：後端 — 環境變數與手動測試

**Files:**
- Modify: `.env`

- [ ] **Step 1: 加入 `INTERNAL_API_SECRET`**

```env
INTERNAL_API_SECRET=replace-this-with-a-random-32-char-secret
```

> ⚠️ 值必須與前端 `.env.local` 完全一致。使用 `openssl rand -hex 32` 產生。

- [ ] **Step 2: 測試：缺少 secret → 401**

```bash
curl -s -X POST http://localhost:4000/api/auth/google-upsert \
  -H "Content-Type: application/json" \
  -d '{"googleId":"123","email":"test@gmail.com"}' | jq .
```

預期：`{ "error": { "code": "UNAUTHORIZED" } }`

- [ ] **Step 3: 測試：全新 Google 使用者（B1）**

```bash
curl -s -X POST http://localhost:4000/api/auth/google-upsert \
  -H "Content-Type: application/json" \
  -H "x-internal-token: replace-this-with-a-random-32-char-secret" \
  -d '{"googleId":"gsub-12345","email":"newuser@gmail.com","name":"New User","avatar":"https://lh3.googleusercontent.com/photo.jpg"}' | jq .
```

DB 驗證：
```sql
SELECT id, google_id, auth_providers, password_hash, email_verified
FROM users WHERE email = 'newuser@gmail.com';
-- password_hash=NULL, auth_providers={google}, email_verified=true
```

- [ ] **Step 4: 測試：合併 credentials 帳號（B2）**

```bash
curl -s -X POST http://localhost:4000/api/auth/google-upsert \
  -H "Content-Type: application/json" \
  -H "x-internal-token: replace-this-with-a-random-32-char-secret" \
  -d '{"googleId":"gsub-99999","email":"existing@gmail.com","name":"Existing User"}' | jq .
```

DB 驗證：
```sql
SELECT google_id, auth_providers, password_hash FROM users WHERE email = 'existing@gmail.com';
-- google_id 非 NULL, auth_providers={credentials,google}, password_hash 非 NULL
```

- [ ] **Step 5: 測試：idempotent（B3）**

重複 Step 3，確認回傳相同 UUID，DB 無新增記錄。

- [ ] **Step 6: 測試：缺少 googleId → 422（B5）**

```bash
curl -s -X POST http://localhost:4000/api/auth/google-upsert \
  -H "Content-Type: application/json" \
  -H "x-internal-token: replace-this-with-a-random-32-char-secret" \
  -d '{"email":"test@gmail.com"}' | jq .
```

預期：`{ "error": { "code": "VALIDATION_ERROR" } }`

- [ ] **Step 7: 測試：非 https avatar 被丟棄（B14b）**

```bash
curl -s -X POST http://localhost:4000/api/auth/google-upsert \
  -H "Content-Type: application/json" \
  -H "x-internal-token: replace-this-with-a-random-32-char-secret" \
  -d '{"googleId":"gsub-httptest","email":"httpavatar@gmail.com","name":"Test","avatar":"http://evil.com/img.jpg"}' | jq .
```

DB 驗證：
```sql
SELECT avatar FROM users WHERE email = 'httpavatar@gmail.com';
-- avatar = NULL（http:// 被丟棄）
```

- [ ] **Step 8: 測試：race condition catch（B8）**

在後端啟動的狀態下，用 Node.js 腳本模擬並發：

```bash
node -e "
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const body = JSON.stringify({googleId:'gsub-race-test',email:'racetest@gmail.com',name:'Race'});
const headers = {'Content-Type':'application/json','x-internal-token':'replace-this-with-a-random-32-char-secret'};
Promise.all([
  fetch('http://localhost:4000/api/auth/google-upsert',{method:'POST',headers,body}),
  fetch('http://localhost:4000/api/auth/google-upsert',{method:'POST',headers,body}),
]).then(async ([r1,r2]) => {
  const [j1,j2] = await Promise.all([r1.json(),r2.json()]);
  console.log('req1 id:', j1.data?.id);
  console.log('req2 id:', j2.data?.id);
  console.log('same UUID?', j1.data?.id === j2.data?.id);
});
"
```

預期：兩個請求都成功（200），且回傳**相同 UUID**（race condition 被 catch 攔截）。

---

## Task 5：前端 — 環境變數與 jwt callback

**Files:**
- Modify: `.env.local`
- Modify: `auth.config.ts`

- [ ] **Step 1: 加入兩個環境變數**

```env
# server-side only（無 NEXT_PUBLIC_），後端位址不打包進瀏覽器 bundle
API_URL=http://localhost:4000

# 與後端 .env 的 INTERNAL_API_SECRET 完全相同的值
INTERNAL_API_SECRET=replace-this-with-a-random-32-char-secret
```

- [ ] **Step 2: 修改 `auth.config.ts`**

將 `auth.config.ts` 改為：

```typescript
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

// Edge-safe config: no Node.js-only imports (no crypto, no fs, etc.)
// authorize() and jwt() use fetch only — safe for Edge Runtime
export const authConfig: NextAuthConfig = {
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(
            `${process.env['NEXT_PUBLIC_API_URL']}/api/auth/login`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            },
          );
          const json = await res.json() as {
            data: { user: { id: string; email: string; name: string } } | null;
            error: { code: string } | null;
          };
          if (!res.ok || json.error || !json.data) return null;
          return {
            id: json.data.user.id,
            email: json.data.user.email,
            name: json.data.user.name,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    async jwt({ token, account, profile }) {
      // account 只在首次登入時存在；token refresh 時為 undefined，不重複呼叫 upsert
      // profile.sub guard：NextAuth v5 Google profile.sub 是 optional，缺失時跳過 upsert（B16）
      if (account?.provider === 'google' && profile?.email && profile?.sub) {
        try {
          // 使用 API_URL（無 NEXT_PUBLIC_），後端位址不暴露給瀏覽器 bundle
          const res = await fetch(
            `${process.env['API_URL']}/api/auth/google-upsert`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-token': process.env['INTERNAL_API_SECRET'] ?? '',
              },
              body: JSON.stringify({
                googleId: profile.sub,
                email: profile.email,
                name: profile.name,
                avatar: (profile as { picture?: string }).picture,
              }),
            },
          );

          if (res.ok) {
            const json = await res.json() as {
              data: { id: string; email: string; name: string } | null;
            };
            if (json.data?.id) {
              // 以後端 UUID 取代 Google numeric sub，讓後端所有 API 查詢正常
              token.sub   = json.data.id;
              token.name  = json.data.name;
              token.email = json.data.email;
            }
          } else {
            // 非 200 記錄 log，讓 server log 可追蹤（例如 INTERNAL_API_SECRET 設定錯誤）
            console.error('[auth] google-upsert returned', res.status, '— degraded mode active');
          }
        } catch (e) {
          // 網路錯誤時降級：token.sub 仍為 Google sub
          // 使用者可登入但後端 API 可能找不到 User（B7、B15）
          console.error('[auth] google-upsert fetch failed, degraded mode active', e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.sub;
      return session;
    },
  },
};
```

- [ ] **Step 3: TypeScript 確認**

```bash
cd C:\website\vibelog\voyage-frontend
npx tsc --noEmit
```

預期：無錯誤

- [ ] **Step 4: Commit**

```bash
git add auth.config.ts .env.local
git commit -m "feat(auth): google-upsert jwt callback — API_URL, sub guard, degraded logging"
```

---

## Task 6：端對端測試

前後端都在本機跑起來後執行。

### T1：全新 Google 使用者（B1、B9、B10）

- [ ] 點「使用 Google 登入」，用從未出現過的 Google 帳號
- [ ] 登入後進 `/trips`，在 `/api/auth/session` 確認 `user.id` 是 UUID 格式
- [ ] DB：`password_hash=NULL`，`auth_providers={google}`，`google_id` 非空

### T2：credentials 帳號 → Google 合併（B2、B4）

- [ ] 用已有 email/password 帳號對應的 Google 帳號登入
- [ ] DB：`auth_providers={credentials,google}`，`password_hash` 仍非 NULL
- [ ] 登出後改用 email+密碼重新登入 → 成功
- [ ] `/profile` 確認「修改密碼」按鈕仍顯示

### T3：hydrateMembers 名字修復（B11）

- [ ] Google 帳號登入，進行程個人空間，分享備忘錄
- [ ] 換另一帳號進同一行程，確認「其他成員的備忘錄」顯示正確名字（不是 "Unknown"）

### T4：重複 Google 登入 idempotent（B3、B13）

- [ ] 同一 Google 帳號登出再登入
- [ ] DB：無新增 User；`auth_providers` 無重複 `google`

### T5：純 Google 帳號個人頁（B12）

- [ ] 全新 Google 帳號登入後進 `/profile`
- [ ] 「修改密碼」按鈕**不顯示**

### T6：降級模式可見性與行為（B7、B15、B16）

- [ ] 暫時將後端 `.env` 的 `INTERNAL_API_SECRET` 改成錯誤值，重啟後端
- [ ] 用 Google 帳號登入
- [ ] 查看 **Next.js server console**，確認有 `[auth] google-upsert returned 401` 的 log
- [ ] 訪問 `/api/users/me`，確認回傳 404（token.sub 是 Google sub，非 UUID）
- [ ] 嘗試建立行程，確認可以建立但成員名字顯示 Unknown（可接受的降級行為，B15）
- [ ] 將 secret 改回正確值，重啟，重新 Google 登入 → 一切恢復正常

---

## 完整邊界條件驗證 Checklist

```
□ B1   全新 Google 使用者 → passwordHash=null, authProviders=[google]
□ B2   credentials 帳號 Google 登入 → 合併（Set 去重），不覆蓋 passwordHash
□ B3   已合併帳號再次 Google 登入 → idempotent
□ B4   合併後 email+密碼仍可登入
□ B5   缺 googleId → 422
□ B6   缺/錯 X-Internal-Token → 401（safeCompareToken）
□ B7   upsert 失敗 → console.error 可見，不阻斷登入
□ B8   並發 upsert → QueryFailedError.code===23505 catch，重試 findByEmail；仍 null 則 re-throw
□ B9   Google name=null → fallback email@前半段
□ B10  Google avatar=null → 存 null
□ B11  合併後 hydrateMembers → 名字正確，不顯示 Unknown
□ B12  純 Google 帳號 → hasPassword=false，修改密碼按鈕隱藏
□ B13  多值 header → 取 [0]，安全比對
□ B14  超長 name → 截斷 100 字元
□ B14b 非 https avatar → 存 null；超長 → 截斷 500
□ B15  降級模式下建立行程 → 可建立，成員顯示 Unknown（可接受，重登入後恢復）
□ B16  profile.sub undefined → jwt callback guard 攔截，不呼叫 upsert，console.error
```

---

## Security Review Summary（三輪審查後最終狀態）

| 威脅 | 解法 | 狀態 |
|------|------|------|
| Timing attack on shared secret | `safeCompareToken` 用 `timingSafeEqual`（等長才呼叫，不同長度直接 false） | ✅ |
| Race condition 並發建立同 email | `QueryFailedError.driverError.code === '23505'`，retry 後 null 則 re-throw | ✅ |
| 多值 header 陣列 | `Array.isArray` 收窄，取 `[0]` | ✅ |
| 降級模式靜默失敗 | `console.error` 保留可追蹤 log（200 以外也 log）| ✅ |
| NEXT_PUBLIC URL 暴露後端位址 | server-side call 改用 `API_URL` | ✅ |
| name 超長 | controller 截斷 100 | ✅ |
| avatar 非 https / 超長 | `startsWith('https://')` 驗證，否則存 null；上限 500 | ✅ |
| authProviders 去重 | `Set` + `Array.from` | ✅ |
| `profile.sub` undefined | jwt callback 加 `profile?.sub` guard | ✅ |
| 帳號劫持（email-based merge 固有設計） | Gmail 唯一性為前提；記載設計假設；自訂網域用戶留待後續處理 | 📝 已記載 |
