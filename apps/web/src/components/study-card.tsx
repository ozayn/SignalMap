import Link from "next/link";
import type { StudyMeta } from "@/lib/studies";
import { getStudyVisualAnchor, studyVisualAnchorDotClass } from "@/lib/study-visual-anchor";

type StudyCardProps = {
  study: StudyMeta;
  signalTags: string[];
};

export function StudyCard({ study, signalTags }: StudyCardProps) {
  const anchor = getStudyVisualAnchor(study);
  const dotClass = studyVisualAnchorDotClass(anchor);

  return (
    <Link href={`/studies/${study.id}`} tabIndex={0} className="study-card">
      <div className="flex min-h-0 min-w-0 flex-1 gap-2.5">
        <span
          className={`study-card__anchor mt-[3px] h-[7px] w-[7px] shrink-0 rounded-full ${dotClass}`}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="study-card__meta uppercase tracking-wide text-[#9ca3af] dark:text-[#9ca3af] mb-1">
            Study {study.number}
          </p>
          <h3 className="study-card__title text-[#111827] dark:text-[#e5e7eb] leading-snug">{study.title}</h3>
          {study.subtitle ? (
            <p className="study-card__subtitle text-[#9ca3af] dark:text-[#94a3b8] mt-0.5 line-clamp-1">
              {study.subtitle}
            </p>
          ) : null}
          <p className="study-card__desc text-[#9ca3af] dark:text-[#94a3b8] mt-1 line-clamp-1">{study.description}</p>
          {signalTags.length > 0 ? (
            <div className="study-card__tags mt-2.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {signalTags.map((tag) => (
                <span key={tag} className="study-card__tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/** Compact row for list view on the studies index. */
export function StudyListRow({ study, signalTags }: StudyCardProps) {
  const anchor = getStudyVisualAnchor(study);
  const dotClass = studyVisualAnchorDotClass(anchor);

  return (
    <Link href={`/studies/${study.id}`} tabIndex={0} className="study-list-row">
      <div className="study-list-row__main flex min-w-0 gap-2.5">
        <span
          className={`study-list-row__anchor mt-1 h-[7px] w-[7px] shrink-0 rounded-full ${dotClass}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <span className="study-list-row__num">Study {study.number}</span>
          <h3 className="study-list-row__title">{study.title}</h3>
          {study.subtitle ? <p className="study-list-row__subtitle">{study.subtitle}</p> : null}
          <p className="study-list-row__desc">{study.description}</p>
          {signalTags.length > 0 ? (
            <div className="study-list-row__tags">
              {signalTags.map((tag) => (
                <span key={tag} className="study-list-row__tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
