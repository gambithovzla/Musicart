import { auth } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEVICE_COOKIE } from "@/lib/device";
import { mergeDeviceToUser } from "@/lib/merge-device";

export default async function EntrarCompletadoPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value ?? "";
  if (deviceId) {
    await mergeDeviceToUser(session.user.id, deviceId);
  }

  const dest = next?.startsWith("/") && !next.startsWith("//") ? next : "/perfil";
  redirect(dest);
}
