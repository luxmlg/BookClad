import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BookClad collects, uses, and protects your data. Learn about our analytics, cookies, and your privacy rights.",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 26, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            What We Collect
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Account information</strong>{" "}
              — name, email address, and profile image from your sign-in
              provider (Google, Apple, or Amazon).
            </li>
            <li>
              <strong className="text-foreground">Project data</strong> — book
              titles, author names, descriptions, and cover attribute selections
              you create.
            </li>
            <li>
              <strong className="text-foreground">Generated images</strong> —
              cover images produced by AI based on your prompts and attributes.
            </li>
            <li>
              <strong className="text-foreground">Uploaded files</strong> —
              custom fonts and reference images you upload.
            </li>
            <li>
              <strong className="text-foreground">Payment data</strong> —
              subscription and purchase information processed by DodoPayments. We
              never store or see your card numbers.
            </li>
            <li>
              <strong className="text-foreground">Credit history</strong> —
              records of credit grants, usage, and refunds for billing purposes.
            </li>
            <li>
              <strong className="text-foreground">Feedback</strong> — text and
              optional screenshots you submit through the feedback form.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            How We Use Your Data
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Authentication</strong> — to
              sign you in and maintain your session.
            </li>
            <li>
              <strong className="text-foreground">
                AI image generation and attribute suggestions
              </strong>{" "}
              — your prompts, descriptions, and attribute selections are sent to
              Google Gemini to generate cover images and suggest attributes.
            </li>
            <li>
              <strong className="text-foreground">File storage</strong> —
              generated images and uploaded assets are stored on Cloudflare R2.
            </li>
            <li>
              <strong className="text-foreground">Billing</strong> —
              subscription and credit pack purchases are processed by
              DodoPayments.
            </li>
          </ul>
          <p className="mt-3">
            We do not sell your data, use it for marketing, or build advertising
            profiles.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Third-Party Services
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Google</strong> — OAuth
              sign-in and Gemini AI for image generation and attribute
              suggestions.
            </li>
            <li>
              <strong className="text-foreground">Apple</strong> — OAuth
              sign-in (email and name).
            </li>
            <li>
              <strong className="text-foreground">Amazon</strong> — OAuth
              sign-in (email and name).
            </li>
            <li>
              <strong className="text-foreground">DodoPayments</strong> —
              payment processing for subscriptions and credit packs.
            </li>
            <li>
              <strong className="text-foreground">Cloudflare R2</strong> — file
              storage for generated images and uploaded assets.
            </li>
            <li>
              <strong className="text-foreground">Google Analytics</strong> —
              website analytics to understand how visitors use BookClad.
              Collects page views, device type, browser, referrer, and
              approximate location (country/city). You can opt out via the
              cookie consent banner or use the{" "}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                Google Analytics Opt-out Browser Add-on
              </a>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Cookies &amp; Local Storage
          </h2>
          <p>
            We use a single authentication cookie to maintain your session. It is
            HttpOnly and Secure in production.
          </p>
          <p className="mt-2">
            If you accept analytics cookies via our consent banner, Google
            Analytics sets the following cookies:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">_ga</strong> — identifies
              unique visitors, expires after 2 years.
            </li>
            <li>
              <strong className="text-foreground">_ga_*</strong> — maintains
              session state, expires after 2 years.
            </li>
          </ul>
          <p className="mt-2">
            We also store the following in your browser&apos;s localStorage:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">cookie-consent</strong> —
              your cookie preference (&quot;accepted&quot; or
              &quot;declined&quot;). No expiry.
            </li>
            <li>
              <strong className="text-foreground">UI preferences</strong> —
              panel height, per-project image count. No personal data.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Data Retention
          </h2>
          <p>
            Your data is kept for as long as your account exists. When you delete
            a project or image, it is permanently removed from our storage.
            Credit transaction records are retained for billing purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Your Rights
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Delete individual projects and images at any time from the editor.</li>
            <li>Export your covers as high-resolution images.</li>
            <li>
              Delete your entire account from{" "}
              <Link href="/settings" className="text-foreground underline underline-offset-2">
                Settings
              </Link>
              . This permanently removes all your data including projects,
              images, fonts, presets, and credit history.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Security
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Sessions are stored in our database (not client-side tokens).</li>
            <li>Payment webhook signatures are verified before processing.</li>
            <li>File download URLs expire after one hour.</li>
            <li>OAuth tokens are stored securely in our database.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Changes to This Policy
          </h2>
          <p>
            We may update this policy from time to time. The &quot;Last
            updated&quot; date at the top will reflect the most recent revision.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Contact
          </h2>
          <p>
            Questions about your data or this policy? Use the feedback form
            inside the app.
          </p>
        </section>
      </div>
    </div>
  );
}
