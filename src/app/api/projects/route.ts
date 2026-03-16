import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectSchema } from "@/lib/validations";
import { GENERATION_STATUS } from "@/lib/constants";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    return NextResponse.json(projects);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, author, attributes } = parsed.data;

    const project = await prisma.coverProject.create({
      data: {
        userId: session.user.id,
        title,
        author,
        attributes,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
