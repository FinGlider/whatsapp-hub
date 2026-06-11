# WhatsApp Hub — Architecture & Integration Guide

> Applies to: **whatsapp-hub**
> Audience: wapromotion / promo-messenger-server team and any downstream project that receives forwarded webhooks

---

## What the Hub Does

The hub sits between Meta and all downstream projects. Meta sends all WhatsApp webhooks (message status updates, incoming messages, etc.) to a **single URL on the hub**. The hub identifies which project(s) own the phone number involved, then reliably forwards the webhook to every registered endpoint using a persistent queue with retries.

No project receives webhooks directly from Meta — they all go through the hub.

---

## High-Level Flow

```
Meta sends webhook (status update / incoming message)
        ↓
POST /meta/webhook  (hub)
        ↓
Hub responds 200 immediately  ← Meta requires < 20 seconds
        ↓
Extract phone_number_id from payload
        ↓
Lookup: which projects are mapped to this phone number?
  ├─ Cache hit  → return cached project list (TTL: 1 hour)
  └─ Cache miss → query MySQL, cache result
        ↓
For each matched project → enqueue a Bull job in Redis
        ↓
Queue worker (concurrency: 10, rate limit: 75 req/s)
        ↓
POST to project endpoint with forwarding headers
        ↓
Project receives webhook and processes it
```

---

## 1. Webhook Reception

**Route:** `POST /meta/webhook`
**Controller:** `src/controllers/metaWebhook.controller.js`

- Hub responds `200 OK` immediately before doing any work (Meta requires this within 20 seconds or it retries)
- Extracts `entry[0].changes[0].value.metadata.phone_number_id` to identify the phone
- Looks up all active projects mapped to that phone number
- Forwards to all matched projects in parallel via the queue

**Webhook Verification (GET):** `GET /meta/webhook`
- Handles Meta's one-time verification challenge
- Matches `hub.verify_token` against the `verify_token` stored in the App record
- Returns the challenge on match, 403 on mismatch

---

## 2. Routing — How the Hub Decides Where to Forward

The routing decision is entirely database-driven. No code changes are needed to add or change routing.

### Data Model

```
BusinessAccount (WhatsApp Business Account from Meta)
  └─→ App (Meta App — holds verify_token and access_token)
        └─→ PhoneNumber (Meta phone_number_id)
              └─→ Project (many-to-many via PhoneNumberProject)
                    └─ endpoint: https://wapromoapi.finglider.com/whatsapp-webhook
```

### Routing Logic

1. Hub looks up all `PhoneNumberProject` rows where `phone_number_id` matches and `is_active = true`
2. Joins to `Project` where `is_active = true`
3. Orders by `priority DESC` (higher number = higher priority)
4. Forwards to **all matched projects** — one phone number can fan out to multiple endpoints

### Caching

- Cache key: `phone:{phone_number_id}`
- TTL: 1 hour
- Cache is invalidated automatically when mappings are created or deleted via the Admin API
- Implementation: NodeCache (in-memory, single process)

---

## 3. Queue System — Reliable Delivery

All forwarding goes through a **Bull + Redis** persistent queue. Jobs survive hub restarts.

### Configuration

| Setting | Value | Purpose |
|---|---|---|
| Queue name | `webhook-forwarding` | Bull queue in Redis |
| Concurrency | 10 | 10 parallel HTTP forwards at a time |
| Rate limit | 75 req/s | Hard ceiling to protect downstream services |
| Attempts | 5 | Retry up to 5 times on failure |
| Backoff | Exponential, 5s base | 5s → 10s → 20s → 40s → 80s |
| Axios timeout | 30 seconds | Per-request timeout for downstream POST |
| Lock duration | 60 seconds | Prevents false stall detection |
| Completed retention | 1,000 jobs or 1 hour | Debugging window without bloating Redis |
| Failed retention | 5,000 jobs or 24 hours | Full day to inspect failures |

### Why 75 req/s

wapromoApi's safe throughput window is 50–100 req/s (constrained by MySQL concurrent write capacity). 75/s is the midpoint. For a 10,000-message broadcast generating ~30,000 status callbacks, the hub drains the entire backlog in **~7 minutes**.

### Redis Persistence

AOF persistence is enabled (`appendonly yes`, `appendfsync everysec`). This means:
- Hub process crash → **zero jobs lost** (all in Redis)
- Redis crash → at most **1 second** of queued jobs lost (AOF flushes every second)
- RDB snapshots also run as a secondary backup

---

## 4. Forwarding Headers

Every forwarded request includes these headers:

| Header | Value | Purpose |
|---|---|---|
| `Content-Type` | `application/json` | Standard JSON |
| `User-Agent` | `WhatsApp-Hub/1.0` | Identifies source |
| `X-Phone-Number-ID` | Meta phone_number_id | Lets downstream identify which number triggered the webhook |
| `X-Webhook-Forward-Secret` | Shared secret from `.env` | Bypass mechanism for HMAC signature check (see Section 5) |

---

## 5. Integration Guide for wapromotion

### Why a Shared Secret Is Needed

When the hub receives a webhook from Meta, it parses the JSON body and re-serializes it before forwarding. This changes the raw bytes, so Meta's original HMAC-SHA256 signature no longer matches. Rather than forward the raw bytes (which would require special handling in the hub), we use a shared secret header to tell wapromoApi to trust the forwarded request.

### Setup

**Step 1 — Both sides must have the same secret in `.env`:**

Hub `.env`:
```
WEBHOOK_FORWARD_SECRET=<strong random secret>
```

wapromoApi `.env`:
```
WEBHOOK_FORWARD_SECRET=<same secret>
```

**Step 2 — wapromoApi webhook handler should:**
1. Check if `X-Webhook-Forward-Secret` header is present and matches `process.env.WEBHOOK_FORWARD_SECRET`
2. If match → skip Meta HMAC check, process payload normally
3. If no match → perform normal HMAC verification

### What wapromoApi Receives

Standard Meta webhook format, re-serialized. The body structure is identical to what Meta sends:

**Status callback:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "statuses": [{
          "id": "<messageId>",
          "status": "delivered",
          "timestamp": "1234567890",
          "recipient_id": "<phone>"
        }]
      }
    }]
  }]
}
```

**Incoming message:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "id": "<msgId>",
          "from": "<phone>",
          "type": "text",
          "text": { "body": "Hello" }
        }],
        "contacts": [{ "profile": { "name": "..." }, "wa_id": "<phone>" }]
      }
    }]
  }]
}
```

---

## 6. Admin API

Base path: `/admin`

All configuration changes (adding business accounts, apps, phone numbers, projects, mappings) are made via the Admin API. No database access or code changes required.

### Business Accounts

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/business-accounts` | List all WABA accounts |
| `POST` | `/admin/business-accounts` | Register a new WABA |

### Apps

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/business-accounts/:businessId/apps` | List apps for a WABA |
| `POST` | `/admin/apps` | Create a new app (includes verify_token, access_token) |

### Phone Numbers

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/apps/:appId/phone-numbers` | List phone numbers for an app |
| `POST` | `/admin/phone-numbers` | Register a phone number |
| `GET` | `/admin/phone-numbers/:phoneNumberId/projects` | View project mappings for a number |

### Projects

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/projects` | List all registered downstream projects |
| `POST` | `/admin/projects` | Register a new project with its endpoint URL |

### Mappings (Phone → Project)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/mappings` | Map a phone number to a project |
| `DELETE` | `/admin/mappings/:phoneNumberId/:projectId` | Remove a mapping (sets is_active=false) |

### System

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/health` | Hub health, DB connectivity, queue stats |
| `GET` | `/admin/system/queue/stats` | Live queue depth (waiting, active, completed, failed, delayed) |
| `GET` | `/admin/system/cache/stats` | Cache hit/miss stats |
| `POST` | `/admin/system/cache/clear` | Flush the routing cache |

---

## 7. Queue Stats — Monitoring a Broadcast

During a large broadcast, poll `GET /admin/system/queue/stats` to watch the hub's forwarding backlog:

```json
{
  "waiting": 4820,
  "active": 10,
  "completed": 1240,
  "failed": 2,
  "delayed": 0
}
```

| Field | Meaning |
|---|---|
| `waiting` | Jobs queued but not yet being processed |
| `active` | Jobs currently being forwarded (should stay near 10) |
| `completed` | Successfully forwarded |
| `failed` | Failed after all 5 retry attempts — investigate these |
| `delayed` | Rate-limited or backoff-delayed jobs waiting to retry |

**Expected behaviour for a 10,000-message broadcast:**
- `waiting` grows to ~30,000 as Meta fires status callbacks
- Drains at ~75/s → empty in ~7 minutes
- `active` stays around 10 throughout
- `failed` should be 0 for a healthy wapromoApi

---

## 8. Key Files Reference

| File | Role |
|---|---|
| `src/controllers/metaWebhook.controller.js` | Webhook receiver — responds 200, triggers routing + forwarding |
| `src/services/forwarder.service.js` | Fans out to multiple projects, calls queueWebhook per project |
| `src/services/queue.service.js` | Bull queue definition, processor, rate limit, retry config |
| `src/services/router.service.js` | Core routing: phone_number_id → projects DB query |
| `src/services/cache.service.js` | NodeCache wrapper for routing results |
| `src/services/db.service.js` | All database operations (CRUD for all entities) |
| `src/models/BusinessAccount.js` | WABA model |
| `src/models/App.js` | App model (holds verify_token, access_token) |
| `src/models/PhoneNumber.js` | Phone number model |
| `src/models/Project.js` | Downstream project model (name, endpoint) |
| `src/models/PhoneNumberProject.js` | Junction table — phone-to-project mappings with priority |
| `src/routes/admin.route.js` | All admin API routes |
| `src/routes/metaWebhook.route.js` | Webhook receive/verify routes |

---

## 9. What Happens If Things Go Wrong

| Scenario | Behaviour |
|---|---|
| Hub process crashes mid-broadcast | All queued jobs are in Redis. Hub restarts, Bull resumes processing from where it stopped. |
| Redis crashes | AOF replays on restart. At most 1 second of jobs lost. Jobs already being processed may be re-queued once (idempotency on wapromoApi's side is recommended). |
| wapromoApi returns 5xx / timeout | Job retries up to 5 times with exponential backoff (5s → 10s → 20s → 40s → 80s). Moved to `failed` set after all attempts exhausted. |
| wapromoApi is temporarily down | Retries spread over ~155 seconds cover typical restart windows. |
| Meta sends webhook for unknown phone_number_id | Hub logs a warning and discards (no project to forward to). |
| Cache is stale after a mapping change | Admin API mapping endpoints automatically invalidate the cache for the affected phone number. |
| Queue backlog grows too large | Increase hub concurrency (`webhookQueue.process(N, ...)`) or raise rate limiter (`max`) if wapromoApi capacity allows. |
