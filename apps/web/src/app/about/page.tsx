import { SUPPORT_LINK_ARIA } from "@/lib/site-support";
import { resolveSignalMapSupportHref } from "@/lib/site-support-href";

/** Same as root layout / Methods: resolve support URL at request time (runtime env on Railway). */
export const dynamic = "force-dynamic";

export default function AboutPage() {
  const supportHref = resolveSignalMapSupportHref();

  return (
    <div className="page-container flex flex-col gap-14 [&_section]:mb-0">
      <h1>About SignalMap</h1>

      <section>
        <h2>What it is</h2>
        <p>
          SignalMap is a platform for exploring economic signals, historical
          context, and public discourse over time.
        </p>
        <p>
          It focuses on longitudinal patterns — how variables evolve, interact,
          and respond to events.
        </p>
      </section>

      <section>
        <h2>Motivation</h2>
        <p>
          The project started as an attempt to better understand complex systems
          — particularly the economic and political dynamics around Iran — by
          placing data and events on a shared timeline.
        </p>
        <p>
          Rather than starting with a fixed hypothesis, SignalMap prioritizes
          exploration and pattern discovery.
        </p>
      </section>

      <section>
        <h2>How to interpret</h2>
        <p>The studies are not predictive models.</p>
        <p>They are designed to:</p>
        <ul className="max-w-[720px] list-disc space-y-2 pl-5 text-[15px] leading-[1.65] text-[#4b5563] dark:text-[#9ca3af]">
          <li>surface patterns</li>
          <li>provide context</li>
          <li>support independent interpretation</li>
        </ul>
      </section>

      <section>
        <h2>Data note</h2>
        <p>
          Data comes from a combination of public sources (e.g., World Bank, IMF,
          and historical archives) and derived series.
        </p>
        <p>
          Some datasets are approximations or constructed for continuity and
          should be interpreted accordingly.
        </p>
      </section>

      <section lang="en">
        <h2>Support</h2>
        <p>
          SignalMap is an independent project developed as a personal passion.
        </p>
        <p>
          If you find it useful, you can support its continued development.{" "}
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
            aria-label={SUPPORT_LINK_ARIA}
          >
            Support this project
          </a>
        </p>
      </section>
    </div>
  );
}
