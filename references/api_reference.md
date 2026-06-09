# Nelos External API

This document is the external-facing API guide for trusted partners integrating Nelos into their own product. It focuses on the supported partner surface: API-key auth, products, managed asset batches, optional study testing, billing visibility, and webhooks.

The primary integration path is:

1. Create or reference a Nelos product.
2. Submit a managed batch requesting static ads, video ads, or both.
3. Poll the managed batch until assets are available.
4. Optionally run a Nelos study on generated or uploaded assets.

Partners should keep their own customer hierarchy, permissions, and end-customer billing in their own system. Nelos billing is org-wise and tied to the partner org.

---

## Base URL

```text
Production: <Nelos API base URL provided during onboarding>
Local/dev:  http://localhost:3001
```

All examples below use:

```bash
export NELOS_API_BASE_URL="<Nelos API base URL>"
export NELOS_API_KEY="nelos_user_xxx"
```

---

## Authentication

External requests use a Nelos user API key:

```http
Authorization: Bearer nelos_user_xxx
Content-Type: application/json
```

API keys are generated in the authenticated web app by calling:

```http
POST /api/users/me/api-key
Authorization: Bearer <supabase_access_token>
```

Response:

```json
{
  "success": true,
  "data": {
    "apiKey": "nelos_user_xxx",
    "apiKeyPrefix": "nelos_user_x",
    "apiKeyLastRotatedAt": "2026-06-08T18:00:00.000Z"
  }
}
```

The full API key is only returned once. Store it securely.

---

## Response Format

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

Use the custom `id` field returned by the API, such as `product_...`, `stimulus_...`, `study_...`, `static_gen_run_...`, `video_gen_run_...`, or `managed_batch_...`. Do not depend on MongoDB `_id` values.

---

## Partner Customer Mapping

Nelos does not model a partner's downstream customers as first-class billing entities. Keep that layer in the partner app.

For reconciliation, pass stable external IDs when creating managed batches:

```json
{
  "externalCustomerId": "customer_123",
  "externalWorkspaceId": "workspace_456",
  "externalCampaignId": "campaign_789"
}
```

Nelos stores those IDs for support, reporting, idempotency, and abuse review.

---

## Products

Products are org-scoped creative source records. A managed batch can use an existing `productId`, inline product data, or a `productUrl`.

### Product Object

```typescript
interface Product {
  id: string;
  orgId: string;
  name: string;
  description: string;
  websiteUrl?: string;
  isPinned: boolean;
  features?: string[];
  branding?: {
    logo?: { url?: string; contentType?: string };
    favicon?: { url?: string; contentType?: string };
    ogImage?: { url?: string; contentType?: string };
    fontFamilies?: string[];
    colorPalette?: string[];
    notes?: string;
    referenceImages?: Array<{ url?: string; contentType?: string }>;
  };
  createdAt: string;
  updatedAt: string;
}
```

### Create Product

```http
POST /api/products
```

```bash
curl -X POST "$NELOS_API_BASE_URL/api/products" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Analytics",
    "description": "Analytics software for revenue teams.",
    "websiteUrl": "https://example.com",
    "features": ["Pipeline reporting", "CRM sync", "Forecast alerts"]
  }'
```

### List Products

```http
GET /api/products
```

### Get Product

```http
GET /api/products/:id
```

### Update Product

```http
PUT /api/products/:id
```

### Delete Product

```http
DELETE /api/products/:id
```

### Extract Basics From URL

Use this when you want product suggestions before creating a product.

```http
POST /api/products/extract-basics
```

```json
{
  "sourceUrl": "https://example.com/product"
}
```

### Import Brand Assets

For an existing product, start a brand import from a product or company URL:

```http
POST /api/products/:id/brand-imports
```

```json
{
  "sourceUrl": "https://example.com"
}
```

Poll:

```http
GET /api/products/:id/brand-imports/:importId
```

Apply selected suggestions:

```http
POST /api/products/:id/brand-imports/:importId/apply
```

```json
{
  "fields": {
    "description": true,
    "features": true,
    "logo": true,
    "colorPalette": true,
    "referenceImages": true
  }
}
```

---

## Managed Batches

Managed batches are the recommended external API for generating ads. A partner submits product context plus asset counts, and Nelos creates an asynchronous batch.

Current early-access behavior:

- The API creates a durable managed batch.
- The API resolves or creates a product.
- The API estimates credits with a 20% managed-service markup.
- The API starts static/video planning runs.
- Polling is the supported status path.
- Full automatic rendering, video export, study start, and managed-batch callback delivery may be coordinated operationally during early access.

### Create Managed Batch

```http
POST /api/v1/managed-batches
Idempotency-Key: partner-job-123
```

```typescript
interface ManagedBatchRequest {
  productId?: string;
  productUrl?: string;
  product?: {
    name?: string;
    description?: string;
    websiteUrl?: string;
    features?: string[];
    branding?: Record<string, any>;
  };
  requestedAssets: {
    staticCount?: number;
    videoCount?: number;
    staticQuality?: 'standard' | 'premium';
    videoMode?: 'animated' | 'ugc';
    aspectRatios?: ('1:1' | '4:5' | '9:16' | '16:9' | '1.91:1')[];
    videoDurationSeconds?: number;
  };
  runStudy?: boolean;
  study?: {
    pipelineType?: 'ctrProxy' | 'videoCtrProxy' | 'ama';
    targetingPresetId?: string;
    targetingGroups?: unknown[];
    callbackUrl?: string;
    callbackSecret?: string;
  };
  externalCustomerId?: string;
  externalWorkspaceId?: string;
  externalCampaignId?: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
  callbackSecret?: string;
}
```

Example with existing product:

```bash
curl -X POST "$NELOS_API_BASE_URL/api/v1/managed-batches" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: acme-campaign-001" \
  -d '{
    "productId": "product_abc123",
    "requestedAssets": {
      "staticCount": 6,
      "videoCount": 2,
      "staticQuality": "premium",
      "videoMode": "ugc",
      "aspectRatios": ["1:1", "9:16"],
      "videoDurationSeconds": 15
    },
    "runStudy": true,
    "study": {
      "pipelineType": "ctrProxy"
    },
    "externalCustomerId": "customer_123",
    "externalCampaignId": "campaign_789",
    "metadata": {
      "source": "partner-dashboard"
    }
  }'
```

Example with product URL only:

```json
{
  "productUrl": "https://example.com",
  "requestedAssets": {
    "staticCount": 4,
    "videoCount": 1,
    "aspectRatios": ["1:1", "9:16"]
  },
  "externalCustomerId": "customer_123"
}
```

Response:

```typescript
interface ManagedBatchStatus {
  batchId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'canceled' | string;
  productId: string;
  estimatedCredits: {
    base: number;
    markupPercent: 20;
    markup: number;
    total: number;
    breakdown: Record<string, any>;
  };
  requestedAssets: {
    staticCount: number;
    videoCount: number;
    staticQuality?: 'standard' | 'premium';
    videoMode?: 'animated' | 'ugc';
    aspectRatios?: string[];
    videoDurationSeconds?: number;
  };
  externalCustomerId?: string | null;
  externalWorkspaceId?: string | null;
  externalCampaignId?: string | null;
  staticGenerationRunIds: string[];
  videoGenerationRunIds: string[];
  studyIds: string[];
  assets: Array<{
    stimulusId: string;
    type: 'image_ad' | 'static_image' | 'video_ad';
    mediaUrl: string;
    headline?: string;
    primaryText?: string;
    metadata?: Record<string, any>;
    generation?: Record<string, any>;
    createdAt?: string;
  }>;
  progress: {
    requestedCount: number;
    completedCount: number;
    failedCount: number;
    remainingCount: number;
  };
  error?: {
    message: string;
    code?: string;
    at?: string;
  };
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}
```

### Get Managed Batch

```http
GET /api/v1/managed-batches/:batchId
```

```bash
curl "$NELOS_API_BASE_URL/api/v1/managed-batches/managed_batch_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"
```

### List Managed Batches

```http
GET /api/v1/managed-batches?productId=product_abc123&limit=25
```

Query params:

| Param | Type | Notes |
|-------|------|-------|
| `productId` | string | Optional product filter |
| `limit` | number | 1-100, default 25 |

### Idempotency

Send `Idempotency-Key` on create requests. If the same key is retried for the same org, Nelos returns the existing batch instead of creating a duplicate.

---

## Direct Static Generation

Most partners should use managed batches. Direct static generation is available for trusted integrations that need concept-level control.

### Create Static Planning Run

```http
POST /api/generations/static
```

```json
{
  "productId": "product_abc123",
  "useBrandKit": true,
  "numOptions": 6,
  "copyVerbosity": "medium"
}
```

Notes:

- Provide `productId` or `stimulusIds`.
- Product-only generation requires `useBrandKit: true`.
- This endpoint plans concepts. It does not render images.
- Poll until `status` is `awaiting_selection`.

### Render Selected Static Concepts

```http
POST /api/generations/static/:id/render
```

```json
{
  "conceptIds": ["concept_1", "concept_2"],
  "aspectRatios": ["1:1", "9:16"],
  "quality": "standard",
  "visualExecutionsPerCombo": 1
}
```

Rendering debits credits immediately. Completed render jobs create `Stimulus` records with `mediaUrl`, copy, and generation metadata.

### Static Generation Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/generations/static` | List static runs |
| `POST` | `/api/generations/static` | Create concept planning run |
| `GET` | `/api/generations/static/:id` | Fetch status, concepts, jobs, and generated stimuli |
| `GET` | `/api/generations/static/:id/events` | Stream progress with SSE |
| `PATCH` | `/api/generations/static/:id/concepts/:conceptId` | Edit a concept before render |
| `POST` | `/api/generations/static/:id/render` | Render selected concepts |

---

## Direct Video Generation

Video generation exposes more workflow detail than managed batches. External partners should use it only when they need direct control over script, storyboard, frames, clips, voiceover, and export.

### Options

```http
GET /api/generations/video/options
```

Returns supported content intents, video modes, image providers, audio modes, voiceover options, style presets, visibility/render modes, and billing options.

### Create Video Run

```http
POST /api/generations/video
```

```json
{
  "productId": "product_abc123",
  "aspectRatio": "9:16",
  "durationSeconds": 15,
  "videoMode": "ugc",
  "creativeBrief": "Show a revenue leader discovering pipeline risk before a forecast call.",
  "queuePlanning": true
}
```

### Video Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/generations/video/options` | Get supported options |
| `GET` | `/api/generations/video` | List video runs |
| `POST` | `/api/generations/video` | Create a direct run |
| `GET` | `/api/generations/video/:id` | Fetch run |
| `DELETE` | `/api/generations/video/:id` | Cancel/delete run |
| `GET` | `/api/generations/video/:id/events` | Stream progress with SSE |
| `PATCH` | `/api/generations/video/:id/planning` | Update planning |
| `POST` | `/api/generations/video/:id/script/generate` | Generate script |
| `PATCH` | `/api/generations/video/:id/script` | Update script |
| `POST` | `/api/generations/video/:id/storyboard/generate` | Generate storyboard |
| `POST` | `/api/generations/video/:id/voiceover/generate` | Generate voiceover |
| `POST` | `/api/generations/video/:id/assets` | Queue remaining assets |
| `POST` | `/api/generations/video/:id/export` | Export final video and create a video stimulus |

Plan-based video generation is also available:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/generations/video/plans` | List content plans |
| `POST` | `/api/generations/video/plans` | Create content plan |
| `GET` | `/api/generations/video/plans/:planId` | Fetch plan |
| `PATCH` | `/api/generations/video/plans/:planId` | Update plan |
| `POST` | `/api/generations/video/plans/:planId/runs` | Create run from plan concept |

Completed exports create `video_ad` stimuli. Use those stimuli in `videoCtrProxy` studies.

---

## Studies and Uploaded Assets

Partners can run studies on uploaded assets, generated static ads, or generated videos.

### Stimulus

```typescript
interface Stimulus {
  id: string;
  orgId: string;
  productId?: string;
  name: string;
  type: 'image_ad' | 'static_image' | 'video_ad' | 'video_ad_script' | 'tiktok_hook';
  primaryText?: string;
  headline?: string;
  description?: string;
  mediaUrl?: string;
  script?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

### Create Stimulus From Hosted Asset

```http
POST /api/stimuli
```

```json
{
  "productId": "product_abc123",
  "name": "Partner Static Ad A",
  "type": "image_ad",
  "mediaUrl": "https://cdn.example.com/ad-a.png",
  "headline": "Forecast with confidence",
  "primaryText": "Spot pipeline risk before it hits the board deck."
}
```

### Signed Upload

```http
POST /api/uploads/sign
```

```json
{
  "fileName": "ad-a.png",
  "contentType": "image/png"
}
```

Response includes `uploadUrl`, `publicUrl`, `objectName`, and `expiresAt`. Upload the file to `uploadUrl`, then create a stimulus using `publicUrl`.

### Create Study

```http
POST /api/studies
```

```json
{
  "productId": "product_abc123",
  "name": "Campaign Test",
  "pipelineType": "ctrProxy",
  "stimulusIds": ["stimulus_abc123", "stimulus_def456"],
  "runsPerPersonaPerStimulus": 3,
  "callbackUrl": "https://partner.example.com/nelos/study-webhook",
  "callbackSecret": "shared-secret"
}
```

Pipeline guidance:

| Asset type | `pipelineType` |
|------------|----------------|
| Static/image ads | `ctrProxy` |
| Video ads | `videoCtrProxy` |
| Open-ended AMA-style feedback | `ama` |
| Text hooks | `textHook` |

### Start Sampling

Get confirmation:

```http
GET /api/studies/:id/sampling/confirm
```

Start:

```http
POST /api/studies/:id/sampling/start
```

```json
{
  "confirm": {
    "stimulusCount": 2,
    "runsPerPair": 3
  }
}
```

### Study Status and Results

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/studies/:id/sampling/status` | Poll progress |
| `GET` | `/api/studies/:id/sampling/events` | Stream progress with SSE |
| `GET` | `/api/studies/:id/results/ranking` | Get ranked stimuli |
| `GET` | `/api/studies/:id/results/themes` | Get reason themes |
| `GET` | `/api/studies/:id/results/demos` | Get demographic insights |
| `GET` | `/api/studies/:id/results/geo` | Get geographic insights |
| `GET` | `/api/studies/:id/results/segments` | Get behavioral segments |

---

## Webhooks

Study completion webhooks are supported for studies created with `callbackUrl`.

Managed batches accept `callbackUrl` and `callbackSecret` in the request body, but managed-batch callback delivery is not the supported completion path during early access. Poll `GET /api/v1/managed-batches/:batchId`.

### Study Completion Webhook

When a study completes, Nelos sends a signed JSON payload to the configured `callbackUrl`.

Headers:

```http
Content-Type: application/json
X-Nelos-Signature: <hmac-sha256>
```

Payload includes study identifiers, status, and backward-compatible aliases for existing webhook consumers.

Verify the signature with the shared `callbackSecret`.

---

## Billing

Billing is org-wise and managed in the Nelos web portal. Partners should bill their own downstream customers separately.

### Billing Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/billing/subscription` | Current org subscription and credits |
| `GET` | `/api/billing/transactions?page=1&limit=25` | Org credit transactions |
| `POST` | `/api/billing/checkout` | Create Stripe checkout session for `starter` or `pro` |
| `POST` | `/api/billing/addon` | Buy add-on credits |
| `POST` | `/api/billing/portal` | Open Stripe billing portal |

Self-serve checkout supports `starter` and `pro`. `scale` is sales-managed.

Credit behavior:

- Study runs debit credits at sampling start.
- Static/video generation debits requested assets and refunds failed asset generations where supported.
- Insufficient balance returns `402`.
- Blocked subscription statuses return `402`.

---

## Status Codes

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created |
| `202` | Accepted for async processing |
| `400` | Validation or request error |
| `401` | Missing or invalid auth |
| `403` | Authenticated but not allowed for that org/resource |
| `404` | Resource not found |
| `402` | Billing issue or insufficient credits |
| `500` | Server error |

---

## Recommended External Integration

For most partners:

1. Generate one `nelos_user_...` API key for the partner org.
2. Store partner customer/product mappings in the partner app.
3. Create or reuse Nelos products per advertised product.
4. Submit managed batches with `externalCustomerId`, `externalWorkspaceId`, and `externalCampaignId`.
5. Use `Idempotency-Key` on every batch create request.
6. Poll `GET /api/v1/managed-batches/:batchId`.
7. Store returned `stimulusId` and `mediaUrl` values in the partner app.
8. Use Nelos study endpoints only when the partner wants testing/insights, not just asset generation.
