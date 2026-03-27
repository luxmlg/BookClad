import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">Settings</h1>
      <p className="mb-8 text-muted-foreground">
        Manage your attributes, custom values, and style presets.
      </p>
      <SettingsClient />
    </div>
  );
}
