"use client";

import { useCallback, useSyncExternalStore } from "react";

const CONSENT_KEY = "cookie-consent";

type ConsentStatus = "accepted" | "declined" | null;

const subscribers = new Set<() => void>();

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function getSnapshot(): ConsentStatus {
  return localStorage.getItem(CONSENT_KEY) as ConsentStatus;
}

function getServerSnapshot(): ConsentStatus {
  return null;
}

function setConsent(status: ConsentStatus) {
  if (status) {
    localStorage.setItem(CONSENT_KEY, status);
  }
  subscribers.forEach((cb) => cb());
}

export function useCookieConsent() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const accept = useCallback(() => setConsent("accepted"), []);
  const decline = useCallback(() => setConsent("declined"), []);

  return { consent, accept, decline };
}

export function CookieConsent() {
  const { consent, accept, decline } = useCookieConsent();

  // During SSR, getServerSnapshot returns null — banner won't render
  // After hydration, getSnapshot reads localStorage
  if (consent !== null) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies to understand how you use our site and improve your
          experience.{" "}
          <a href="/privacy" className="underline hover:text-foreground">
            Learn more
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={decline}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
