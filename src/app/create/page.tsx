import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BriefWizard } from "@/components/wizard/brief-wizard";

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Create a New Cover</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us about your book and we&apos;ll generate cover options for you.
        </p>
      </div>
      <BriefWizard />
    </div>
  );
}
