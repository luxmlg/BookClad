"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface PostHogIdentifierProps {
  userId: string;
  email: string | null | undefined;
  name: string | null | undefined;
}

export function PostHogIdentifier({ userId, email, name }: PostHogIdentifierProps) {
  useEffect(() => {
    posthog.identify(userId, {
      email: email ?? undefined,
      name: name ?? undefined,
    });
  }, [userId, email, name]);

  return null;
}
