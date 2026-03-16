import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { EditorShell } from "@/components/editor/editor-shell";
import { ensureInitialCredits } from "@/lib/credits";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;

  const [project, user] = await Promise.all([
    prisma.coverProject.findFirst({
      where: { id, userId: session.user.id },
      include: {
        generations: {
          include: {
            images: true,
            parentImage: { select: { id: true, storageKey: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { showPrompt: true, tier: true, creditBalance: true },
    }),
  ]);

  if (!project) notFound();

  await ensureInitialCredits(session.user.id, user?.tier ?? "FREE");

  return (
    <EditorShell
      project={project}
      showPrompt={user?.showPrompt ?? false}
      initialCreditBalance={user?.creditBalance ?? 0}
    />
  );
}
