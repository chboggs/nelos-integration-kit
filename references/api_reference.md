# Nelos External API

This document is the external-facing API guide for trusted partners integrating Nelos into their own product. It focuses on the supported partner surface: API-key auth, products, managed asset batches, direct static/video generation, optional study testing, and webhooks.

The primary integration path is:

1. Create or reference a Nelos product.
2. Submit a managed batch requesting static ads, video ads, or both.
3. Poll the managed batch until assets are available.
4. Optionally run a Nelos study on generated or uploaded assets.

Partners should keep their own customer hierarchy, permissions, and end-customer commercial logic in their own system. Nelos commercial terms, credits, and account setup are handled outside this external API.

Internal account-management and commercial-operations endpoints are intentionally omitted from this external spec.

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

Nelos does not model a partner's downstream customers as first-class account entities. Keep that layer in the partner app.

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

### Types

```typescript
interface ProductAsset {
  url?: string;
  geminiRegisteredUrl?: string;
  objectName?: string;
  contentType?: string;
}

interface Product {
  id: string;
  orgId: string;
  name: string;
  description: string;
  websiteUrl?: string;
  isPinned: boolean;
  features?: string[];
  branding?: {
    logo?: ProductAsset;
    favicon?: ProductAsset;
    ogImage?: ProductAsset;
    typographyReference?: ProductAsset;
    fontFamilies?: string[];
    fontAssets?: Array<ProductAsset & { family?: string; weights?: string[] }>;
    colorPalette?: string[];
    notes?: string;
    referenceImages?: ProductAsset[];
  };
  serviceArea?: {
    isLocal?: boolean;
    label?: string;
    description?: string;
    cities?: string[];
    counties?: string[];
    metroAreas?: string[];
    states?: string[];
    countries?: string[];
    evidence?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

interface ProductBrandImport {
  id: string;
  productId: string;
  sourceUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  startedAt?: string | null;
  completedAt?: string | null;
  suggestions?: {
    name?: string;
    description?: string;
    features?: string[];
    logoUrl?: string;
    colorPalette?: string[];
    fontFamilies?: string[];
    referenceImageUrls?: string[];
    brandingNotes?: string;
  };
  error?: { message: string; code?: string } | null;
}
```

Supported brand-kit image content types are `image/png`, `image/jpeg`, `image/webp`, `image/heic`, and `image/heif`. Typography references can also use PDF.

### Create Product

```http
POST /api/products
```

Auth: required.

Request:

```typescript
interface CreateProductRequest {
  name: string;
  description: string;
  websiteUrl?: string | null; // must be http/https with protocol
  isPinned?: boolean;
  features?: string[];
  branding?: Product['branding'];
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `name` | yes | Human-readable product name used in generation prompts, study names, and internal product lists. |
| `description` | yes | Core product positioning. This is one of the main inputs for static/video generation, so include what the product does, who it is for, and why buyers care. |
| `websiteUrl` | no | Product/company URL. Used as source context for brand imports and product understanding. Must include protocol. |
| `isPinned` | no | Marks this as the org's primary/default product in the first-party UI. If true, other products are unpinned. |
| `features` | no | Short product capability/value bullets. Useful for generation and study context. |
| `branding` | no | Brand kit inputs: logo, colors, fonts, notes, and reference images. Used by brand-aware generation. |

Example:

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

Response:

```typescript
// 201
SuccessResponse<Product>
```

Validation notes:

- `name` and `description` are required.
- `websiteUrl` must include `http://` or `https://`.
- If `isPinned` is `true`, Nelos unpins other products in the same org.

### List Products

```http
GET /api/products
```

Auth: required.

Response:

```typescript
// 200
SuccessResponse<{
  count: number;
  products: Product[];
}>
```

### Get Product

```http
GET /api/products/:id
```

Path params:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Product `id`, for example `product_abc123` |

Response:

```typescript
// 200
SuccessResponse<Product>
// 404 if not found in the authenticated org
```

### Update Product

```http
PUT /api/products/:id
```

Request:

```typescript
interface UpdateProductRequest {
  name?: string;
  description?: string;
  websiteUrl?: string | null;
  isPinned?: boolean;
  features?: string[];
  branding?: Product['branding'] | null;
}
```

Request field reference:

| Field | What it changes |
|-------|-----------------|
| `name` | Updates product display name and future generation context. |
| `description` | Updates product positioning used by future generations/studies. |
| `websiteUrl` | Updates source URL used by brand import and product reference analysis. |
| `isPinned` | Pins/unpins the product for the org. Pinning one product unpins the others. |
| `features` | Replaces product feature bullets. |
| `branding` | Replaces or updates brand assets and guidance. Removed stored assets may be deleted. |

Example:

```json
{
  "description": "Revenue intelligence software for pipeline inspection and forecast risk.",
  "features": ["Pipeline inspection", "CRM sync", "Forecast risk alerts"],
  "branding": {
    "colorPalette": ["#111827", "#2563eb", "#f9fafb"],
    "fontFamilies": ["Inter"],
    "notes": "Clean B2B SaaS look. High contrast. Avoid cartoon styling."
  }
}
```

Response:

```typescript
// 200
SuccessResponse<Product>
// 404 if not found
```

Notes:

- `id` and `orgId` cannot be changed.
- Updating branding may delete removed stored branding assets.
- Updating a product queues product reference analysis.

### Delete Product

```http
DELETE /api/products/:id
```

Response:

```typescript
// 200
SuccessResponse<{ id: string }>
// 404 if not found
```

Deleting a product also removes product-scoped stimuli and related generated/edit assets owned by the org. Do not call this as a soft archive.

### Extract Basics From URL

Use this when you want product suggestions before creating a product.

```http
POST /api/products/extract-basics
```

Request:

```json
{
  "sourceUrl": "https://example.com/product"
}
```

Response:

```typescript
// 200
SuccessResponse<{
  name?: string;
  description?: string;
  features?: string[];
  websiteUrl?: string;
}>
// 400 if extraction fails
// 422 if the URL was reachable but no useful product basics were found
```

### Import Brand Assets

For an existing product, start a brand import from a product or company URL:

```http
POST /api/products/:id/brand-imports
```

Request:

```json
{
  "sourceUrl": "https://example.com"
}
```

`sourceUrl` is optional if the product already has `websiteUrl`.

Response:

```typescript
// 202
SuccessResponse<ProductBrandImport>
```

### Get Brand Import

Poll an import until `status` is `completed` or `failed`:

```http
GET /api/products/:id/brand-imports/:importId
```

Response:

```typescript
// 200
SuccessResponse<ProductBrandImport>
// 404 if not found
```

### Apply Brand Import

Apply selected suggestions from a completed brand import:

```http
POST /api/products/:id/brand-imports/:importId/apply
```

Request:

```typescript
interface ApplyProductBrandImportRequest {
  logoUrl?: string | null;
  colorPalette?: string[] | null;
  fontFamilies?: string[] | null;
  referenceImageUrls?: string[] | null;
  applyFieldSuggestions?: boolean | null;
  description?: string | null;
  features?: string[] | null;
  brandingNotes?: string | null;
}
```

Request field reference:

| Field | What it applies |
|-------|-----------------|
| `logoUrl` | Sets the product brand logo from one of the import suggestions or another URL. |
| `colorPalette` | Sets brand colors. Use hex colors when possible. |
| `fontFamilies` | Sets preferred font family names for generation guidance. |
| `referenceImageUrls` | Adds imported/reference imagery that generation can use for brand and product style. |
| `applyFieldSuggestions` | If true, applies extracted product text suggestions such as description/features when available. |
| `description` | Overrides product description with a specific selected/edited value. |
| `features` | Overrides product feature list with selected/edited values. |
| `brandingNotes` | Adds plain-language brand direction for generation. |

Example:

```json
{
  "applyFieldSuggestions": true,
  "logoUrl": "https://example.com/logo.png",
  "colorPalette": ["#111827", "#2563eb", "#f9fafb"],
  "fontFamilies": ["Inter", "Arial"],
  "referenceImageUrls": ["https://example.com/og-image.png"],
  "brandingNotes": "Use product UI screenshots as proof, not abstract backgrounds."
}
```

Response:

```typescript
// 200
SuccessResponse<Product>
// 409 if the import is not completed yet
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

Auth: required.

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
    targetingGroups?: TargetingGroup[];
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

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `productId` | one product source required | Uses an existing Nelos product. Best option when the partner has already mapped its product to a Nelos `product_...` id. |
| `productUrl` | one product source required | Lets Nelos create/resolve product context from a URL. Best for first-time or lightweight integrations. |
| `product` | one product source required | Inline product data for creating/resolving a product without relying only on URL extraction. |
| `requestedAssets` | yes | Tells Nelos how many static/video assets to generate and in which formats. |
| `runStudy` | no | If true, requests that generated assets also be evaluated in a study once orchestration supports the full path. |
| `study` | no | Optional study configuration such as pipeline type, targeting, and study callback. |
| `externalCustomerId` | no | Partner-owned customer/account ID for reconciliation. Nelos does not interpret this as a downstream account entity. |
| `externalWorkspaceId` | no | Partner-owned workspace/team/project ID. |
| `externalCampaignId` | no | Partner-owned campaign/job ID. Useful for matching results to a campaign in the partner app. |
| `metadata` | no | Arbitrary partner metadata returned on the batch for support/reconciliation. |
| `callbackUrl` | no | Stored callback URL for future managed-batch callback delivery. Polling is the supported path during early access. |
| `callbackSecret` | no | Secret intended for signing future managed-batch callbacks. |

`requestedAssets` field reference:

| Field | Default | What it does |
|-------|---------|--------------|
| `staticCount` | `0` | Number of static/image ads requested. |
| `videoCount` | `0` | Number of video ads requested. |
| `staticQuality` | `standard` | Static render quality. `premium` costs more and should be used when image quality matters more than speed/cost. |
| `videoMode` | `animated` | Video generation mode. Use `ugc` for UGC/talking-head style workflows. |
| `aspectRatios` | service default | Requested output formats. Applies to static renders and video planning defaults. |
| `videoDurationSeconds` | service default | Target video duration in seconds. |

`study` field reference:

| Field | What it does |
|-------|--------------|
| `pipelineType` | Chooses study pipeline. Use `ctrProxy` for static/image assets and `videoCtrProxy` for videos. |
| `targetingPresetId` | Applies a saved Nelos targeting preset, if configured for the org. |
| `targetingGroups` | Inline targeting rules for the requested study. |
| `callbackUrl` | Study completion webhook URL. Study webhooks are supported. |
| `callbackSecret` | Secret used to sign study completion webhooks. |

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

Status values:

| Status | Meaning |
|--------|---------|
| `queued` | Batch was accepted but generation kickoff has not completed |
| `processing` | Static/video planning runs were created |
| `completed` | Batch orchestration completed |
| `failed` | Batch failed; see `error` |
| `canceled` | Batch was canceled |

Validation notes:

- Provide at least one of `productId`, `product`, or `productUrl`.
- `requestedAssets.staticCount` and `requestedAssets.videoCount` default to `0`; at least one should be positive for useful work.
- `staticQuality` is `standard` or `premium`.
- Supported `aspectRatios`: `1:1`, `4:5`, `9:16`, `16:9`, `1.91:1`.
- `Idempotency-Key` is strongly recommended for every create request.

### Get Managed Batch

```http
GET /api/v1/managed-batches/:batchId
```

```bash
curl "$NELOS_API_BASE_URL/api/v1/managed-batches/managed_batch_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"
```

Response:

```typescript
// 200
SuccessResponse<ManagedBatchStatus>
// 404 if not found in the authenticated org
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

Response:

```typescript
// 200
SuccessResponse<ManagedBatchStatus[]>
```

### Idempotency

Send `Idempotency-Key` on create requests. If the same key is retried for the same org, Nelos returns the existing batch instead of creating a duplicate.

---

## Direct Static Generation

Most partners should use managed batches. Direct static generation is available for trusted integrations that need concept-level control.

Static generation is a two-step workflow:

1. Create a planning run. Nelos returns concepts.
2. Render selected concepts into image stimuli.

### Static Statuses

```typescript
type StaticGenerationStatus =
  | 'planning_queued'
  | 'planning'
  | 'awaiting_selection'
  | 'rendering_queued'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'canceled';
```

### Static Run Response

`GET /api/generations/static/:id` returns the full run:

```typescript
interface StaticGenerationRun {
  id: string;
  orgId: string;
  productId: string | null;
  createdByUserId: string | null;
  status: StaticGenerationStatus;
  request: {
    stimulusIds: string[];
    productId: string | null;
    useBrandKit: boolean;
    theme?: Record<string, any> | null;
    themes?: Record<string, any>[];
    copyVerbosity: 'low' | 'medium' | 'high';
    awarenessStages?: string[];
    conceptStagePlan?: string[];
    language?: string;
    customPrompt?: string;
    numOptions: number;
  };
  concepts: Array<{
    conceptId: string;
    name: string;
    headline: string;
    primaryText: string;
    awarenessStage?: string;
    angle?: string;
    angleDescription?: string;
    adStructure?: string;
    reasoning?: {
      strategy?: string;
      visualDirection?: string;
    };
  }>;
  selection?: {
    conceptIds: string[];
    aspectRatios: string[];
    visualExecutionsPerCombo: number;
  };
  rendering?: {
    requestedCount: number;
    completedCount: number;
    failedCount: number;
  };
  renderJobs: Array<{
    renderJobId: string;
    conceptId: string;
    conceptName?: string;
    aspectRatio?: '1:1' | '9:16' | '4:5' | '16:9' | '1.91:1';
    executionIndex: number;
    executionCount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    stimulusId?: string | null;
    error?: string | null;
  }>;
  result: {
    generatedStimulusIds: string[];
    failedItems: any[];
    generatedCount: number;
  };
  progress: {
    requestedCount: number;
    completedCount: number;
    failedCount: number;
    remainingCount: number;
  };
  stimuli: Stimulus[];
  error?: { message: string; code?: string; at?: string } | null;
  createdAt: string;
  updatedAt: string;
}
```

### Create Static Planning Run

```http
POST /api/generations/static
```

Request:

```typescript
interface CreateStaticGenerationRequest {
  productId?: string;
  stimulusIds?: string[];
  useBrandKit?: boolean;
  theme?: Record<string, any>;
  themes?: Record<string, any>[];
  copyVerbosity?: 'low' | 'medium' | 'high';
  awarenessStages?: string[]; // max 5
  ideation?: {
    audiences?: string[];
    angles?: string[];
    structures?: string[];
  };
  conceptStagePlan?: string[]; // 1-20 concepts, using awareness-stage values
  language?: string;
  customPrompt?: string;
  numOptions?: number; // 1-20, default 5
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `productId` | yes unless `stimulusIds` supplied | Product context for generation. Product-only generation also requires `useBrandKit: true`. |
| `stimulusIds` | no | Existing stimuli to use as source/reference creative. Useful for variants or learning from uploaded ads. |
| `useBrandKit` | required for product-only | Enables use of product branding/assets as generation context. |
| `theme` | no | One-off creative theme object. Use for a single campaign direction. |
| `themes` | no | Multiple theme objects. Use when asking for broader creative variety. |
| `copyVerbosity` | no | Controls amount of copy. `low` is terse, `medium` is balanced, `high` allows more explanatory copy. |
| `awarenessStages` | no | Restricts concepts to buyer awareness stages. Max 5. |
| `ideation.audiences` | no | Narrows concept ideation to specific audience/awareness selections. |
| `ideation.angles` | no | Narrows creative strategy angles. Values must be supported by the backend enum. |
| `ideation.structures` | no | Narrows ad structures. Values must be supported by the backend enum. |
| `conceptStagePlan` | no | Explicit concept plan by awareness stage. Length controls number of concepts when present. |
| `language` | no | Output language guidance for copy. |
| `customPrompt` | no | Additional generation instruction. Use for campaign-specific constraints, not core product facts. |
| `numOptions` | no | Number of concepts to plan, 1-20. Ignored when `conceptStagePlan` is supplied. |

Minimum product-based request:

```json
{
  "productId": "product_abc123",
  "useBrandKit": true,
  "numOptions": 6,
  "copyVerbosity": "medium"
}
```

Request using existing source stimuli:

```json
{
  "productId": "product_abc123",
  "stimulusIds": ["stimulus_ref_123", "stimulus_ref_456"],
  "numOptions": 8,
  "copyVerbosity": "high",
  "customPrompt": "Make these direct-response ads for CFOs and revenue leaders."
}
```

Rules:

- Provide `productId` or `stimulusIds`.
- Product-only generation requires `useBrandKit: true`.
- This endpoint plans concepts. It does not render images.
- Poll until `status` is `awaiting_selection`.
- Use returned `concepts[].conceptId` values in the render request.

Example response after planning:

```json
{
  "success": true,
  "data": {
    "id": "static_gen_run_abc123",
    "status": "awaiting_selection",
    "productId": "product_abc123",
    "concepts": [
      {
        "conceptId": "concept_123",
        "name": "Forecast panic opener",
        "headline": "Find pipeline risk before forecast day",
        "primaryText": "See which deals are actually at risk before they miss.",
        "awarenessStage": "problem_aware",
        "reasoning": {
          "strategy": "Lead with forecast anxiety.",
          "visualDirection": "Dashboard close-up with red risk markers."
        }
      }
    ],
    "result": {
      "generatedStimulusIds": [],
      "failedItems": [],
      "generatedCount": 0
    }
  }
}
```

### Edit a Static Concept

```http
PATCH /api/generations/static/:id/concepts/:conceptId
```

Request field reference:

| Field | What it changes |
|-------|-----------------|
| `name` | Internal/display name for the concept. |
| `headline` | Headline text used when rendering. |
| `primaryText` | Primary ad body copy used when rendering. |
| `awarenessStage` | Buyer awareness stage classification. |
| `angle` | Creative strategy angle. Must be one of the backend-supported angle values. |
| `adStructure` | Ad format/structure. Must be one of the backend-supported structure values. |
| `angleDescription` | Plain-language explanation of the angle. |
| `reasoning.strategy` | Strategy notes kept with the concept. |
| `reasoning.visualDirection` | Visual direction used by the render prompt. |

```json
{
  "name": "Forecast risk dashboard",
  "headline": "Know which deals will slip",
  "primaryText": "Catch risk before the forecast call.",
  "reasoning": {
    "strategy": "Sharper pain-led SaaS ad.",
    "visualDirection": "Show a clean dashboard with one obvious risk alert."
  }
}
```

Response:

```typescript
SuccessResponse<StaticGenerationRun>
```

### Render Selected Static Concepts

```http
POST /api/generations/static/:id/render
```

Request:

```typescript
interface RenderStaticGenerationRequest {
  conceptIds: string[]; // required, 1-20
  aspectRatios?: ('1:1' | '9:16' | '4:5' | '16:9' | '1.91:1')[]; // 1-5
  quality?: 'standard' | 'premium';
  visualExecutionsPerCombo?: number; // default 1, max 5
  language?: string;
  customPrompt?: string;
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `conceptIds` | yes | Concepts to render. Use `concepts[].conceptId` from the planning run. |
| `aspectRatios` | no | Output sizes to render. Supported: `1:1`, `9:16`, `4:5`, `16:9`, `1.91:1`. |
| `quality` | no | Render quality. `premium` costs more than `standard`. |
| `visualExecutionsPerCombo` | no | Number of visual variations per concept/aspect-ratio pair. Max 5. |
| `language` | no | Overrides or reinforces output language for rendered copy. |
| `customPrompt` | no | Extra render-specific instructions, such as visual constraints or offer language. |

Example:

```json
{
  "conceptIds": ["concept_123", "concept_456"],
  "aspectRatios": ["1:1", "9:16"],
  "quality": "standard",
  "visualExecutionsPerCombo": 1
}
```

Rendering debits credits immediately. Completed render jobs create `Stimulus` records with `mediaUrl`, copy, and generation metadata.

Example response while rendering:

```json
{
  "success": true,
  "data": {
    "id": "static_gen_run_abc123",
    "status": "rendering_queued",
    "renderJobs": [
      {
        "renderJobId": "render_job_123",
        "conceptId": "concept_123",
        "aspectRatio": "1:1",
        "status": "pending",
        "stimulusId": null
      }
    ],
    "progress": {
      "requestedCount": 2,
      "completedCount": 0,
      "failedCount": 0,
      "remainingCount": 2
    }
  }
}
```

When the run is `completed`, read either:

- `result.generatedStimulusIds`
- `stimuli[].mediaUrl`
- `renderJobs[].stimulusId`

### Poll Static Run

```bash
curl "$NELOS_API_BASE_URL/api/generations/static/static_gen_run_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"
```

Poll every 3-10 seconds until `status` is `completed` or `failed`.

### Stream Static Events

```http
GET /api/generations/static/:id/events
```

Server-sent events include:

| Event | Meaning |
|-------|---------|
| `static_generation.run.init` | Initial run snapshot |
| `static_generation.run.update` | Planning or rendering state changed |
| `static_generation.render_job.completed` | One render job finished |
| `static_generation.render_job.failed` | One render job failed |
| `static_generation.run.done` | Run completed |
| `static_generation.run.error` | Run failed |

Browser `EventSource` does not support custom `Authorization` headers. Use cookie auth, a polyfill that supports headers, or polling when using API keys.

### Complete Static Example

```bash
# 1. Create concepts.
curl -X POST "$NELOS_API_BASE_URL/api/generations/static" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product_abc123",
    "useBrandKit": true,
    "numOptions": 4,
    "copyVerbosity": "medium"
  }'

# 2. Poll the returned run id until status is awaiting_selection.
curl "$NELOS_API_BASE_URL/api/generations/static/static_gen_run_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"

# 3. Render selected concepts.
curl -X POST "$NELOS_API_BASE_URL/api/generations/static/static_gen_run_abc123/render" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "conceptIds": ["concept_123", "concept_456"],
    "aspectRatios": ["1:1", "9:16"],
    "quality": "standard"
  }'

# 4. Poll until completed and consume data.stimuli[].mediaUrl.
```

### Static Generation Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/generations/static` | List static runs |
| `POST` | `/api/generations/static` | Create concept planning run |
| `GET` | `/api/generations/static/:id` | Fetch status, concepts, jobs, and generated stimuli |
| `GET` | `/api/generations/static/:id/events` | Stream progress with SSE |
| `PATCH` | `/api/generations/static/:id/concepts/:conceptId` | Edit a concept before render |
| `POST` | `/api/generations/static/:id/render` | Render selected concepts |

### List Static Runs

```http
GET /api/generations/static?productId=product_abc123&status=completed&limit=25
```

Query params:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `productId` | string | no | Filter by product |
| `status` | string | no | Filter by static run status |
| `limit` | number | no | 1-100 |

Response:

```typescript
SuccessResponse<Array<{
  id: string;
  orgId: string;
  productId: string | null;
  status: StaticGenerationStatus;
  conceptCount: number;
  selectedConceptCount: number;
  contentIntent: string;
  generatedCount: number;
  progress: StaticGenerationRun['progress'];
  error?: StaticGenerationRun['error'];
  createdAt: string;
  updatedAt: string;
}>>
```

---

## Direct Video Generation

Video generation exposes more workflow detail than managed batches. External partners should use it only when they need direct control over script, storyboard, frames, clips, voiceover, and export.

Video generation can be used in two ways:

- **Direct run:** create one run and build assets inside that run.
- **Plan-based:** create a reusable content plan with multiple concepts, then create runs from selected concepts.

For a simple external integration, use direct runs or managed batches.

### Video Statuses

```typescript
type VideoGenerationStatus =
  | 'draft'
  | 'planning_queued'
  | 'planning'
  | 'concepts_ready'
  | 'storyboard_ready'
  | 'assets_queued'
  | 'generating_assets'
  | 'export_queued'
  | 'exporting'
  | 'completed'
  | 'failed'
  | 'canceled';
```

### Video Run Response

`GET /api/generations/video/:id` returns the full run:

```typescript
interface VideoGenerationRun {
  id: string;
  orgId: string;
  productId?: string;
  createdByUserId?: string | null;
  contentPlanId?: string | null;
  conceptId?: string | null;
  status: VideoGenerationStatus;
  request: {
    productId?: string;
    aspectRatio?: '9:16' | '16:9' | '1:1';
    durationSeconds?: number;
    creativeSeed?: string;
    creativeBrief?: string;
    contentIntent?: 'ad' | 'content';
    audioMode?: 'none' | 'music' | 'voiceover' | 'voiceover_music';
    videoMode?: string;
    stylePreset?: string | null;
    ugcStylePreset?: string;
    directorStylePreset?: string | null;
  };
  contentIntent: 'ad' | 'content';
  videoMode: string;
  productContext?: Record<string, any> | null;
  productReferenceAssets?: any[];
  planSnapshot?: Record<string, any> | null;
  concept?: Record<string, any> | null;
  planning?: Record<string, any> | null;
  script?: {
    title?: string;
    fullText?: string;
    voiceoverStyle?: string;
    beats?: any[];
  } | null;
  scenes: any[];
  visualReferences?: Record<string, any>;
  visualBible?: Record<string, any> | null;
  startFrameCandidates?: any[];
  selectedStartFrameCandidateId?: string | null;
  board?: Record<string, any>;
  sequence?: Record<string, any>;
  audio?: Record<string, any> | null;
  export?: {
    status?: string;
    stimulusId?: string;
    mediaUrl?: string;
    [key: string]: any;
  } | null;
  error?: { message: string; code?: string; at?: string } | null;
  createdAt: string;
  updatedAt: string;
}
```

```typescript
interface VideoContentPlanSummary {
  id: string;
  productId: string;
  productName?: string | null;
  status: 'draft' | 'concepts_ready' | 'archived';
  contentIntent: 'ad' | 'content';
  videoMode: string;
  primaryConceptId?: string | null;
  conceptCount: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface VideoContentPlan extends VideoContentPlanSummary {
  orgId: string;
  createdByUserId?: string | null;
  medium: 'video' | string;
  request: Record<string, any>;
  productContext?: Record<string, any> | null;
  guidance?: { concepts?: string; ideation?: Record<string, any> };
  concepts: Array<{
    conceptId: string;
    title?: string;
    summary?: string;
    targetAudience?: string;
    awarenessStage?: string;
    angleDescription?: string;
    hookStyle?: string;
    creativeDirection?: string;
    keyProofPoints?: string;
    adFormat?: string;
    contentFormat?: string;
    angle?: string;
    adStructure?: string;
    creativeBrief?: Record<string, any>;
    hookPackage?: Record<string, any>;
    status?: 'active' | 'archived' | string;
    createdAt?: string;
  }>;
}
```

### Options

```http
GET /api/generations/video/options
```

Returns supported content intents, video modes, image providers, audio modes, voiceover options, style presets, visibility modes, and render modes.

Use this endpoint before building UI controls. The values returned here are the source of truth for enum-like fields.

### Create Video Run

```http
POST /api/generations/video
```

Request:

```typescript
interface CreateVideoGenerationRequest {
  productId?: string | null;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  durationSeconds?: number; // 5-120
  creativeSeed?: string;
  creativeBrief?: string;
  contentIntent?: 'ad' | 'content';
  audioMode?: 'none' | 'music' | 'voiceover' | 'voiceover_music';
  videoMode?: string;
  stylePreset?: string | null;
  ugcStylePreset?: string;
  directorStylePreset?: string | null;
  queuePlanning?: boolean;
  providers?: {
    video?: string;
    image?: string;
    voiceover?: string;
    music?: string;
  };
}
```

Example:

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

If `queuePlanning` is `true`, the backend immediately queues planning. If it is omitted or `false`, create the run first and call `POST /api/generations/video/:id/plan` when ready.

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `productId` | no | Product context for the video. Strongly recommended for partner integrations because it anchors product copy, brand context, and generated visuals. |
| `aspectRatio` | no | Target video format. Use `9:16` for vertical social, `16:9` for landscape, and `1:1` for square placements. |
| `durationSeconds` | no | Target duration, 5-120 seconds. Shorter durations usually produce tighter scripts and fewer scenes. |
| `creativeSeed` | no | Lightweight seed idea or campaign hook. Useful when the partner UI has a one-line prompt field. |
| `creativeBrief` | no | Longer creative direction. Use this for audience, pain point, desired proof, offer, CTA, compliance constraints, or visual style notes. |
| `contentIntent` | no | `ad` optimizes for conversion/CTA; `content` optimizes for educational or organic-style content. |
| `audioMode` | no | Controls audio plan. `none` omits audio, `music` uses music only, `voiceover` uses voiceover only, `voiceover_music` uses both. |
| `videoMode` | no | Generation workflow/mode, such as UGC-style or animated/product-led video. Get supported values from `/api/generations/video/options`. |
| `stylePreset` | no | General visual style preset. Use option values from `/api/generations/video/options`. |
| `ugcStylePreset` | no | UGC-specific style preset when `videoMode` is UGC-like. |
| `directorStylePreset` | no | Director/camera style preset for cinematic or product-led modes. |
| `queuePlanning` | no | If true, creates the run and immediately starts planning in one request. |
| `providers` | no | Optional provider overrides for `video`, `image`, `voiceover`, or `music`. Omit unless Nelos has enabled provider choice for the partner org. |

Response:

```typescript
SuccessResponse<VideoGenerationRun>
```

### Queue or Update Planning

Queue planning:

```http
POST /api/generations/video/:id/plan
```

Update planning fields:

```http
PATCH /api/generations/video/:id/planning
```

```json
{
  "creativeBrief": "Make this feel like a founder-led UGC ad for revenue leaders.",
  "aspectRatio": "9:16",
  "durationSeconds": 15,
  "audioMode": "voiceover_music",
  "guidance": {
    "script": "Open with the pain in the first two seconds.",
    "storyboard": "Use product UI as proof, not decoration."
  }
}
```

After planning, poll until the run has script/storyboard/scenes or status reaches `storyboard_ready`.

Planning field reference:

| Field | What it changes |
|-------|-----------------|
| `creativeBrief` | Replaces or refines the run-level creative direction before planning. |
| `contentIntent` | Switches the run between ad-like and content-like planning. |
| `audioMode` | Changes whether planning should account for voiceover/music. |
| `aspectRatio` | Updates the target output format before storyboard/frame planning. |
| `durationSeconds` | Updates the target duration before script/storyboard generation. |
| `videoMode` | Updates the video workflow/mode. Use values from `/api/generations/video/options`. |
| `stylePreset` | Updates the general style direction. |
| `ugcStylePreset` | Updates UGC-specific style direction. |
| `directorStylePreset` | Updates director/camera style direction. |
| `guidance.script` | Script-specific instruction, such as hook, pacing, tone, proof, or CTA guidance. |
| `guidance.storyboard` | Visual/storyboard instruction, such as product visibility, setting, continuity, or camera guidance. |

### Generate and Edit Script

Generate:

```http
POST /api/generations/video/:id/script/generate
```

```json
{
  "scriptQuality": "standard"
}
```

Edit:

```http
PATCH /api/generations/video/:id/script
```

```json
{
  "title": "Forecast Risk UGC",
  "fullText": "Your forecast is only as good as the risks your reps remembered to update...",
  "voiceoverStyle": "Calm, direct founder voice"
}
```

Critique:

```http
POST /api/generations/video/:id/script/critique
```

Revise:

```http
POST /api/generations/video/:id/script/revise
```

```json
{
  "focus": "improve-hook"
}
```

Valid `focus` values:

```typescript
type StoryRevisionFocus =
  | 'improve-hook'
  | 'more-cohesive'
  | 'more-educational'
  | 'less-salesy'
  | 'stronger-proof'
  | 'more-legible-product-visuals'
  | 'improve-cta'
  | 'tighten-pacing'
  | 'fresh-draft';
```

Script field reference:

| Endpoint | Field | What it does |
|----------|-------|--------------|
| `POST /script/generate` | `scriptQuality` | Controls generation depth/cost. Supported values are `standard`, `premium`, and `ultra` when enabled. |
| `PATCH /script` | `title` | Human-readable script title stored on the run. |
| `PATCH /script` | `fullText` | Full voiceover/script text. This is the main narration source for storyboard and voiceover. |
| `PATCH /script` | `voiceoverStyle` | Direction for voice delivery, such as founder-led, polished, energetic, or calm. |
| `PATCH /script` | `beats` | Structured beat list if the partner wants scene/beat-level control instead of only `fullText`. |
| `POST /script/revise` | `focus` | Revision objective. Use the supported values above. |

### Generate Storyboard and Visual Bible

Generate storyboard:

```http
POST /api/generations/video/:id/storyboard/generate
```

```json
{
  "storyboardQuality": "standard"
}
```

Edit storyboard:

```http
PATCH /api/generations/video/:id/storyboard
```

```json
{
  "scenes": [
    {
      "sceneId": "scene_1",
      "title": "Forecast risk hook",
      "voiceoverLine": "Your forecast is hiding risk.",
      "visualGoal": "Show dashboard with one high-risk deal highlighted.",
      "durationSeconds": 4
    }
  ]
}
```

Generate visual bible:

```http
POST /api/generations/video/:id/visual-bible/generate
```

```json
{
  "quality": "standard"
}
```

Storyboard and visual-bible field reference:

| Endpoint | Field | What it does |
|----------|-------|--------------|
| `POST /storyboard/generate` | `storyboardQuality` | Controls storyboard generation depth/cost. Supported values are `standard`, `premium`, and `ultra` when enabled. |
| `PATCH /storyboard` | `scenes` | Full or partial scene list. Each scene can include `sceneId`, `title`, `voiceoverLine`, `visualGoal`, and `durationSeconds`. |
| `PATCH /storyboard` | `visualReferences` | Reference assets or notes used to steer frame generation. |
| `PATCH /storyboard` | `strategy` | High-level storyboard strategy or rationale. |
| `PATCH /storyboard` | `script` | Script snapshot/override associated with the storyboard. |
| `POST /visual-bible/generate` | `quality` | Controls visual bible generation depth/cost. |

### Voiceover

Suggest voice settings:

```http
POST /api/generations/video/:id/voiceover/suggest
```

Update settings:

```http
PATCH /api/generations/video/:id/voiceover/settings
```

```json
{
  "voiceId": "<voice id from /api/generations/video/options>",
  "language": "<language code from /api/generations/video/options>",
  "accentPreset": "<accent preset from /api/generations/video/options>",
  "pace": "<pace from /api/generations/video/options>",
  "tone": "<tone from /api/generations/video/options>",
  "speakerMode": "<speaker mode from /api/generations/video/options>"
}
```

Generate voiceover:

```http
POST /api/generations/video/:id/voiceover/generate
```

You can include the same voice fields in the generate request to override saved settings.

Voiceover field reference:

| Field | What it does |
|-------|--------------|
| `voiceId` | Voice selection from `/api/generations/video/options`. |
| `language` | Spoken language from `/api/generations/video/options`. |
| `accentPreset` | Preset accent from `/api/generations/video/options`. |
| `customAccent` | Freeform accent note, max 120 characters. |
| `pace` | Delivery speed from `/api/generations/video/options`. |
| `tone` | Voice tone from `/api/generations/video/options`. |
| `emotionTags` | Up to 4 emotion/style tags. |
| `speakerMode` | Speaker configuration from `/api/generations/video/options`. |

### Frame and Clip Plans

Most integrations can skip manual frame/clip editing and call `POST /api/generations/video/:id/assets`. Use these endpoints only if you need direct control.

Add frame plan:

```http
POST /api/generations/video/:id/frame-plans
```

```json
{
  "framePlan": {
    "frameNumber": 1,
    "sourceSceneNumber": 1,
    "subjectType": "product",
    "productVisibility": "primary",
    "productReferenceMode": "auto",
    "visualPrompt": "Clean SaaS dashboard close-up with one red risk alert.",
    "cameraNote": "Tight screen capture style, readable UI."
  }
}
```

Update frame plan:

```http
PATCH /api/generations/video/:id/frame-plans/:frameId
```

Generate one frame:

```http
POST /api/generations/video/:id/frame-plans/:frameId/assets/frame
```

```json
{
  "quality": "standard"
}
```

Frame plan field reference:

| Field | What it does |
|-------|--------------|
| `frameNumber` | Ordered frame number in the run. |
| `sourceSceneId` / `sourceSceneNumber` | Links the frame to a planned storyboard scene. |
| `beatLabel` | Short label for the story beat represented by the frame. |
| `subjectType` | Primary subject of the frame, such as product, person, environment, or abstract proof. |
| `productVisibility` | How visible the product should be. Use option values from `/api/generations/video/options`. |
| `productReferenceMode` | How strongly product/reference assets should steer the frame. |
| `productReferenceAssetIds` | Up to 3 product reference asset IDs to emphasize. |
| `characterIds` | Character/persona IDs to keep consistent across frames when available. |
| `activeSettingId` | Setting/environment ID to use when the run has structured visual settings. |
| `continuityMode` | Continuity behavior for matching prior frames. |
| `referenceFrameNumbers` | Prior frame numbers to use as visual continuity references. |
| `continuityReason` | Human-readable reason for continuity choices. |
| `visualPrompt` | Main image prompt for the frame. This is the most important manual frame field. |
| `negativePrompt` | Things to avoid in the generated frame. |
| `continuityNotes` | Extra notes for keeping characters, product, setting, or composition consistent. |
| `cameraNote` | Camera/composition guidance. |
| `soundCue` | Sound note associated with the frame/scene. |
| `voiceoverTimestamp` | Approximate voiceover timing for this frame. |
| `quality` | Used by frame asset generation; supported values depend on org configuration. |

Add clip plan:

```http
POST /api/generations/video/:id/clip-plans
```

```json
{
  "clipPlan": {
    "startFrameNumber": 1,
    "renderMode": "animate",
    "motionPrompt": "Subtle cursor movement and dashboard highlight pulse.",
    "durationSeconds": 4
  }
}
```

Generate one clip:

```http
POST /api/generations/video/:id/clip-plans/:clipId/assets/clip
```

Clip plan field reference:

| Field | What it does |
|-------|--------------|
| `clipNumber` | Ordered clip number in the run. |
| `startFrameId` / `startFrameNumber` | Starting frame for the clip. |
| `endFrameId` / `endFrameNumber` | Optional ending frame for morph/transition-style clips. |
| `renderMode` | `animate` animates from one frame; `morph` transitions between start/end frames. |
| `motionPrompt` | Motion/camera/action prompt for clip generation. |
| `soundDesign` | Sound design notes for the clip. |
| `voiceoverSegment` | Voiceover text associated with the clip. |
| `voiceoverStartSeconds` / `voiceoverEndSeconds` | Timing anchors for voiceover alignment. |
| `durationSeconds` | Clip duration, typically 1-20 seconds. |

### Queue Assets

Queue all remaining assets:

```http
POST /api/generations/video/:id/assets
```

Queue all frames:

```http
POST /api/generations/video/:id/assets/frames
```

```json
{
  "quality": "standard"
}
```

Queue one asset type:

```http
POST /api/generations/video/:id/assets/:assetType
```

Common `assetType` values include `frame`, `clip`, `voiceover`, and `music`. Use `GET /api/generations/video/options` and the returned run payload to decide which assets are available for the current run.

Asset queue field reference:

| Endpoint | Field | What it does |
|----------|-------|--------------|
| `POST /assets` | `quality` | Optional default quality for queued generated assets. |
| `POST /assets/frames` | `quality` | Quality for all queued frame assets. |
| `POST /assets/:assetType` | `assetType` | Asset type to queue. Supported internal values include `frame`, `clip`, `voiceover`, `music`, `start_frame_candidates`, `visual_bible`, `visual_bible_reference`, and `visual_bible_suggest`. |
| Frame/clip asset endpoints | `quality` | Quality for the single generated frame or clip. |

### Export Video

When required assets are ready, export:

```http
POST /api/generations/video/:id/export
```

Response:

```typescript
SuccessResponse<VideoGenerationRun>
```

When export completes, the run includes:

```typescript
{
  export: {
    status: 'completed',
    stimulusId: 'stimulus_abc123',
    mediaUrl: 'https://...'
  }
}
```

Use `export.stimulusId` for `videoCtrProxy` studies.

### Poll Video Run

```bash
curl "$NELOS_API_BASE_URL/api/generations/video/video_gen_run_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"
```

Poll every 5-15 seconds until `status` is `completed` or `failed`. Video generation has multiple async stages, so a normal run may move through `planning_queued`, `planning`, `storyboard_ready`, `assets_queued`, `generating_assets`, `export_queued`, and `exporting`.

### Stream Video Events

```http
GET /api/generations/video/:id/events
```

Use polling for server-to-server API key integrations unless your SSE client can send the `Authorization` header.

### Complete Video Example

```bash
# 1. Create and queue planning.
curl -X POST "$NELOS_API_BASE_URL/api/generations/video" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product_abc123",
    "aspectRatio": "9:16",
    "durationSeconds": 15,
    "videoMode": "ugc",
    "audioMode": "voiceover_music",
    "creativeBrief": "Founder-led ad showing a revenue leader catching forecast risk.",
    "queuePlanning": true
  }'

# 2. Poll the returned run id until planning/storyboard is ready.
curl "$NELOS_API_BASE_URL/api/generations/video/video_gen_run_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"

# 3. Generate voiceover if the run uses voiceover.
curl -X POST "$NELOS_API_BASE_URL/api/generations/video/video_gen_run_abc123/voiceover/generate" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Queue generated frames/clips/music as needed.
curl -X POST "$NELOS_API_BASE_URL/api/generations/video/video_gen_run_abc123/assets" \
  -H "Authorization: Bearer $NELOS_API_KEY"

# 5. Poll until assets are ready, then export.
curl -X POST "$NELOS_API_BASE_URL/api/generations/video/video_gen_run_abc123/export" \
  -H "Authorization: Bearer $NELOS_API_KEY"

# 6. Poll until completed and consume data.export.mediaUrl / data.export.stimulusId.
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
| `PATCH` | `/api/generations/video/:id/storyboard` | Edit storyboard/scenes |
| `POST` | `/api/generations/video/:id/visual-bible/generate` | Generate visual bible |
| `POST` | `/api/generations/video/:id/voiceover/generate` | Generate voiceover |
| `POST` | `/api/generations/video/:id/frame-plans` | Add a frame plan |
| `PATCH` | `/api/generations/video/:id/frame-plans/:frameId` | Update a frame plan |
| `POST` | `/api/generations/video/:id/frame-plans/:frameId/assets/frame` | Generate a frame |
| `POST` | `/api/generations/video/:id/clip-plans` | Add a clip plan |
| `PATCH` | `/api/generations/video/:id/clip-plans/:clipId` | Update a clip plan |
| `POST` | `/api/generations/video/:id/clip-plans/:clipId/assets/clip` | Generate a clip |
| `POST` | `/api/generations/video/:id/assets` | Queue remaining assets |
| `POST` | `/api/generations/video/:id/assets/frames` | Queue all frame assets |
| `POST` | `/api/generations/video/:id/assets/:assetType` | Queue one asset type |
| `POST` | `/api/generations/video/:id/export` | Export final video and create a video stimulus |

Plan-based video generation is also available:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/generations/video/plans` | List content plans |
| `POST` | `/api/generations/video/plans` | Create content plan |
| `GET` | `/api/generations/video/plans/:planId` | Fetch plan |
| `PATCH` | `/api/generations/video/plans/:planId` | Update plan |
| `PATCH` | `/api/generations/video/plans/:planId/concepts/:conceptId` | Update plan concept |
| `POST` | `/api/generations/video/plans/:planId/concepts/generate` | Generate more concepts |
| `POST` | `/api/generations/video/plans/:planId/runs` | Create run from plan concept |

Completed exports create `video_ad` stimuli. Use those stimuli in `videoCtrProxy` studies.

### List Video Runs

```http
GET /api/generations/video?productId=product_abc123&status=completed&limit=25
```

Query params:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `productId` | string | no | Filter by product |
| `status` | string | no | Filter by video run status |
| `limit` | number | no | 1-100 |

Response:

```typescript
SuccessResponse<Array<{
  id: string;
  productId?: string;
  productName?: string | null;
  name: string;
  status: VideoGenerationStatus;
  contentIntent: 'ad' | 'content';
  videoMode: string;
  sceneCount: number;
  frameCount: number;
  clipCount: number;
  exportStimulusId?: string | null;
  error?: VideoGenerationRun['error'];
  createdAt: string;
  updatedAt: string;
}>>
```

### Delete Video Run

```http
DELETE /api/generations/video/:id
```

Response:

```typescript
SuccessResponse<{ id: string }>
```

### Create Video Content Plan

```http
POST /api/generations/video/plans
```

Request:

```typescript
interface CreateVideoContentPlanRequest {
  productId?: string | null;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  durationSeconds?: number; // 5-120
  creativeSeed?: string;
  creativeBrief?: string;
  contentIntent?: 'ad' | 'content';
  audioMode?: 'none' | 'music' | 'voiceover' | 'voiceover_music';
  videoMode?: string;
  stylePreset?: string | null;
  ugcStylePreset?: string;
  directorStylePreset?: string | null;
  conceptGuidance?: string;
  conceptCount?: number; // 1-6
  conceptQuality?: 'standard' | 'premium' | 'ultra' | null;
  ideation?: {
    audiences?: string[];
    angles?: string[];
    structures?: string[];
  };
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `productId` | no | Product context for the reusable content plan. |
| `aspectRatio` | no | Default output format for runs created from this plan. |
| `durationSeconds` | no | Default target duration, 5-120 seconds. |
| `creativeSeed` | no | Short seed idea used when generating plan concepts. |
| `creativeBrief` | no | High-level creative direction for all concepts in the plan. |
| `contentIntent` | no | `ad` for conversion-oriented concepts, `content` for organic/educational concepts. |
| `audioMode` | no | Default audio mode for runs created from plan concepts. |
| `videoMode` | no | Default video workflow/mode. Use `/api/generations/video/options`. |
| `stylePreset` | no | General plan-level style direction. |
| `ugcStylePreset` | no | UGC-specific style direction. |
| `directorStylePreset` | no | Director/camera style direction. |
| `conceptGuidance` | no | Extra instruction for concept generation. |
| `conceptCount` | no | Number of concepts to generate, 1-6. |
| `conceptQuality` | no | Concept generation depth/cost: `standard`, `premium`, or `ultra` when enabled. |
| `ideation.audiences` | no | Audience constraints for generated concepts. |
| `ideation.angles` | no | Angle constraints for generated concepts. |
| `ideation.structures` | no | Structure/format constraints for generated concepts. |

Response:

```typescript
SuccessResponse<VideoContentPlan>
```

### List Video Content Plans

```http
GET /api/generations/video/plans?productId=product_abc123&limit=25
```

Response:

```typescript
SuccessResponse<VideoContentPlanSummary[]>
```

### Get Video Content Plan

```http
GET /api/generations/video/plans/:planId
```

Response:

```typescript
SuccessResponse<VideoContentPlan>
```

### Update Video Content Plan

```http
PATCH /api/generations/video/plans/:planId
```

Request supports partial updates to `primaryConceptId`, `creativeBrief`, `contentIntent`, `aspectRatio`, `durationSeconds`, `videoMode`, style presets, and `guidance`.

Update field reference:

| Field | What it changes |
|-------|-----------------|
| `primaryConceptId` | Marks the default concept for plan-based run creation. |
| `creativeBrief` | Updates the plan-level creative brief. |
| `contentIntent` | Updates ad/content intent for future concept generation and runs. |
| `aspectRatio` | Updates default aspect ratio. |
| `durationSeconds` | Updates default duration. |
| `videoMode` | Updates default workflow/mode. |
| `stylePreset`, `ugcStylePreset`, `directorStylePreset` | Update style defaults. |
| `guidance` | Stores plan-level guidance, including concept/ideation notes. |

Response:

```typescript
SuccessResponse<VideoContentPlan>
```

### Update Video Plan Concept

```http
PATCH /api/generations/video/plans/:planId/concepts/:conceptId
```

Request supports partial concept updates such as `title`, `summary`, `targetAudience`, `awarenessStage`, `angleDescription`, `hookStyle`, `creativeDirection`, `keyProofPoints`, `adFormat`, `contentFormat`, `angle`, `adStructure`, `creativeBrief`, `hookPackage`, and `status`.

Concept field reference:

| Field | What it changes |
|-------|-----------------|
| `title` | Concept display name. |
| `summary` | Short concept summary. |
| `targetAudience` | Intended audience for the concept. |
| `awarenessStage` | Buyer awareness stage. |
| `angleDescription` | Plain-language strategic angle. |
| `hookStyle` | Hook format/style. |
| `creativeDirection` | Visual and narrative direction. |
| `keyProofPoints` | Proof points to include in the script/storyboard. |
| `adFormat` / `contentFormat` | Format label depending on `contentIntent`. |
| `angle` | Structured strategy angle. |
| `adStructure` | Structured ad format. |
| `creativeBrief` | Concept-specific creative brief overrides. |
| `hookPackage` | Structured hook data for the concept. |
| `status` | Concept lifecycle status, such as `active` or `archived`. |

Response:

```typescript
SuccessResponse<VideoContentPlan>
```

### Generate More Video Plan Concepts

```http
POST /api/generations/video/plans/:planId/concepts/generate
```

Request:

```typescript
interface GenerateVideoConceptsRequest {
  guidance?: string;
  conceptCount?: number; // 1-6
  conceptQuality?: 'standard' | 'premium' | 'ultra' | null;
  referenceConceptId?: string;
}
```

Request field reference:

| Field | What it does |
|-------|--------------|
| `guidance` | Additional concept-generation instruction. |
| `conceptCount` | Number of new concepts to generate, 1-6. |
| `conceptQuality` | Generation depth/cost: `standard`, `premium`, or `ultra` when enabled. |
| `referenceConceptId` | Existing concept to riff from or branch off. |

Response:

```typescript
SuccessResponse<VideoContentPlan>
```

### Create Video Run From Plan

```http
POST /api/generations/video/plans/:planId/runs
```

Request:

```typescript
interface CreateVideoRunFromPlanRequest {
  conceptId?: string;
  providers?: {
    video?: string;
    image?: string;
    voiceover?: string;
    music?: string;
  };
}
```

Request field reference:

| Field | What it does |
|-------|--------------|
| `conceptId` | Concept to turn into a video run. If omitted, Nelos uses the plan's primary concept when available. |
| `providers.video` | Optional video provider override. |
| `providers.image` | Optional image/frame provider override. |
| `providers.voiceover` | Optional voiceover provider override. |
| `providers.music` | Optional music provider override. |

Response:

```typescript
SuccessResponse<VideoGenerationRun>
```

---

## Uploads

Use uploads when a partner has local creative files to send to Nelos. If the asset is already hosted at an HTTPS URL, skip upload and create a stimulus directly with `mediaUrl`.

### Sign Upload URL

```http
POST /api/uploads/sign
```

Auth: required.

Request:

```typescript
interface SignUploadRequest {
  fileName: string;
  contentType: string;
  productId?: string;
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `fileName` | yes | Original or desired filename. Used to derive the uploaded object name. |
| `contentType` | yes | MIME type that will be used for the signed upload. Send the same value in the upload `PUT` request. |
| `productId` | no | Associates the upload path with a product for organization and later product/stimulus linkage. |

Example:

```json
{
  "fileName": "ad-a.png",
  "contentType": "image/png",
  "productId": "product_abc123"
}
```

Response:

```typescript
// 200
SuccessResponse<{
  uploadUrl: string;
  publicUrl: string;
  objectName: string;
  expiresAt: string;
}>
```

Upload the file bytes to `uploadUrl` using `PUT` and the same `Content-Type`.

```bash
curl -X PUT "$SIGNED_UPLOAD_URL" \
  -H "Content-Type: image/png" \
  --data-binary "@ad-a.png"
```

Then create a stimulus using `publicUrl`.

### Delete Uploaded Object

```http
DELETE /api/uploads/object
```

Auth: required.

Request:

```json
{
  "objectName": "uploads/org_abc/product_abc/ad-a.png"
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `objectName` | yes | Storage object name returned by `POST /api/uploads/sign`. Nelos only deletes objects inside the authenticated org upload prefix. |

Response:

```typescript
// 200
SuccessResponse<{ objectName: string }>
// 403 if the object is outside the authenticated org upload prefix
```

---

## Stimuli

Stimuli are the assets that studies evaluate. Generated static and video outputs also become stimuli.

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

### List Stimuli

```http
GET /api/stimuli?studyId=study_abc123&type=image_ad
```

Query params:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `studyId` | string | no | Return stimuli attached to a study |
| `type` | string | no | Filter by stimulus type |

Response:

```typescript
// 200
SuccessResponse<{
  count: number;
  stimuli: Stimulus[];
}>
```

### Get Stimulus

```http
GET /api/stimuli/:id
```

Response:

```typescript
// 200
SuccessResponse<Stimulus>
// 404 if not found
```

### Create Stimulus From Hosted Asset

```http
POST /api/stimuli
```

Request:

```typescript
interface CreateStimulusRequest {
  name: string;
  type:
    | 'image_ad'
    | 'static_image'
    | 'video_ad'
    | 'video_ad_script'
    | 'tiktok_hook'
    | 'feature_concept'
    | 'product_copy'
    | 'email'
    | 'social_post'
    | 'animation';
  productId?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  mediaUrl?: string; // HTTPS URL or local /uploads/... URL
  script?: string;
  creativeStrategy?: Record<string, any>;
  geminiRegisteredUrl?: string;
  metadata?: Record<string, any>;
}
```

Example:

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

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `name` | yes | Human-readable asset name shown in studies and result views. |
| `type` | yes | Stimulus kind. Use `image_ad`/`static_image` for images and `video_ad` for completed videos. |
| `productId` | strongly recommended | Product association. Required for most study workflows because study stimuli must match the study product. |
| `primaryText` | no | Main ad body copy for image/static stimuli or partner-provided copy context. |
| `headline` | no | Ad headline. Used in study/result display and can inform evaluation. |
| `description` | no | Additional asset description or caption. |
| `mediaUrl` | required for media assets | HTTPS media URL or Nelos `/uploads/...` URL. Use this for images and videos. |
| `script` | no | Script text for script/hook/text stimulus types. |
| `creativeStrategy` | no | Structured strategy metadata retained with the stimulus. |
| `geminiRegisteredUrl` | no | Pre-registered media URL for Gemini-backed evaluation paths, when available. |
| `metadata` | no | Partner-owned metadata returned with the stimulus and useful for reconciliation. |

Response:

```typescript
// 201
SuccessResponse<Stimulus>
```

Validation notes:

- `name` and `type` are required.
- External `mediaUrl` values must use HTTPS.
- `type` cannot be changed after creation.
- Video stimuli may require media registration before they can be used in `videoCtrProxy` studies.

### Update Stimulus

```http
PUT /api/stimuli/:id
```

Request:

```typescript
type UpdateStimulusRequest = Partial<Omit<CreateStimulusRequest, 'type'>>;
```

Update field reference:

| Field | What it changes |
|-------|-----------------|
| `name` | Display name. |
| `productId` | Product association, subject to validation. |
| `primaryText`, `headline`, `description` | Copy/context fields used in study display and evaluation. |
| `mediaUrl` | Hosted creative asset URL. Must be HTTPS or a Nelos upload URL. |
| `script` | Script/hook text for text-like stimuli. |
| `creativeStrategy` | Structured strategy metadata. |
| `geminiRegisteredUrl` | Registered media reference when available. |
| `metadata` | Partner metadata. |

Example:

```json
{
  "headline": "Forecast with confidence",
  "primaryText": "Find deal risk before your board deck does."
}
```

Response:

```typescript
// 200
SuccessResponse<Stimulus>
// 400 if trying to change type
// 404 if not found
```

### Delete Stimulus

```http
DELETE /api/stimuli/:id
```

Response:

```typescript
// 200
SuccessResponse<{ id: string }>
```

Deleting a stimulus removes it from studies in the same org.

---

## Studies

Partners can run studies on uploaded assets, generated static ads, or generated videos.

### Study Types

```typescript
interface Study {
  id: string;
  orgId: string;
  productId: string;
  name: string;
  description?: string;
  objective?: 'purchase_intent' | 'ad_interest' | 'concept_fit';
  type?: 'screening' | 'deepDive';
  pipelineType: 'ctrProxy' | 'videoCtrProxy' | 'ama' | 'textHook' | 'evaluator';
  productName: string;
  productDescription?: string;
  customQuestion?: string;
  status: 'draft' | 'queued' | 'running' | 'completed' | 'failed' | string;
  personaIds: string[];
  stimulusIds: string[];
  generatedStimulusIds?: string[];
  runsPerPersonaPerStimulus: number;
  personaSample?: {
    enabled: boolean;
    size: number;
  };
  targetingGroups?: TargetingGroup[];
  eligibilityNotes?: string[];
  nonUsMarket?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface TargetingGroup {
  label?: string;
  weight?: number;
  rules: {
    ageMin?: number;
    ageMax?: number;
    sexes?: ('male' | 'female' | 'non-binary' | 'other')[];
    locations?: string[];
    states?: string[];
    countries?: string[];
    occupations?: string[];
    incomeBrackets?: string[];
    [key: string]: any;
  };
}
```

Pipeline guidance:

| Asset type | `pipelineType` |
|------------|----------------|
| Static/image ads | `ctrProxy` |
| Video ads | `videoCtrProxy` |
| Open-ended AMA-style feedback | `ama` |
| Text hooks | `textHook` |

### List Studies

```http
GET /api/studies?status=completed&objective=ad_interest&type=screening
```

Query params:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `status` | string | no | Filter by study status |
| `objective` | string | no | `purchase_intent`, `ad_interest`, or `concept_fit` |
| `type` | string | no | Study run type |

Response:

```typescript
// 200
SuccessResponse<{
  count: number;
  studies: Study[];
}>
```

### Get Study

```http
GET /api/studies/:id
```

Response:

```typescript
// 200
SuccessResponse<Study & {
  personas: any[];
  stimuli: Stimulus[];
  generatedStimuli: Stimulus[];
}>
// 404 if not found
```

### Create Study

```http
POST /api/studies
```

Request:

```typescript
interface CreateStudyRequest {
  productId: string;
  name?: string;
  description?: string;
  objective?: 'purchase_intent' | 'ad_interest' | 'concept_fit';
  type?: 'screening' | 'deepDive';
  pipelineType?: 'ctrProxy' | 'videoCtrProxy' | 'ama' | 'textHook' | 'evaluator';
  productName?: string;
  productDescription?: string;
  customQuestion?: string;
  personaIds?: string[];
  personaGroupIds?: string[];
  stimulusIds?: string[];
  runsPerPersonaPerStimulus?: number; // 1-100, default 1
  targetingPresetId?: string;
  targetingGroups?: TargetingGroup[];
  eligibilityNotes?: string[];
  nonUsMarket?: string | null;
  metadata?: Record<string, any>;
  callbackUrl?: string;
  callbackSecret?: string;
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `productId` | yes | Product being tested. Attached stimuli must belong to this product. |
| `name` | no | Study name. If omitted, Nelos derives a name from the product/context. |
| `description` | no | Study description for internal/result context. |
| `objective` | no | Study objective: `purchase_intent`, `ad_interest`, or `concept_fit`. |
| `type` | no | Study depth/type. `screening` is lighter; `deepDive` is more detailed when supported. |
| `pipelineType` | no | Evaluation pipeline. Use `ctrProxy` for static/image ads and `videoCtrProxy` for video ads. |
| `productName` | no | Product name snapshot for the study. Defaults from the product. |
| `productDescription` | no | Product description snapshot for evaluators. Defaults from the product. |
| `customQuestion` | no | Extra question/instruction for feedback-oriented pipelines. |
| `personaIds` | no | Explicit personas to include. |
| `personaGroupIds` | no | Persona groups to include. |
| `stimulusIds` | no | Uploaded or generated stimuli to test. Can also be attached later. |
| `runsPerPersonaPerStimulus` | no | Number of evaluator runs per persona/stimulus pair, 1-100. Higher values increase sample size/cost. |
| `targetingPresetId` | no | Saved targeting preset to apply, if configured. |
| `targetingGroups` | no | Inline targeting groups/rules. |
| `eligibilityNotes` | no | Human-readable eligibility constraints for participant/persona selection. |
| `nonUsMarket` | no | Non-US market note/label when the study is not US-focused. |
| `metadata` | no | Partner-owned metadata. |
| `callbackUrl` | no | Study completion webhook URL. |
| `callbackSecret` | no | Shared secret for webhook signature verification. |

Example:

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

Response:

```typescript
// 201
SuccessResponse<Study>
```

Rules:

- `productId` is required.
- All `stimulusIds` must exist, belong to the product, and have `productId` set.
- If `pipelineType` is omitted, Nelos infers it from stimulus media type.
- Image/static stimuli cannot be mixed with video stimuli in the same study.
- Video stimuli require `pipelineType: 'videoCtrProxy'`.

### Update Study

```http
PUT /api/studies/:id
```

Request: partial `CreateStudyRequest`.

Response:

```typescript
// 200
SuccessResponse<Study>
```

Notes:

- `status`, `orgId`, and server-managed sampling fields cannot be changed directly.
- Updating `pipelineType`, targeting, or personas may recompute persona sampling policy.

### Add Stimuli to Study

```http
POST /api/studies/:id/stimuli
```

```json
{
  "stimulusIds": ["stimulus_abc123", "stimulus_def456"]
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `stimulusIds` | yes | Existing stimulus IDs to attach to the study. Stimuli must belong to the study product and match the study media pipeline. |

Response:

```typescript
// 200
SuccessResponse<{
  study: Study;
  attachedStimuli: Stimulus[];
}>
```

### Remove Stimulus From Study

```http
DELETE /api/studies/:id/stimuli/:stimulusId
```

Response:

```typescript
// 200
SuccessResponse<{ studyId: string; stimulusId: string }>
```

### Add Generated Stimuli to Study

```http
POST /api/studies/:id/generated-stimuli
```

```json
{
  "stimulusIds": ["stimulus_generated_123"]
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `stimulusIds` | yes | Generated stimulus IDs to attach to the study's generated-stimuli list. |

Response:

```typescript
// 200
SuccessResponse<{
  study: Study;
  generatedStimuli: Stimulus[];
}>
```

### Remove Generated Stimulus From Study

```http
DELETE /api/studies/:id/generated-stimuli/:stimulusId
```

Response:

```typescript
// 200
SuccessResponse<{ studyId: string; stimulusId: string }>
```

### Start Sampling

Get confirmation:

```http
GET /api/studies/:id/sampling/confirm
```

Response:

```typescript
// 200
SuccessResponse<{
  studyId: string;
  status: string;
  stimulusCount: number;
  runsPerPair: number;
  personaSample: Study['personaSample'] | null;
  targetingGroups: TargetingGroup[];
  note: string;
}>
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

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `confirm.stimulusCount` | yes | Must match the latest confirmation response's `stimulusCount`. Prevents starting stale study configuration. |
| `confirm.runsPerPair` | yes | Must match the latest confirmation response's `runsPerPair`. Prevents accidental cost/sample-size changes. |

Response:

```typescript
// 200
SuccessResponse<{
  studyId: string;
  status: 'queued';
  nextStep: string;
}>
```

The `confirm` payload must match the latest confirmation response. If the study changes, fetch confirmation again.

### Run Targeted Sampling

This is a shortcut that updates targeting and queues sampling in one request.

```http
POST /api/studies/:id/sampling/targeted
```

Request:

```typescript
interface RunTargetedSamplingRequest {
  ageMin?: number;
  ageMax?: number;
  sexes?: ('male' | 'female' | 'non-binary' | 'other')[];
  runsPerPersonaPerStimulus?: number;
  groups?: Array<{
    label?: string;
    weight: number;
    ageMin?: number;
    ageMax?: number;
    sexes?: ('male' | 'female' | 'non-binary' | 'other')[];
  }>;
}
```

Request field reference:

| Field | Required | What it does |
|-------|----------|--------------|
| `ageMin` | no | Minimum age for simple targeting. |
| `ageMax` | no | Maximum age for simple targeting. |
| `sexes` | no | Simple sex/gender targeting values. |
| `runsPerPersonaPerStimulus` | no | Number of evaluator runs per persona/stimulus pair for this sampling start. |
| `groups` | no | Weighted targeting groups for multi-segment sampling. |
| `groups[].label` | no | Human-readable segment label. |
| `groups[].weight` | yes when group supplied | Relative sampling weight for the group. |
| `groups[].ageMin` / `groups[].ageMax` | no | Age range for that segment. |
| `groups[].sexes` | no | Sex/gender values for that segment. |

Response:

```typescript
// 200
SuccessResponse<{
  studyId: string;
  status: 'queued';
  nextStep: string;
  runsPerPair: number;
  targeting: Record<string, any>;
}>
```

### Study Status and Results

Poll:

```http
GET /api/studies/:id/sampling/status
```

Response:

```typescript
// 200
SuccessResponse<{
  studyId: string;
  status: string;
  currentStep: string | null;
  completedStepCount: number;
  completedSteps: string[];
  progressPercent: number;
  startedAt: string | null;
  elapsedSeconds: number;
  currentStepElapsedSeconds: number | null;
  failure?: {
    step?: string;
    error?: string;
    failedAt?: string;
  };
}>
```

SSE:

```http
GET /api/studies/:id/sampling/events
```

Use polling for API-key integrations unless your SSE client can send `Authorization`.

Results:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/studies/:id/results/ranking` | Get ranked stimuli |
| `GET` | `/api/studies/:id/results/themes` | Get reason themes |
| `GET` | `/api/studies/:id/results/demos` | Get demographic insights |
| `GET` | `/api/studies/:id/results/geo` | Get geographic insights |
| `GET` | `/api/studies/:id/results/segments` | Get behavioral segments |

Ranking response:

```typescript
SuccessResponse<{
  studyId: string;
  items: Array<{
    id: string;
    stimulusName: string;
    totalSamples: number;
    ctrProxyMean?: number;
    ctrProxyFitMean?: number;
    meanRating?: number;
  }>;
}>
```

Result endpoint guidance:

| Endpoint | Use when |
|----------|----------|
| `/results/ranking` | You need the winner/ordering across assets. This is the first result endpoint most partners should call. |
| `/results/themes` | You need qualitative reasons, clustered objections, hooks, or click/watch drivers. |
| `/results/demos` | You need demographic readouts by age/sex-style dimensions. |
| `/results/geo` | You need location-level readouts for positive responders. |
| `/results/segments` | You need behavioral or cluster-based audience segments. |

Themes response includes per-stimulus clusters such as `whyStopped`, `whyWatched`, `whyClicked`, and `whoClicked`, depending on pipeline type.

Demos response includes top demographic insights per stimulus, including `ageBucket`, `sex`, cluster insights, and archetypes.

Geo response includes top cities/states per stimulus for positive responders.

Segments response includes behavioral or cluster-based segments for the study.

### Study Samples

Use samples for drill-down analysis after a study has run.

```http
GET /api/studies/:id/samples?stimulusId=stimulus_abc123&limit=50&offset=0
```

Query params:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `stimulusId` | string | yes unless `segmentId` is set | Filter by stimulus |
| `segmentId` | string | yes unless `stimulusId` is set | Filter by segment |
| `dimension` | string | no | Segment/drilldown dimension |
| `stance` | string | no | Response stance filter |
| `clusterField` | string | no | Cluster field filter |
| `clusterId` | string | no | Cluster ID filter |
| `ageMin` | number | no | 1-120 |
| `ageMax` | number | no | 1-120 |
| `sex` | string | no | `male`, `female`, `non-binary`, `other` |
| `location` | string | no | Location search |
| `state` | string | no | Two-letter US state |
| `limit` | number | no | 1-100 |
| `offset` | number | no | Default 0 |
| `sort` | string | no | Server-supported sample sort |
| `refresh` | string | no | Server-supported refresh mode |

### Delete Study

```http
DELETE /api/studies/:id
```

Response:

```typescript
// 200
SuccessResponse<{ id: string }>
```

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
| `402` | Account or credit issue; contact Nelos support |
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

Recommended path by use case:

| Partner need | Use this |
|--------------|----------|
| "Generate me 10 statics and 2 videos for this product" | `POST /api/v1/managed-batches` |
| "I need to show/edit static concepts before rendering" | Direct static generation |
| "I need to control script, storyboard, voice, frames, clips, and export" | Direct video generation |
| "I need reusable video concepts before creating runs" | Video content plans |
| "I already have assets and just want testing" | Upload/create stimuli, create study, start sampling |
| "I need winners and insights after testing" | Study result endpoints |

Minimal managed-batch implementation:

1. Keep partner customer/workspace/campaign records in the partner app.
2. Create a Nelos product once per advertised product, or send `productUrl` in the batch request.
3. Send `requestedAssets.staticCount` and/or `requestedAssets.videoCount`.
4. Include `externalCustomerId`, `externalWorkspaceId`, and `externalCampaignId`.
5. Include an `Idempotency-Key` generated from the partner job ID.
6. Poll until `status` is `completed` or `failed`.
7. Save `assets[].stimulusId`, `assets[].mediaUrl`, and `assets[].metadata`.

Direct static implementation:

1. Create/reuse a product with brand context.
2. `POST /api/generations/static` with `productId`, `useBrandKit: true`, and `numOptions`.
3. Poll until `awaiting_selection`.
4. Optionally patch concepts.
5. `POST /api/generations/static/:id/render` with selected `conceptIds`.
6. Poll until `completed`.
7. Save `stimuli[].mediaUrl` and `result.generatedStimulusIds`.

Direct video implementation:

1. `GET /api/generations/video/options` and build UI controls from returned values.
2. `POST /api/generations/video` with product, format, duration, mode, audio, and creative brief.
3. Queue planning with `queuePlanning: true` or `POST /api/generations/video/:id/plan`.
4. Generate/edit script, storyboard, visual bible, and voiceover if the partner needs control.
5. Queue frame/clip/audio assets with `POST /api/generations/video/:id/assets`.
6. Poll until generated assets are ready.
7. `POST /api/generations/video/:id/export`.
8. Save `export.mediaUrl` and `export.stimulusId`.

Study implementation:

1. Use generated `stimulusId` values or create stimuli from hosted partner assets.
2. Create a study with the correct `pipelineType`.
3. Attach any additional stimuli.
4. Fetch sampling confirmation.
5. Start sampling using the exact confirmation values.
6. Poll `/sampling/status` until completed.
7. Read `/results/ranking` first, then themes/demos/geo/segments as needed.
