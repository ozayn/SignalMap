import Link from "next/link";
import type { StudyMeta } from "@/lib/studies";

type StudyCardProps = {
  study: StudyMeta;
  signalTags: string[];
};

export function StudyCard({ study, signalTags }: StudyCardProps) {
  return (
    <Link
      href={`/studies/${study.id}`}
      tabIndex={0}
      className="study-card"
    >
      <div>
        <p
          className="uppercase tracking-wide text-[#9ca3af] dark:text-[#9ca3af] mb-1.5"
          style={{ fontSize: "clamp(10px, 1vw, 11px)" }}
        >
          Study {study.number}
        </p>
        <h3
          className="font-semibold text-[#111827] dark:text-[#e5e7eb] leading-[1.35]"
          style={{ fontSize: "clamp(14px, 1.4vw, 16px)" }}
        >
          {study.title}
        </h3>
        {study.subtitle ? (
          <p
            className="text-[#6b7280] dark:text-[#9ca3af] mt-1 line-clamp-2"
            style={{ fontSize: "clamp(11px, 1.1vw, 13px)" }}
          >
            {study.subtitle}
          </p>
        ) : null}
        <p
          className="text-[#6b7280] dark:text-[#9ca3af] mt-1.5 line-clamp-2"
          style={{ fontSize: "clamp(12px, 1.2vw, 14px)" }}
        >
          {study.description}
        </p>
      </div>
      {signalTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t border-[#f1f5f9] dark:border-[#1f2937]">
          {signalTags.map((tag) => (
            <span
              key={tag}
              className="bg-[#f3f4f6] dark:bg-[#1f2937] rounded-md px-1.5 py-0.5 text-[#4b5563] dark:text-[#9ca3af] mr-1 last:mr-0"
              style={{ fontSize: "clamp(10px, 1vw, 11px)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

/** Compact row for list view on the studies index. */
export function StudyListRow({ study, signalTags }: StudyCardProps) {
  return (
    <Link
      href={`/studies/${study.id}`}
      tabIndex={0}
      className="study-list-row"
    >
      <div className="study-list-row__main">
        <span className="study-list-row__num">Study {study.number}</span>
        <h3 className="study-list-row__title">{study.title}</h3>
        {study.subtitle ? <p className="study-list-row__subtitle">{study.subtitle}</p> : null}
        <p className="study-list-row__desc">{study.description}</p>
      </div>
      {signalTags.length > 0 ? (
        <div className="study-list-row__tags">
          {signalTags.map((tag) => (
            <span key={tag} className="study-list-row__tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
