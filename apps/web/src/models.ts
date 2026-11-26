export type DemoMode = "kane";

export type Job = {
  id: string;
  mode: DemoMode | string;
  status: string;
  step: string | null;
  abort_code: string | null;
  error: string | null;
  artifacts: Array<{ type: string; url?: string; object_key?: string; mime_type?: string }>;
  input: {
    website_url: string;
    job_type?: "product_short" | "website_short" | "walkthrough";
    script?: string;
    walkthrough?: string[];
    product_name?: string;
    ad_style?: "director" | "depth" | "reel" | "classic";
    ad_theme?: "auto" | "pop" | "noir" | "editorial" | "neon";
    aspect_ratio?: "9:16" | "1:1" | "4:5" | "16:9";
    variant_action?: string;
    voiceover_enabled?: boolean;
  };
  parent_job_id?: string | null;
  kane_credits?: number | null;
  created_at?: string;
  compare?: Job | null;
};

export type Ev = { seq: number; kind: string; payload: Record<string, unknown>; ts: string };

export type PipelineStep = {
  key: string;
  label: string;
  detail: string;
};
