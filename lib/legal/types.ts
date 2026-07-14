export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  description: string;
  lastUpdated: string;
  disclaimer: string;
  sections: LegalSection[];
};
