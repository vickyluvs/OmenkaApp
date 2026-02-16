import { ScriptProject } from "./types";

const KEY = "omenka.projects.v1";

export function loadProjects(): ScriptProject[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScriptProject[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: ScriptProject[]) {
  localStorage.setItem(KEY, JSON.stringify(projects));
}
