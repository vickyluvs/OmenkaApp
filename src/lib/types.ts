export type BlockType =
  | "scene-heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "shot";

export type CountryContext = "Nigeria" | "Sierra Leone";

export interface ScriptBlock {
  id: string;
  type: BlockType;
  content: string;
}

export interface ScriptMetadata {
  title: string;
  author: string;
  draftDate: string;
  country: CountryContext;
  logline?: string;
}

export interface ScriptProject {
  id: string;
  metadata: ScriptMetadata;
  content: ScriptBlock[];
  lastModifiedISO: string;
}
