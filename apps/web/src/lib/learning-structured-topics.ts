/**
 * Structured learning entries for /learning (macro / study-linked topics).
 * Slugs are stable anchors: /learning#import-substitution-industrialization
 */

export type LearningExternalLink = { label: string; url: string; type?: "video" | "article" };

export type LearningStructuredBlock = {
  /** One short plain-language sentence shown at the top of the topic. */
  quickDefinition: string;
  definition: string;
  keyIdea: string;
  /** Metrics and series to watch—aligned with WDI panels on linked studies. */
  detectionBullets: string[];
  /** Practical chart-reading hints. */
  chartPatterns: string[];
  /** `studies.ts` study id */
  studyId: string;
};

export type StructuredLearningTopic = {
  /** URL fragment id, e.g. import-substitution-industrialization */
  id: string;
  title: string;
  structured: LearningStructuredBlock;
  learnMore?: LearningExternalLink[];
};

export const STRUCTURED_INDUSTRIAL_TOPICS: StructuredLearningTopic[] = [
  {
    id: "import-substitution-industrialization",
    title: "Import substitution industrialization (ISI)",
    learnMore: [
      {
        label: "Import substitution industrialization (Wikipedia)",
        url: "https://en.wikipedia.org/wiki/Import_substitution_industrialization",
      },
    ],
    structured: {
      quickDefinition: "A policy where a country tries to replace imports by producing goods at home.",
      definition:
        "Import substitution industrialization is a strategy where a country tries to cut dependence on imports by building domestic industries. Tariffs, quotas, or directed credit often support that shift.",
      keyIdea:
        "Protection, domestic production, and industrial policy steer demand toward local suppliers instead of foreign goods—so you look for industrial shares moving while import intensity changes.",
      detectionBullets: [
        "Imports (% of GDP) flatten or fall—NE.IMP.GNFS.ZS in the ISI diagnostics study.",
        "Manufacturing share of GDP rises—NV.IND.MANF.ZS in the same panel.",
        "Broader industry share rises—NV.IND.TOTL.ZS (manufacturing sits inside industry in the accounts).",
        "Exports stay weak or lag imports—compare NE.EXP.GNFS.ZS with NE.IMP.GNFS.ZS on the trade-structure chart.",
        "Growth may later slow if competitiveness or productivity stalls—NY.GDP.MKTP.KD.ZG is only a coarse outcome read, not a productivity measure.",
      ],
      chartPatterns: [
        "Imports stop rising or trend down while manufacturing (and often industry) picks up early.",
        "Exports lag: the export side of the trade panel does not keep pace with the import side you are trying to replace.",
        "Indexed overview (base year = 100): good for timing and co-movement of the four structure series—not for reading absolute % of GDP levels.",
        "Later windows: stagnation or partial reversal in industrial lines, or import pressure returning—descriptive timing only.",
      ],
      studyId: "isi-diagnostics",
    },
  },
  {
    id: "dutch-disease",
    title: "Dutch disease",
    learnMore: [{ label: "Dutch disease (Wikipedia)", url: "https://en.wikipedia.org/wiki/Dutch_disease" }],
    structured: {
      quickDefinition: "When a resource boom (like oil) makes the rest of the economy weaker.",
      definition:
        "Dutch disease is the idea that a resource boom—often in oil—shifts the economy in ways that weaken other tradable sectors. Manufacturing is the usual sector people track.",
      keyIdea:
        "Resource revenues can strengthen the real exchange rate and pull spending and labor; manufacturing and other tradables then face tougher competition at home and abroad.",
      detectionBullets: [
        "Oil or resource rents rise as % of GDP—NY.GDP.PETR.RT.ZS on the Dutch disease diagnostics study.",
        "Manufacturing share of GDP falls—NV.IND.MANF.ZS on the same study.",
        "Imports rise as % of GDP—NE.IMP.GNFS.ZS (import intensity climbing while tradables struggle).",
        "Open-market USD→toman in that study adds FX pressure next to the annual WDI lines.",
        "Consumption rising and investment in tradables weakening are visible in Iran national-accounts studies (composition / dual-axis)—use them alongside this panel, which does not plot C and I.",
      ],
      chartPatterns: [
        "Resource dependence (rents) trends up while manufacturing trends down—the core tension to watch.",
        "Imports climb in parallel with strong resource income—suggests spending and exchange-rate pressure; crude can move for other reasons too.",
        "The pattern is a persistent structural gap over years, not a single-year blip—use event overlays as timing anchors, not automatic proof of cause.",
      ],
      studyId: "dutch-disease-diagnostics",
    },
  },
];
