import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus, BookOpen, MoreHorizontal, Pencil, Coins } from "lucide-react";
import { GENRES, GENERATION_STATUS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteProjectButton } from "@/components/dashboard/delete-project-button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { creditBalance: true, tier: true },
  });

  const projects = await prisma.coverProject.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      generations: {
        where: { status: GENERATION_STATUS.COMPLETED },
        include: { images: { where: { selected: true }, take: 1 } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Covers</h1>
          <p className="text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5">
          <Coins className="size-4 text-yellow-500" />
          <span className="text-sm font-medium">{user?.creditBalance ?? 0} credits</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/create">
          <Card className="group border-dashed p-0 hover:border-primary/50 hover:shadow-lg transition-all">
            <div className="relative aspect-5/8 flex flex-col items-center justify-center gap-3 text-muted-foreground group-hover:text-primary transition-colors">
              <Plus className="size-10" />
              <span className="text-sm font-medium">New Cover</span>
            </div>
          </Card>
        </Link>
        {projects.map((project) => {
            const thumbnail =
              project.generations[0]?.images[0]?.storageKey;
            return (
              <Card
                key={project.id}
                className="group relative overflow-hidden p-0 transition-shadow hover:shadow-lg"
              >
                <Link href={`/editor/${project.id}`}>
                  <div className="relative aspect-5/8 bg-linear-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden">
                    {thumbnail ? (
                      <Image
                        src={`/api/uploads/${thumbnail}`}
                        alt={`${project.title} cover`}
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <BookOpen className="size-10 text-muted-foreground/40" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
                      <h3 className="truncate text-sm font-medium text-white">
                        {project.title}
                      </h3>
                      <p className="truncate text-xs text-white/70">
                        {project.author} &middot; {GENRES.find((g) => g.value === (project.attributes as Record<string, unknown>)?.genre)?.label ?? ""}
                      </p>
                    </div>
                  </div>
                </Link>
                <div className="absolute top-2 right-2 z-10">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="rounded-md bg-black/50 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link href={`/editor/${project.id}`}>
                        <DropdownMenuItem>
                          <Pencil className="size-3.5" />
                          Edit
                        </DropdownMenuItem>
                      </Link>
                      <DeleteProjectButton projectId={project.id} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
        })}
      </div>
    </div>
  );
}
