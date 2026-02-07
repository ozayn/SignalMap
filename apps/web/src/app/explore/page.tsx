import Link from "next/link";

export default function ExplorePage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 space-y-8">
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
      <p className="text-sm text-muted-foreground">
        <Link href="/explore/wayback" className="border border-border rounded-md px-3 py-1.5 inline-block hover:text-foreground transition">
          Wayback snapshots
        </Link>
      </p>
    </div>
  );
}
