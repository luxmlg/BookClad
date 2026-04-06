import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromStorage } from "@/lib/storage";
import { dodo } from "@/lib/dodo";
import { SUBSCRIPTION_STATUS } from "@/lib/constants";
import { getPostHogClient } from "@/lib/posthog-server";

export async function DELETE(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch user with all data that has storage keys
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: {
        dodoSubscriptionId: true,
        subscriptionStatus: true,
        projects: {
          select: {
            generations: {
              select: {
                images: { select: { storageKey: true } },
              },
            },
            assets: { select: { storageKey: true } },
            exports: { select: { storageKey: true } },
          },
        },
        fonts: { select: { storageKey: true } },
      },
    });

    // Collect all R2 storage keys
    const storageKeys: string[] = [];
    for (const project of user.projects) {
      for (const gen of project.generations) {
        for (const img of gen.images) {
          storageKeys.push(img.storageKey);
        }
      }
      for (const asset of project.assets) {
        storageKeys.push(asset.storageKey);
      }
      for (const exp of project.exports) {
        storageKeys.push(exp.storageKey);
      }
    }
    for (const font of user.fonts) {
      storageKeys.push(font.storageKey);
    }

    // Best-effort cancel active DodoPayments subscription
    if (user.dodoSubscriptionId && user.subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE) {
      try {
        await dodo.subscriptions.update(user.dodoSubscriptionId, {
          status: "cancelled",
        });
      } catch {
        // Proceed regardless — best effort
      }
    }

    // Capture account_deleted before deleting the user record
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: session.user.id,
      event: "account_deleted",
      properties: {
        had_active_subscription: user.dodoSubscriptionId !== null && user.subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE,
      },
    });
    await posthog.shutdown();

    // Delete user — Prisma cascade handles all related records
    await prisma.user.delete({ where: { id: session.user.id } });

    // Clean up R2 storage in background
    Promise.all(storageKeys.map((key) => deleteFromStorage(key))).catch(
      () => {},
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
