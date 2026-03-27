import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms and conditions for using BookClad, the AI-powered book cover generator.",
};

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Terms of Use</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 26, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Acceptance of Terms
          </h2>
          <p>
            By accessing or using BookClad, you agree to be bound by these
            Terms of Use. If you do not agree with any part of these terms, you
            must not use the service. Your continued use of BookClad after any
            changes to these terms constitutes your acceptance of the revised
            terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Service Description
          </h2>
          <p>
            BookClad is an AI-powered book cover generator designed for Amazon
            KDP (Kindle Direct Publishing) authors. The service allows you to
            describe your book, select genre, mood, and style attributes, and
            generate KDP-compliant cover images. Cover images are generated
            using Google Gemini AI and processed to meet Amazon KDP
            specifications (1600×2560 px, 300 DPI).
          </p>
          <p className="mt-2">
            BookClad is provided on an ongoing basis and we reserve the right
            to modify, suspend, or discontinue any part of the service at any
            time with reasonable notice.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            User Accounts
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">One account per person</strong>{" "}
              — you may not create multiple accounts or share your account with
              others.
            </li>
            <li>
              <strong className="text-foreground">Account security</strong> —
              you are responsible for keeping your credentials secure. Notify us
              immediately if you suspect unauthorized access to your account.
            </li>
            <li>
              <strong className="text-foreground">Accurate information</strong>{" "}
              — you must provide accurate information when signing in. We rely
              on email addresses from your OAuth provider (Google, Apple, or
              Amazon).
            </li>
            <li>
              <strong className="text-foreground">Account responsibility</strong>{" "}
              — you are responsible for all activity that occurs under your
              account, including any credits consumed and content generated.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            AI-Generated Content
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Ownership</strong> — covers
              you generate are yours to use commercially, including publishing
              on Amazon KDP. BookClad does not claim ownership of your
              generated content.
            </li>
            <li>
              <strong className="text-foreground">Your responsibility</strong>{" "}
              — you are responsible for ensuring that the content you generate
              does not infringe third-party intellectual property rights,
              trademarks, or copyrights.
            </li>
            <li>
              <strong className="text-foreground">AI output variability</strong>{" "}
              — AI-generated images may occasionally produce unexpected or
              unintended results. You should review all generated covers before
              publishing or distributing them.
            </li>
            <li>
              <strong className="text-foreground">Marketing use</strong> —
              BookClad may display user-generated covers in marketing materials,
              landing pages, or a public gallery. We will only do so with your
              permission.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Credits and Billing
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Credit-based system</strong>{" "}
              — BookClad uses a credit system. Credits are consumed each time
              you generate cover images. The cost per image depends on the
              generation model selected.
            </li>
            <li>
              <strong className="text-foreground">Non-refundable credits</strong>{" "}
              — purchased credit packs are non-refundable once consumed. Credits
              that fail to produce a result due to a system error are
              automatically refunded to your account.
            </li>
            <li>
              <strong className="text-foreground">No rollover</strong> —
              subscription credits do not roll over to the next billing period.
              Unused subscription credits expire at the end of each period.
            </li>
            <li>
              <strong className="text-foreground">Automatic renewal</strong> —
              subscriptions renew automatically at the end of each billing
              period. You will be charged using the payment method on file.
            </li>
            <li>
              <strong className="text-foreground">Cancellation</strong> — you
              can cancel your subscription at any time from{" "}
              <Link
                href="/settings"
                className="text-foreground underline underline-offset-2"
              >
                Settings
              </Link>
              . Cancellation stops future renewals but does not refund the
              current billing period.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Acceptable Use
          </h2>
          <p>You agree not to use BookClad to:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Generate illegal, harmful, threatening, abusive, defamatory, or
              obscene content, including any NSFW imagery.
            </li>
            <li>
              Infringe on the trademarks, copyrights, or intellectual property
              rights of any third party.
            </li>
            <li>
              Reverse engineer, decompile, or attempt to extract the source
              code of the service.
            </li>
            <li>
              Automate scraping, bulk generation, or any activity that places
              unreasonable load on our infrastructure.
            </li>
            <li>
              Attempt to bypass, exploit, or manipulate the credit system.
            </li>
            <li>
              Create content that impersonates real individuals, brands, or
              organizations in a misleading or harmful way.
            </li>
          </ul>
          <p className="mt-3">
            Violation of these rules may result in immediate account suspension
            or termination without refund.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Limitation of Liability
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">As-is service</strong> —
              BookClad is provided &quot;as is&quot; without warranties of any
              kind, express or implied, including warranties of merchantability,
              fitness for a particular purpose, or non-infringement.
            </li>
            <li>
              <strong className="text-foreground">No consequential damages</strong>{" "}
              — BookClad is not liable for any indirect, incidental, special, or
              consequential damages arising from your use of the service,
              including but not limited to lost profits, lost data, or business
              interruption.
            </li>
            <li>
              <strong className="text-foreground">Liability cap</strong> — our
              total liability to you for any claim arising out of or relating
              to these terms or the service is capped at the amount you paid
              us in the twelve months preceding the claim.
            </li>
            <li>
              <strong className="text-foreground">AI accuracy</strong> —
              BookClad is not responsible for the accuracy, suitability, or
              fitness of any AI-generated cover for any specific purpose,
              including compliance with Amazon KDP content policies.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Termination
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">By you</strong> — you may
              stop using BookClad at any time and delete your account from{" "}
              <Link
                href="/settings"
                className="text-foreground underline underline-offset-2"
              >
                Settings
              </Link>{" "}
              → General → Danger Zone. Account deletion is immediate and
              permanent.
            </li>
            <li>
              <strong className="text-foreground">By BookClad</strong> — we
              reserve the right to suspend or terminate accounts that violate
              these terms, engage in fraudulent activity, or pose a risk to
              the service or other users.
            </li>
            <li>
              <strong className="text-foreground">Effect of termination</strong>{" "}
              — upon termination, your access to the service ends and your data
              is permanently deleted in accordance with our{" "}
              <Link
                href="/privacy"
                className="text-foreground underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              . Unused credits are forfeited and are not refundable upon
              voluntary account deletion.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Changes to Terms
          </h2>
          <p>
            BookClad may update these terms from time to time to reflect
            changes in the service, legal requirements, or business practices.
            Continued use of the service after changes are posted constitutes
            your acceptance of the revised terms. For material changes, we will
            provide notice through the app or via email.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Contact
          </h2>
          <p>
            If you have questions about these terms, email us at{" "}
            <a
              href="mailto:support@bookclad.com"
              className="text-foreground underline underline-offset-2"
            >
              support@bookclad.com
            </a>{" "}
            or use the feedback form inside the app.
          </p>
        </section>
      </div>
    </div>
  );
}
