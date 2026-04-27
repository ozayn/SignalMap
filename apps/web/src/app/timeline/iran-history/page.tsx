import { IRAN_VERTICAL_DYNASTIES } from "@/lib/iran-dynasties-vertical";
import { IranDynastiesVerticalTimeline } from "@/components/iran-dynasties-vertical/iran-dynasties-vertical-timeline";

export default function IranHistoryTimelinePage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <IranDynastiesVerticalTimeline data={IRAN_VERTICAL_DYNASTIES} />
    </div>
  );
}
