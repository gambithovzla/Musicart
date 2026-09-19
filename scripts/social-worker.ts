import { processNextSocialRender } from "../src/lib/social/render";

const args = process.argv.slice(2);
const idIndex = args.indexOf("--id");
const contentId = idIndex >= 0 ? args[idIndex + 1] : undefined;

async function main() {
  const result = await processNextSocialRender(contentId);
  if (!result) {
    console.log("No hay piezas sociales aprobadas pendientes.");
    return;
  }
  console.log(`✓ Video social listo: ${result.videoUrl}`);
}

main()
  .catch((error) => {
    console.error("[social-worker]", error);
    process.exitCode = 1;
  });

