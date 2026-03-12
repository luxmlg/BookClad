import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus, BookOpen, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const projects = await prisma.coverProject.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      generations: {
        where: { status: "COMPLETED" },
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
        <Link href="/create" className={buttonVariants({ className: "gap-2" })}>
          <Plus className="size-4" />
          New Cover
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="py-16 text-center">
            <div className="mx-auto mb-4 rounded-full bg-primary/10 p-4">
              <BookOpen className="size-8 text-primary" />
            </div>
            <CardTitle>No covers yet</CardTitle>
            <CardDescription className="mx-auto max-w-sm">
              Create your first AI-generated book cover in minutes. Describe
              your book, pick a style, and let our AI do the rest.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Link
              href="/create"
              className={buttonVariants({ className: "gap-2" })}
            >
              <Plus className="size-4" />
              Create your first cover
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const thumbnail =
              project.generations[0]?.images[0]?.storageKey;
            return (
              <Card
                key={project.id}
                className="group relative overflow-hidden transition-shadow hover:shadow-lg"
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
                  </div>
                </Link>
                <CardHeader className="flex-row items-start justify-between p-4">
                  <Link href={`/editor/${project.id}`} className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {project.author} &middot; {(project.attributes as Record<string, unknown>)?.genre as string ?? ""}
                    </CardDescription>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="shrink-0 rounded-md p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link
                          href={`/editor/${project.id}`}
                          className="flex items-center gap-2"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DeleteProjectButton projectId={project.id} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
