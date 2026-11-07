import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "@/lib/db";
import { synthesizeSpeech } from "@/lib/tts";
import { parseJson } from "@/lib/types";
import { renderizarMp4 } from "./mp4";
import { saveSocialAudio, saveSocialVideo } from "./storage";
import { socialPlanSchema, type SocialRenderProps } from "./types";

export async function processNextSocialRender(contentId?: string) {
  const content = await prisma.socialContent.findFirst({
    where: contentId ? { id: contentId } : { status: "approved" },
    include: { dossier: { include: { album: { include: { artist: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (!content) return null;
  if (!contentId && content.status !== "approved") return null;
  if (contentId && !["approved", "failed"].includes(content.status)) {
    throw new Error(`La pieza ${content.id} está en estado ${content.status}; debe estar aprobada o fallida.`);
  }

  await prisma.socialContent.update({
    where: { id: content.id },
    data: { status: "rendering", error: null },
  });

  const output = path.join(tmpdir(), `musicart-social-${content.id}.mp4`);
  try {
    let audioUrl = content.audioUrl;
    if (!audioUrl) {
      audioUrl = await saveSocialAudio(content.id, await synthesizeSpeech(content.script));
      await prisma.socialContent.update({ where: { id: content.id }, data: { audioUrl } });
    }

    const sceneData = parseJson<{ durationSec?: number; scenes?: unknown[] }>(content.scenesJson, {});
    const plan = socialPlanSchema.parse({
      hook: content.hook,
      script: content.script,
      caption: content.caption,
      durationSec: sceneData.durationSec,
      scenes: sceneData.scenes,
    });
    const props: SocialRenderProps = {
      ...plan,
      albumTitle: content.dossier.album.title,
      artistName: content.dossier.album.artist.name,
      year: content.dossier.album.year,
      audioUrl,
      coverUrl: content.dossier.album.coverUrl,
      folio: content.id.slice(-6).toUpperCase(),
    };

    await renderizarMp4(props, output);
    const videoUrl = await saveSocialVideo(content.id, output);
    return await prisma.socialContent.update({
      where: { id: content.id },
      data: { status: "ready", videoUrl, error: null },
    });
  } catch (error) {
    await prisma.socialContent.update({
      where: { id: content.id },
      data: { status: "failed", error: (error as Error).message.slice(0, 1000) },
    });
    throw error;
  } finally {
    await unlink(output).catch(() => {});
  }
}

