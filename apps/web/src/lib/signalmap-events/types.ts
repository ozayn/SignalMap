/**
 * Canonical shape for timeline + chart overlay events (web). API event records may add fields.
 */
export type SignalMapEventRecord = {
  id: string;
  date_start: string;
  date_end?: string | null;
  title_en: string;
  title_fa: string;
  description_en: string;
  description_fa: string;
  category: string;
  tags: string[];
  importance: 1 | 2 | 3;
  source?: string;
  confidence?: "low" | "medium" | "high";
};
