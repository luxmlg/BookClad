import { PostHog } from "posthog-node";

const NOOP_CLIENT = {
  capture() {},
  async shutdown() {},
} as unknown as PostHog;

export function getPostHogClient(): PostHog {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    return NOOP_CLIENT;
  }
  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}
