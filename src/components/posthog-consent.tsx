"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { useCookieConsent } from "./cookie-consent";

export function PostHogConsent() {
  const { consent } = useCookieConsent();

  useEffect(() => {
    if (consent === "accepted") {
      posthog.set_config({ persistence: "localStorage+cookie" });
      posthog.opt_in_capturing();
    } else if (consent === "declined") {
      posthog.opt_out_capturing();
    }
  }, [consent]);

  return null;
}
