import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { EditorShell } from "@/components/editor/editor-shell";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;

  const project = await prisma.coverProject.findFirst({
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
  });

  if (!project) notFound();

  return <EditorShell project={project} />;
}
