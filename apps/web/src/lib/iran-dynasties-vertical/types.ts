/**
 * Iranian historical dynasties for the vertical band timeline.
 * Years: BCE as negative integers (e.g. 550 BCE → -550), CE as positive.
 */

export type IranDynastyCategory = "dynasty";

export type IranVerticalDynasty = {
  id: string;
  start_year: number;
  end_year: number;
  title_en: string;
  title_fa: string;
  /** Display / filter key (single value for this dataset). */
  category: IranDynastyCategory;
  /** 1 = light, 2 = default, 3 = landmark. */
  importance: 1 | 2 | 3;
  description_en: string;
  description_fa: string;
};
