import Link from "next/link";

export default function ExplorePage() {
  return (
    <div className="page-container space-y-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Explore
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Exploratory views will be introduced as studies expand.
        </p>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        This section will host interactive visualizations and exploratory
        tools as additional studies and data become available.
      </p>
      <ul className="text-sm text-muted-foreground flex flex-wrap gap-2 list-none p-0">
        <li>
          <Link
            href="/explore/wayback"
            className="border border-border rounded-md px-3 py-1.5 inline-block hover:text-foreground transition"
          >
            Wayback snapshots
          </Link>
        </li>
        <li>
          <Link
            href="/explore/transcript-fallacy"
            className="border border-border rounded-md px-3 py-1.5 inline-block hover:text-foreground transition"
          >
            Transcript fallacy analysis
          </Link>
        </li>
      </ul>
    </div>
  );
}
