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
      className="block bg-white dark:bg-[#111827] border border-[#e5e7eb] dark:border-[#1f2937] rounded-[10px] p-[18px] cursor-pointer transition-all duration-[0.18s] ease-out hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_6px_18px_rgba(0,0,0,0.25)] hover:-translate-y-0.5"
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide text-[#9ca3af] dark:text-[#9ca3af] mb-1.5">
          Study {study.number}
        </p>
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#e5e7eb] leading-[1.35]">
          {study.title}
        </h3>
        <p className="text-[13px] text-[#6b7280] dark:text-[#9ca3af] mt-1.5 line-clamp-3">
          {study.description}
        </p>
      </div>
      {signalTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t border-[#f1f5f9] dark:border-[#1f2937]">
          {signalTags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] bg-[#f3f4f6] dark:bg-[#1f2937] rounded-md px-1.5 py-0.5 text-[#4b5563] dark:text-[#9ca3af] mr-1 last:mr-0"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
