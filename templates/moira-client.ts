/**
 * Moira API Client — TypeScript Template
 * ========================================
 * Drop-in client for integrating with the Moira backend API.
 *
 * Usage:
 *   const moira = new MoiraClient({ apiKey: "moira_user_...", baseUrl: "https://your-host" });
 *   const product = await moira.products.create({ name: "...", category: "ecommerce", description: "..." });
 *   const concepts = await moira.generate.conceptPlan({ productId: product.id, useBrandKit: true });
 *   const { stimuli } = await moira.generate.renderAds({ productId: product.id, concepts });
 *   const study = await moira.studies.create({ productId: product.id, stimulusIds: stimuli.map(s => s.id) });
 *   await moira.studies.startSampling(study.id);
 *   await moira.studies.pollUntilComplete(study.id);
 *   const results = await moira.studies.getRankingResults(study.id);
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ProductCategory = "ecommerce" | "food" | "travel" | "other";
export type StimulusType =
  | "image_ad" | "static_image" | "video_ad" | "video_ad_script"
  | "tiktok_hook" | "text_hook" | "feature_concept" | "product_copy"
  | "email" | "social_post";
export type PipelineType = "ctrProxy" | "videoCtrProxy" | "textHook";
export type StudyObjective = "ad_interest" | "purchase_intent" | "concept_fit" | "ad_evaluation";
export type StudyStatus = "draft" | "running" | "completed" | "failed";
export type Sex = "male" | "female" | "non-binary" | "other";
export type AspectRatio = "1:1" | "9:16" | "4:5" | "16:9" | "1.91:1";

export interface ProductAsset {
  url: string;
  objectName?: string;
  contentType?: string;
}

export interface ProductBranding {
  logo?: ProductAsset;
  colorPalette?: string[];
  fontFamilies?: string[];
  referenceImages?: ProductAsset[];
  typographyReference?: ProductAsset;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  websiteUrl?: string;
  features?: string[];
  branding?: ProductBranding;
  createdAt: string;
  updatedAt: string;
}

export interface Stimulus {
  id: string;
  name: string;
  type: StimulusType;
  mediaUrl?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  script?: string;
  productId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptPlan {
  name: string;
  headline: string;
  primaryText: string;
  reasoning: { strategy: string; visualDirection: string };
}

export interface Study {
  id: string;
  name: string;
  objective?: StudyObjective;
  pipelineType?: PipelineType;
  productId: string;
  stimulusIds: string[];
  status: StudyStatus;
  runsPerPersonaPerStimulus: number;
  personaSample?: { enabled: boolean; size: number };
  createdAt: string;
  updatedAt: string;
}

export interface SamplingStatus {
  studyId: string;
  status: StudyStatus;
  currentStep: string | null;
  progressPercent: number;
  elapsedSeconds: number;
  currentStepElapsedSeconds: number | null;
  failure?: { step: string; error: string | null; failedAt: string | null };
}

export interface RankingItem {
  _id: string;
  stimulusName: string;
  totalSamples: number;
  ctrProxyMean?: number;
  ctrProxyFitMean?: number;
  meanRating?: number;
}

export interface SignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  objectName: string;
  expiresAt: string;
}

// ─────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────

export interface MoiraClientOptions {
  apiKey: string;
  baseUrl: string;
}

export class MoiraClient {
  private headers: Record<string, string>;
  private baseUrl: string;

  constructor({ apiKey, baseUrl }: MoiraClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = json?.message || `HTTP ${res.status}`;
      throw new Error(`[Moira API] ${method} ${path} → ${msg}`);
    }
    return json.data as T;
  }

  private get = <T>(path: string) => this.request<T>("GET", path);
  private post = <T>(path: string, body: unknown) => this.request<T>("POST", path, body);
  private put = <T>(path: string, body: unknown) => this.request<T>("PUT", path, body);
  private del = <T>(path: string) => this.request<T>("DELETE", path);

  // ── Products ──────────────────────────────

  products = {
    list: () => this.get<{ count: number; products: Product[] }>("/api/products"),

    get: (id: string) => this.get<Product>(`/api/products/${id}`),

    create: (data: {
      name: string;
      category: ProductCategory;
      description: string;
      websiteUrl?: string;
      features?: string[];
      branding?: ProductBranding;
    }) => this.post<Product>("/api/products", data),

    update: (id: string, data: Partial<{ name: string; description: string; branding: ProductBranding }>) =>
      this.put<Product>(`/api/products/${id}`, data),

    delete: (id: string) => this.del<{ id: string }>(`/api/products/${id}`),
  };

  // ── Ad Generation ─────────────────────────

  generate = {
    conceptPlan: (data: {
      productId?: string;
      stimulusIds?: string[];
      useBrandKit?: boolean;
      numOptions?: number;
      customPrompt?: string;
    }) => this.post<{ conceptPlans: ConceptPlan[]; product: { id: string; name: string } }>(
      "/api/generate/ads/plan",
      data
    ),

    renderAds: (data: {
      productId?: string;
      stimulusIds?: string[];
      concepts: ConceptPlan[];
      useBrandKit?: boolean;
      aspectRatio?: AspectRatio;
      aspectRatios?: AspectRatio[];
      customPrompt?: string;
    }) => this.post<{ stimuli: Stimulus[]; failedConcepts: unknown[]; generatedCount: number }>(
      "/api/generate/ads/render",
      data
    ),

    productBranding: (data: {
      productId: string;
      count?: number;
      customPrompt?: string;
      aspectRatios?: AspectRatio[];
    }) => this.post<{ stimuli: Stimulus[] }>("/api/generate/product-branding", data),
  };

  // ── Stimuli ───────────────────────────────

  stimuli = {
    list: (params?: { studyId?: string; type?: StimulusType }) => {
      const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
      return this.get<{ count: number; stimuli: Stimulus[] }>(`/api/stimuli${qs}`);
    },

    get: (id: string) => this.get<Stimulus>(`/api/stimuli/${id}`),

    create: (data: {
      name: string;
      type: StimulusType;
      mediaUrl?: string;
      primaryText?: string;
      headline?: string;
      productId?: string;
      metadata?: Record<string, unknown>;
    }) => this.post<Stimulus>("/api/stimuli", data),

    update: (id: string, data: Omit<Partial<Stimulus>, "type" | "id">) =>
      this.put<Stimulus>(`/api/stimuli/${id}`, data),

    delete: (id: string) => this.del<{ id: string }>(`/api/stimuli/${id}`),
  };

  // ── Studies ───────────────────────────────

  studies = {
    list: (params?: { status?: StudyStatus; objective?: StudyObjective }) => {
      const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
      return this.get<{ count: number; studies: Study[] }>(`/api/studies${qs}`);
    },

    get: (id: string) => this.get<Study>(`/api/studies/${id}`),

    create: (data: {
      productId: string;
      stimulusIds?: string[];
      name?: string;
      objective?: StudyObjective;
      pipelineType?: PipelineType;
      runsPerPersonaPerStimulus?: number;
      personaSample?: { enabled: boolean; size: number };
      callbackUrl?: string;
      callbackSecret?: string;
      nonUsMarket?: string;
      eligibilityNotes?: string[];
    }) => this.post<Study>("/api/studies", data),

    update: (id: string, data: Partial<Study>) =>
      this.put<Study>(`/api/studies/${id}`, data),

    delete: (id: string) => this.del<{ id: string }>(`/api/studies/${id}`),

    addStimuli: (id: string, stimulusIds: string[]) =>
      this.post<{ study: Study; attachedStimuli: Stimulus[] }>(
        `/api/studies/${id}/stimuli`,
        { stimulusIds }
      ),

    removeStimulus: (id: string, stimulusId: string) =>
      this.del<{ message: string }>(`/api/studies/${id}/stimuli/${stimulusId}`),

    getSamplingConfirmation: (id: string) =>
      this.get<{ personaCount: number; stimulusCount: number; totalRequests: number }>(
        `/api/studies/${id}/sampling/confirm`
      ),

    startSampling: async (id: string) => {
      const confirmation = await this.studies.getSamplingConfirmation(id);
      return this.post(`/api/studies/${id}/sampling/start`, { confirm: confirmation });
    },

    getSamplingStatus: (id: string) =>
      this.get<SamplingStatus>(`/api/studies/${id}/sampling/status`),

    pollUntilComplete: async (
      id: string,
      options?: { intervalMs?: number; onProgress?: (status: SamplingStatus) => void }
    ): Promise<SamplingStatus> => {
      const interval = options?.intervalMs ?? 10_000;
      while (true) {
        const status = await this.studies.getSamplingStatus(id);
        options?.onProgress?.(status);
        if (status.status === "completed") return status;
        if (status.status === "failed") {
          throw new Error(`Study failed at step '${status.failure?.step}': ${status.failure?.error}`);
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    },

    getRankingResults: (id: string) =>
      this.get<{ studyId: string; items: RankingItem[] }>(
        `/api/studies/${id}/results/ranking`
      ),

    getThemeResults: (id: string) =>
      this.get<unknown>(`/api/studies/${id}/results/themes`),

    getDemoResults: (id: string) =>
      this.get<unknown>(`/api/studies/${id}/results/demos`),

    getSegmentResults: (id: string) =>
      this.get<unknown>(`/api/studies/${id}/results/segments`),

    getGeoResults: (id: string) =>
      this.get<unknown>(`/api/studies/${id}/results/geo`),
  };

  // ── Uploads ───────────────────────────────

  uploads = {
    sign: (fileName: string, contentType: string) =>
      this.post<SignedUploadResponse>("/api/uploads/sign", { fileName, contentType }),

    uploadFile: async (file: Blob, fileName: string, contentType: string): Promise<string> => {
      const { uploadUrl, publicUrl } = await this.uploads.sign(fileName, contentType);
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      return publicUrl;
    },
  };

  // ── Health ────────────────────────────────

  health = () =>
    this.get<{ status: string; timestamp: string; uptime: number }>("/health");
}
