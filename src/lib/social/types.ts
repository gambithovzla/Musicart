import { z } from "zod";

export const socialSceneSchema = z.object({
  startSec: z.number().min(0).max(40),
  endSec: z.number().min(0).max(40),
  kind: z.enum(["hook", "album", "context", "payoff", "cta"]),
  headline: z.string().min(1).max(140),
  body: z.string().max(240).optional().default(""),
  sourceRefs: z.array(z.string().max(100)).max(8).default([]),
});

export const socialPlanSchema = z.object({
  hook: z.string().min(8).max(140),
  script: z.string().min(80).max(900),
  caption: z.string().min(20).max(1000),
  durationSec: z.number().int().min(25).max(40),
  scenes: z.array(socialSceneSchema).min(4).max(6),
});

export type SocialScene = z.infer<typeof socialSceneSchema>;
export type SocialPlan = z.infer<typeof socialPlanSchema>;

export type SocialVerification = {
  ok: boolean;
  hardErrors: string[];
  unsupportedClaims: string[];
  method: "llm_and_code" | "verified_dossier_fallback";
};

export type SocialRenderProps = SocialPlan & {
  albumTitle: string;
  artistName: string;
  year: number;
  audioUrl?: string | null;
  folio: string;
};

