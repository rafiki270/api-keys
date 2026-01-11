# API Keys

Reusable helpers for issuing, validating, and managing API keys backed by Prisma.

## Installation

```sh
npm install @rafiki270/api-keys
```

## Core usage

```js
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  verifyApiKey,
  resolveApiKeySecret,
} from "@rafiki270/api-keys";

const secret = resolveApiKeySecret({
  env: process.env,
  fallbackEnvKeys: ["AUTH_JWT_SECRET"],
  defaultSecret: "dev-api-key-secret",
});

// Create
const { apiKey, token } = await createApiKey(prisma, {
  teamId: "team-id",
  name: "CI uploads",
  createdByUserId: "user-id",
  expiresAt: null,
  prefix: "ei_",
  secret,
});

// List
const keys = await listApiKeys(prisma, "team-id");

// Revoke
await revokeApiKey(prisma, { teamId: "team-id", id: "key-id" });

// Verify
const { apiKey: resolved, error } = await verifyApiKey(prisma, token, { secret });
```

## Admin UI

```jsx
import { ApiKeysPanel } from "@rafiki270/api-keys/admin";
import { apiFetch } from "./api";

export default function ApiKeysSettings({ teamId }) {
  return <ApiKeysPanel apiFetch={apiFetch} teamId={teamId} />;
}
```

### Props

- `apiFetch(url, options?)`: fetch wrapper that returns JSON and throws on non-2xx.
- `teamId`: active team id for `x-team-id` header.
- `title?`: heading override.
- `description?`: subtitle override.

## Required Prisma models

```prisma
model ApiKey {
  id              String   @id @default(uuid())
  teamId          String
  name            String
  tokenHash       String   @unique
  tokenPrefix     String
  createdByUserId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastUsedAt      DateTime?
  revokedAt       DateTime?
  expiresAt       DateTime?

  team            Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  createdByUser   User?    @relation("ApiKeyCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@index([teamId])
  @@index([tokenPrefix])
  @@index([createdByUserId])
}
```

## Required API endpoints (for the admin panel)

- `GET /api-keys` → `{ apiKeys: ApiKey[] }`
- `POST /api-keys` → `{ apiKey: ApiKey, token: string }`
- `DELETE /api-keys/:id` → `{ revoked: boolean }`
