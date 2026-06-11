# Broadcast Message System — Architecture & Integration Guide

> Applies to: **wapromotion / promo-messenger-server**  
> Audience: This project team + any WhatsApp hub project that needs to integrate or forward webhooks

---

## Context

This document describes how the bulk broadcast system works end-to-end — from queueing a 10,000-message send job, through WhatsApp API delivery, to final status tracking in the database. It is written to be readable by an external WhatsApp hub project that may need to forward webhooks or understand the data flow.

---

## High-Level Flow

```
Superadmin / User triggers broadcast
        ↓
POST /broadcasts  (broadcastController)
        ↓
BullMQ job enqueued to Redis  ←─── returns jobId immediately
        ↓
broadcastWorker picks up job
        ↓
bulkSendService: paginated send loop
  ├─ Fetch 500 customers from DB
  ├─ Send 10 in parallel → WhatsApp Cloud API
  ├─ Write MessageHistory record per message
  └─ Repeat until all sent
        ↓
Meta sends delivery callbacks → POST /whatsapp-webhook
        ↓
webhookController updates MessageHistory status
        ↓
Broadcast counters incremented, Socket.IO notifies frontend
```

---

## 1. Triggering a Broadcast

**Route:** `POST /broadcasts`  
**Controller:** `src/controllers/broadcastController.js`

What happens on this request:
1. Validates template is approved, user has active subscription, group has customers
2. Creates a `Broadcast` record (snapshot of template name, language, components at that moment)
3. Enqueues a BullMQ job to the `bulk-send` Redis queue with: `{ broadcastId, groupId, templateId, userId, accessToken, phoneNumberId }`
4. **Returns immediately** with `{ jobId }` — the actual sending is async

The client polls `GET /progress/job/:jobId` for live progress.

---

## 2. Why It Doesn't Fail at 10,000 Messages

### Memory Safety — Paginated DB Reads
Customers are never loaded all at once. The send loop fetches **500 at a time** from MySQL, processes them, then fetches the next 500. Memory usage is constant regardless of group size.

### Controlled Concurrency — 10 Parallel API Calls
Within each page of 500, messages are sent in **micro-batches of 10** using `Promise.allSettled()`. This avoids both sequential slowness and the thundering-herd problem of 500 simultaneous requests.

### Rate Limit Constants (`src/services/bulkSendService.js`)

| Constant | Value | Purpose |
|---|---|---|
| `PAGE_SIZE` | 500 | Customers fetched per DB query |
| `CONCURRENT_SENDS` | 10 | Parallel WhatsApp API calls per micro-batch |
| `MESSAGE_DELAY` | 100ms | Pause between micro-batches |
| `PAGE_DELAY` | 500ms | Pause between DB pages |
| `MAX_RETRIES` | 3 | Attempts per individual message |
| `RETRY_BASE_DELAY` | 2000ms | Exponential backoff base |
| `RATE_LIMIT_BASE_DELAY` | 10,000ms | Backoff when Meta returns rate-limit error |
| `RATE_LIMIT_MAX_DELAY` | 300,000ms | Max backoff cap (5 min) |
| `CIRCUIT_BREAKER_THRESHOLD` | 50 | Consecutive failures before pausing |
| `CIRCUIT_BREAKER_PAUSE` | 60,000ms | How long to pause when circuit opens |
| `PROGRESS_SAVE_EVERY` | 250 | Messages between progress persistence calls |

**Throughput:** ~50–80 messages/second for business-tier Meta accounts.  
**Time for 10,000 messages:** ~2–3 minutes end-to-end.

### Per-Message Retry with Exponential Backoff
Every individual send goes through `sendWithRetry()`. On failure it retries up to 3 times with `delay × 2^attempt` spacing. Meta rate-limit errors (codes `130429`, `80014`) get a separate, longer backoff starting at 10 seconds.

### Circuit Breaker
If 50 consecutive messages fail (any reason), the job pauses for 1 minute before resuming. This prevents hammering the Meta API during a degraded window and avoids burning through retries.

### BullMQ Worker Config (`src/workers/broadcastWorker.js`)
- **Worker concurrency:** 3 jobs running simultaneously
- **Rate limiter:** max 60 jobs/second across all workers
- **Auto-retry:** 5 attempts with exponential backoff on job-level failure
- **Persistence:** Jobs survive server restarts (stored in Redis)

---

## 3. Message History Storage

**Model:** `src/models/messageHistory.js`  
**Table:** `MessageHistories`

A record is created for **every single message attempt**, immediately after the WhatsApp API call returns.

### Key Fields

| Field | Type | Description |
|---|---|---|
| `customerId` | INTEGER | Who was sent the message |
| `messageId` | STRING | Meta's unique message ID (used for status matching) |
| `status` | ENUM | `pending` → `sent` → `delivered` → `read` / `failed` |
| `templateId` | INTEGER | Which template was used |
| `groupId` | INTEGER | Source group |
| `broadcastId` | INTEGER | Parent broadcast job |
| `userId` | INTEGER | Which account sent it |
| `error` | TEXT | Error detail if status is `failed` |

### Insert Pattern
Records are inserted **one at a time per message** via `messageHistory.create()`, spread across 10 concurrent promises. No bulk insert — this keeps it simple and lets each record carry the exact messageId and error from its own API call.

### Database Indexes (`src/migrations/20241017_add_performance_indexes.js`)
Indexes exist on: `userId`, `(userId, status)`, `customerId`, `createdAt`, `templateId`, `groupId` — ensuring fast lookups for history queries and status rollups.

---

## 4. Status Update via Webhook

**Route:** `POST /whatsapp-webhook`  
**Controller:** `src/controllers/webhookController.js`

Meta sends delivery callbacks asynchronously. Each callback contains:
- `messageId` — matches the ID stored in `MessageHistories`
- `status` — `sent` / `delivered` / `read` / `failed`
- `timestamp` — Unix timestamp
- `errors` — present if `failed`

### Processing Steps
1. **Signature verification** — HMAC-SHA256 using `META_APP_SECRET` (or `X-Webhook-Forward-Secret` header for hub forwarding — see Section 5)
2. **Status mapping** — Meta status string → DB enum value
3. **MessageHistory update** — `UPDATE MessageHistories SET status=? WHERE messageId=?`
4. **Broadcast rollup** — if status is `delivered`/`read`/`failed`, increments the corresponding counter on the parent `Broadcast` record (`deliveredMessages`, `readMessages`, `failedMessages`)
5. **Real-time push** — emits `broadcast_stats` Socket.IO event to `user_{userId}` room so the frontend dashboard updates instantly
6. **Fallback** — if no `MessageHistory` row matches (i.e. it's a free-form outbound message), the same status update is applied to the `Interactions` table instead

---

## 5. Integration Guide for the WhatsApp Hub Project

The webhook handler supports **trusted hub forwarding**. When your hub receives a webhook from Meta and re-forwards it to this server, the original Meta HMAC signature won't match (because the raw bytes change on re-serialization). Use the bypass mechanism:

### Hub Forwarding Setup

**Step 1 — Set the shared secret on this server's `.env`:**
```
WEBHOOK_FORWARD_SECRET=<a strong random secret you choose>
```

**Step 2 — From your hub, forward the webhook with this header:**
```
X-Webhook-Forward-Secret: <same secret>
POST https://<this-server>/whatsapp-webhook
Content-Type: application/json
Body: <Meta's original JSON payload, forwarded as-is>
```

When this header is present and matches, the HMAC check is skipped entirely and the payload is processed normally.

### What This Server Expects in the Webhook Body
Standard Meta webhook format:
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "statuses": [{ "id": "<messageId>", "status": "delivered", "timestamp": "1234567890" }]
      }
    }]
  }]
}
```
Or for incoming messages:
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{ "id": "<msgId>", "from": "<phone>", "type": "text", "text": { "body": "..." } }]
      }
    }]
  }]
}
```

### Progress Polling (for hub dashboard integration)
```
GET /progress/job/:jobId
Authorization: Bearer <token>

Response:
{
  "successCount": 4820,
  "failedCount": 12,
  "totalCount": 10000,
  "percentComplete": 48.32,
  "throughput": 72,
  "estimatedTimeRemaining": 71
}
```

---

## 6. Key Files Reference

| File | Role |
|---|---|
| `src/controllers/broadcastController.js` | HTTP entry point — validates, creates Broadcast, enqueues job |
| `src/services/bulkSendService.js` | Core send loop — pagination, concurrency, retry, circuit breaker |
| `src/workers/broadcastWorker.js` | BullMQ worker — picks jobs from Redis, calls bulkSendService |
| `src/queues/broadcastQueue.js` | Queue definition and Redis connection |
| `src/controllers/webhookController.js` | Receives Meta delivery callbacks, updates status, emits Socket.IO |
| `src/services/progressService.js` | In-memory progress store with TTL |
| `src/controllers/progressController.js` | HTTP endpoint for job progress polling |
| `src/models/messageHistory.js` | MessageHistory schema |
| `src/models/Broadcast.js` | Broadcast job record and counters |

---

## 7. What Happens If Things Go Wrong

| Scenario | Behaviour |
|---|---|
| Meta returns rate-limit error | Exponential backoff starting 10s, capped at 5 min, then retry |
| Individual message fails 3 times | Recorded as `failed` in MessageHistory, job continues |
| 50 consecutive failures | Circuit breaker opens, entire job pauses 1 minute |
| Server crashes mid-job | BullMQ re-queues job from Redis on restart (may re-send some messages in current page) |
| Progress lost from memory | Falls back to Broadcast DB record for completion stats |
| Webhook arrives for unknown messageId | Logs a warning, tries Interactions table, no crash |
