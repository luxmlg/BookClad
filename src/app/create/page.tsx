import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreatePageClient } from "@/components/wizard/create-page-client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tier: true, creditBalance: true },
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Create a New Cover</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us about your book and we&apos;ll generate cover options for you.
        </p>
      </div>
      <CreatePageClient tier={user.tier} creditBalance={user.creditBalance} />
    </div>
  );
}
