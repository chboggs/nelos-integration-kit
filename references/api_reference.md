# Moira API Reference

Complete endpoint reference for the Moira backend API. All authenticated endpoints require `Authorization: Bearer <token>` (Supabase JWT or `moira_user_...` API key). All responses follow the shape `{ success: true, data: <T> }` on success and `{ success: false, message: string, errors?: [] }` on failure.

---

## Authentication

| Endpoint | Method | Auth Required | Description |
|---|---|---|---|
| `/api/users/me/api-key` | POST | Supabase JWT | Generate a user API key (returned once, store securely) |
| `/api/users/me` | GET | Yes | Get current user profile + org summary |
| `/api/users/me` | PUT | Yes | Update user profile (`name` only) |

---

## Products

| Endpoint | Method | Description |
|---|---|---|
| `/api/products` | GET | List all products for org |
| `/api/products/:id` | GET | Get a single product |
| `/api/products` | POST | Create a product |
| `/api/products/:id` | PUT | Update a product |
| `/api/products/:id` | DELETE | Delete a product |
| `/api/products/categories` | GET | List valid product categories |
| `/api/products/:id/brand-imports` | POST | Start an AI brand import from a URL |
| `/api/products/:id/brand-imports/:importId` | GET | Poll brand import status |
| `/api/products/:id/brand-imports/:importId/apply` | POST | Apply selected brand import suggestions to product |

### Create Product — Required Fields
```json
{
  "name": "string (required)",
  "category": "ecommerce | food | travel | other (required)",
  "description": "string (required)",
  "websiteUrl": "https://... (optional)",
  "features": ["string", "..."] ,
  "branding": {
    "logo":               { "url": "https://...", "objectName": "optional" },
    "colorPalette":       ["#RRGGBB"],
    "fontFamilies":       ["Inter"],
    "referenceImages":    [{ "url": "https://..." }],
    "typographyReference":{ "url": "https://..." },
    "notes":              "string"
  }
}
```

### Brand Import Flow
1. `POST /api/products/:id/brand-imports` with `{ "sourceUrl": "https://..." }` — starts async AI extraction
2. `GET /api/products/:id/brand-imports/:importId` — poll until `status === "completed"`; response includes `suggestions` (logoUrl, colorPalette, fontFamilies, referenceImageUrls)
3. `POST /api/products/:id/brand-imports/:importId/apply` with selected fields to write them to the product

---

## Ad Generation

All endpoints require org auth. Currently only image generation is supported.

| Endpoint | Method | Description |
|---|---|---|
| `/api/generate/ads/plan` | POST | Generate AI concept plans (copy + visual direction) |
| `/api/generate/ads/render` | POST | Render ads from concepts; **auto-creates Stimulus records** |
| `/api/generate/static-ad/copy-plan` | POST | Generate static ad copy plans only (no image render) |
| `/api/generate/product-branding` | POST | Generate product branding images using brand kit |

### `POST /api/generate/ads/plan`
```json
{
  "productId": "product_xxx (required unless stimulusIds provided)",
  "stimulusIds": ["stimulus_xxx"],
  "useBrandKit": true,
  "numOptions": 3,
  "customPrompt": "Focus on durability.",
  "theme": { "name": "...", "description": "..." },
  "themes": [{ "name": "...", "description": "..." }]
}
```
Returns: `{ conceptPlans: [{ name, headline, primaryText, reasoning: { strategy, visualDirection } }], ... }`

### `POST /api/generate/ads/render`
```json
{
  "productId": "product_xxx",
  "stimulusIds": ["stimulus_xxx"],
  "useBrandKit": true,
  "concepts": [{ "name": "...", "headline": "...", "primaryText": "...", "reasoning": {} }],
  "aspectRatio": "1:1",
  "aspectRatios": ["1:1", "9:16"],
  "customPrompt": "optional"
}
```
Valid aspect ratios: `1:1` | `9:16` | `4:5` | `16:9` | `1.91:1`

Returns: `{ stimuli: [Stimulus], failedConcepts: [...], generatedCount, requestedCount }`

**Note:** Stimuli are created automatically. Pass their `id` values directly into a study.

---

## Stimuli

| Endpoint | Method | Description |
|---|---|---|
| `/api/stimuli` | GET | List stimuli (filter by `studyId`, `type`) |
| `/api/stimuli/:id` | GET | Get a single stimulus |
| `/api/stimuli` | POST | Create a stimulus |
| `/api/stimuli/:id` | PUT | Update a stimulus (`type` is immutable) |
| `/api/stimuli/:id` | DELETE | Delete a stimulus (removes from all studies) |

### Stimulus Types and Pipeline Mapping
| Stimulus Type | Pipeline Type |
|---|---|
| `image_ad`, `static_image` | `ctrProxy` |
| `video_ad` | `videoCtrProxy` |
| `tiktok_hook`, `text_hook` | `textHook` |
| `feature_concept`, `product_copy`, `email`, `social_post` | (no pipeline, use for copy testing) |

**Do not mix image, video, and text hook stimuli in the same study.**

### Create Stimulus
```json
{
  "name": "string (required)",
  "type": "image_ad | static_image | video_ad | tiktok_hook | text_hook | feature_concept | product_copy | email | social_post (required)",
  "mediaUrl": "https://... (for image_ad, static_image, video_ad)",
  "primaryText": "string",
  "headline": "string",
  "description": "string",
  "script": "string (for video_ad_script)",
  "productId": "product_xxx",
  "metadata": {}
}
```

---

## Studies

| Endpoint | Method | Description |
|---|---|---|
| `/api/studies` | GET | List studies (filter by `status`, `objective`, `type`) |
| `/api/studies/:id` | GET | Get a single study (populated) |
| `/api/studies` | POST | Create a study |
| `/api/studies/:id` | PUT | Update a study |
| `/api/studies/:id` | DELETE | Delete a study and all samplings |
| `/api/studies/:id/stimuli` | POST | Add stimuli to a study |
| `/api/studies/:id/stimuli/:stimulusId` | DELETE | Remove a stimulus from a study |
| `/api/studies/:id/sampling/confirm` | GET | Get sampling cost summary |
| `/api/studies/:id/sampling/start` | POST | Start sampling |
| `/api/studies/:id/sampling/targeted` | POST | Run targeted sampling with demographic filters |
| `/api/studies/:id/sampling/status` | GET | Poll sampling progress |
| `/api/studies/:id/sampling/events` | GET | SSE stream of live progress events |
| `/api/studies/:id/results/ranking` | GET | Ranking results (after sampling) |
| `/api/studies/:id/results/themes` | GET | Theme/cluster results (after clustering) |
| `/api/studies/:id/results/demos` | GET | Demographic insights (after clustering) |
| `/api/studies/:id/results/segments` | GET | Behavioral segments (after segmentation) |
| `/api/studies/:id/results/geo` | GET | Geo results (after sampling) |
| `/api/studies/:id/chat/messages` | POST | Post a chat message about the study |
| `/api/studies/:id/chat/messages` | GET | Get chat history (requires `sessionId` query param) |
| `/api/studies/public/:id` | GET | Public study metadata (no auth) |
| `/api/studies/public/:id/results/*` | GET | Public result endpoints (no auth) |

### Create Study
```json
{
  "productId": "product_xxx (required)",
  "name": "string (optional, auto-generated if omitted)",
  "objective": "ad_interest | purchase_intent | concept_fit | ad_evaluation (optional)",
  "stimulusIds": ["stimulus_xxx"],
  "pipelineType": "ctrProxy | videoCtrProxy | textHook (optional, inferred from stimuli)",
  "runsPerPersonaPerStimulus": 5,
  "personaSample": { "enabled": true, "size": 300 },
  "callbackUrl": "https://... (optional webhook on completion)",
  "callbackSecret": "string (optional HMAC secret)",
  "nonUsMarket": "India (optional, omit for US)",
  "eligibilityNotes": ["Must be a homeowner"]
}
```

### Sampling Status Payload
```json
{
  "studyId": "study_xxx",
  "status": "draft | running | completed | failed",
  "currentStep": "sampling | clustering | segmentation | archetypes | null",
  "progressPercent": 0,
  "elapsedSeconds": 0,
  "currentStepElapsedSeconds": 0,
  "failure": { "step": "...", "error": "...", "failedAt": "..." }
}
```

### Targeted Sampling
```json
{
  "ageMin": 25,
  "ageMax": 45,
  "sexes": ["male", "female", "non-binary", "other"],
  "runsPerPersonaPerStimulus": 3,
  "groups": [
    { "label": "Young Adults", "weight": 60, "ageMin": 18, "ageMax": 30, "sexes": ["male"] },
    { "label": "Middle Age",   "weight": 40, "ageMin": 31, "ageMax": 50, "sexes": ["female"] }
  ]
}
```

---

## Personas

| Endpoint | Method | Description |
|---|---|---|
| `/api/personas` | GET | List personas (filter by `sex`, `location`, `tags`) |
| `/api/personas/:id` | GET | Get a single persona |
| `/api/personas` | POST | Create a persona |
| `/api/personas/:id` | PUT | Update a persona |
| `/api/personas/:id` | DELETE | Delete a persona |

### Create Persona
```json
{
  "age": 32,
  "sex": "male | female | non-binary | other",
  "location": "New York, NY",
  "occupation": "Software Engineer",
  "label": "Tech Early Adopter",
  "extraNotes": "Loves gadgets.",
  "tags": ["tech", "urban"],
  "promptProfile": "age_sex | age_sex_location | age_sex_location_occupation"
}
```

---

## Persona Groups

| Endpoint | Method | Description |
|---|---|---|
| `/api/persona-groups` | GET | List all persona groups |
| `/api/persona-groups/:id` | GET | Get a single group |
| `/api/persona-groups/:id/personas` | GET | Get group with full persona objects |
| `/api/persona-groups` | POST | Create a group |
| `/api/persona-groups/from-study/:studyId` | POST | Create group from a study's personas |
| `/api/persona-groups/sample` | POST | Create group by random sampling |
| `/api/persona-groups/:id` | PUT | Update a group |
| `/api/persona-groups/:id` | DELETE | Delete a group |
| `/api/persona-groups/:id/personas` | POST | Add personas to group |
| `/api/persona-groups/:id/personas` | DELETE | Remove personas from group |

---

## Uploads

| Endpoint | Method | Description |
|---|---|---|
| `/api/uploads/sign` | POST | Get a signed upload URL |
| `/api/uploads/local/:objectName` | PUT | Upload to local filesystem (dev only) |

### Signed Upload Flow
```json
// POST /api/uploads/sign
{ "fileName": "ad-a.png", "contentType": "image/png" }

// Response
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "publicUrl": "https://storage.googleapis.com/...",
  "objectName": "uploads/...",
  "expiresAt": "2026-..."
}
```
Then `PUT` the file binary to `uploadUrl` with `Content-Type` header. Use `publicUrl` as `mediaUrl` in stimuli or product branding.

---

## Billing

| Endpoint | Method | Description |
|---|---|---|
| `/api/billing/subscription` | GET | Current subscription + `creditsRemaining` |
| `/api/billing/transactions` | GET | Paginated credit ledger |
| `/api/billing/checkout` | POST | Stripe checkout session for `starter` or `pro` plan |
| `/api/billing/addon` | POST | Stripe add-on checkout session |
| `/api/billing/portal` | POST | Stripe billing portal session |

**Notes:**
- `scale` plan is sales-managed and not available via self-serve checkout.
- Billing errors at study start: `402` with `code: "INSUFFICIENT_CREDITS"` or `code: "SUBSCRIPTION_BLOCKED"`.

---

## Orgs

| Endpoint | Method | Description |
|---|---|---|
| `/api/orgs` | POST | Create an org (user must not already belong to one) |
| `/api/orgs/:id` | GET | Get org details |
| `/api/orgs/:id` | PUT | Update org name |
| `/api/orgs/:id/members` | GET | List org members |

---

## Health

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | None | Returns `{ status: "ok", timestamp, uptime, environment }` |
