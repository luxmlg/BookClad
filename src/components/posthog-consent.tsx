"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { useCookieConsent } from "./cookie-consent";

export function PostHogConsent() {
  const { consent } = useCookieConsent();

  useEffect(() => {
    if (consent === "accepted") {
      posthog.set_config({ persistence: "localStorage+cookie" });
    }
  }, [consent]);

  return null;
}
