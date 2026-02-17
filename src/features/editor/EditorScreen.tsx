import { useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { ScriptBlock, ScriptProject } from "../../lib/types";
import { listProjects, upsertProject, removeProject } from "../../lib/projectsRepo";

// 1. Helper functions outside the component
const id = () => Math.random().toString(36).slice(2, 10);

const makeDefaultProject = (): ScriptProject => ({
  id: id(),
  metadata: {
    title: "UNTITLED SCREENPLAY",
    author: "Omenka Writer",
    draftDate: new Date().toLocaleDateString(),
    country: "Nigeria",
  },
  content: [{ id: id(), type: "scene-heading", content: "INT. LIVING ROOM - DAY" }],
  lastModifiedISO: new Date().toISOString(),
});

function nextType(t: ScriptBlock["type"]): ScriptBlock["type"] {
  switch (t) {
    case "scene-heading": return "action";
    case "character": return "dialogue";
    case "parenthetical": return "dialogue";
    case "dialogue": return "character";
    case "transition": return "scene-heading";
    default: return "action";
  }
}

type Props = { user: User };

// 2. The single, clean component
export default function EditorScreen({ user }: Props) {
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const active = useMemo(() => {
    if (!projects.length) return null;
    return projects.find((p) => p.id === activeId) || projects[0];
  }, [projects, activeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const remote = await listProjects(user.uid);
        if (cancelled) return;
        if (remote.length) {
          setProjects(remote);
          setActiveId(remote[0].id);
        } else {
          const first = makeDefaultProject();
          await upsertProject(user.uid, first);
          if (cancelled) return;
          setProjects([first]);
          setActiveId(first.id);
        }
      } catch (e) {
        console.error("Failed to load projects:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.uid]);

  useEffect(() => {
    if (!active) return;
    setSaveStatus("saving");
    const t = window.setTimeout(async () => {
      try {
        await upsertProject(user.uid, active);
        setSaveStatus("saved");
      } catch (e) {
        console.error("Failed to save project:", e);
        setSaveStatus("error");
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [user.uid, active]);

  const updateActive = (updater: (p: ScriptProject) => ScriptProject) => {
    if (!active) return;
    setProjects((prev) => prev.map((p) => (p.id === active.id ? updater(p) : p)));
  };

  const updateBlock = (blockId: string, content: string) => {
    updateActive((p) => ({
      ...p,
      lastModifiedISO: new Date().toISOString(),
      content: p.content.map((b) => (b.id === blockId ? { ...b, content } : b)),
    }));
  };

  const addBlockAfter = (afterId: string) => {
    updateActive((p) => {
      const idx = p.content.findIndex((b) => b.id === afterId);
      if (idx === -1) return p;
      const after = p.content[idx];
      const newBlock: ScriptBlock = { id: id(), type: nextType(after.type), content: "" };
      const next = [...p.content];
      next.splice(idx + 1, 0, newBlock);
      return { ...p, lastModifiedISO: new Date().toISOString(), content: next };
    });
  };

  const removeBlock = (blockId: string) => {
    updateActive((p) => {
      if (p.content.length <= 1) return p;
      return {
        ...p,
        lastModifiedISO: new Date().toISOString(),
        content: p.content.filter((b) => b.id !== blockId),
      };
    });
  };

  const createNewProject = async () => {
    const p: ScriptProject = {
      ...makeDefaultProject(),
      id: id(),
      content: [{ id: id(), type: "scene-heading", content: "INT. NEW SCENE - DAY" }],
      lastModifiedISO: new Date().toISOString(),
    };
    setProjects((prev) => [p, ...prev]);
    setActiveId(p.id);
    try {
      await upsertProject(user.uid, p);
    } catch (e) {
      console.error("Failed to create project:", e);
      setSaveStatus("error");
    }
  };

  const deleteCurrentProject = async () => {
    if (!active) return;
    const ok = window.confirm("Delete this project?");
    if (!ok) return;
    const idToDelete = active.id;
    setProjects((prev) => prev.filter((p) => p.id !== idToDelete));
    setActiveId(() => {
      const remaining = projects.filter((p) => p.id !== idToDelete);
      return remaining[0]?.id ?? null;
    });
    try {
      await removeProject(user.uid, idToDelete);
    } catch (e) {
      console.error("Failed to delete project:", e);
      setSaveStatus("error");
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading projects…</div>;
  if (!active) return <div style={{ padding: 24 }}>No project found.</div>;

  const saveLabel =
    saveStatus === "saving" ? "Saving…" :
    saveStatus === "saved" ? "Saved" :
    saveStatus === "error" ? "Save error" : "Idle";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "ui-sans-serif" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <input
          value={active.metadata.title}
          onChange={(e) =>
            updateActive((p) => ({
              ...p,
              metadata: { ...p.metadata, title: e.target.value },
            }))
          }
          style={{ fontSize: 18, fontWeight: 700, flex: 1, padding: 8 }}
        />
        <button onClick={createNewProject}>New Project</button>
        <button onClick={deleteCurrentProject} disabled={!active}>
          Delete Project
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
        Autosave: {saveLabel}. Last modified: {new Date(active.lastModifiedISO).toLocaleString()}
      </div>

      <div style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb" }}>
        {active.content.map((b) => (
          <div key={b.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={b.type}
                onChange={(e) =>
                  updateActive((p) => ({
                    ...p,
                    content: p.content.map((x) =>
                      x.id === b.id ? { ...x, type: e.target.value as ScriptBlock["type"] } : x
                    ),
                  }))
                }
              >
                <option value="scene-heading">Scene Heading</option>
                <option value="action">Action</option>
                <option value="character">Character</option>
                <option value="parenthetical">Parenthetical</option>
                <option value="dialogue">Dialogue</option>
                <option value="transition">Transition</option>
                <option value="shot">Shot</option>
              </select>
              <button onClick={() => addBlockAfter(b.id)}>+ Block</button>
              <button onClick={() => removeBlock(b.id)} disabled={active.content.length <= 1}>
                Delete Block
              </button>
            </div>
            <textarea
              value={b.content}
              onChange={(e) => updateBlock(b.id, e.target.value)}
              placeholder={b.type.toUpperCase()}
              rows={b.type === "dialogue" ? 3 : 2}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontFamily: "ui-monospace",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}