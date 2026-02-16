import { useEffect, useMemo, useState } from "react";
import { ScriptBlock, ScriptProject } from "../../lib/types";
import { loadProjects, saveProjects } from "../../lib/storage";

const id = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_PROJECT: ScriptProject = {
  id: id(),
  metadata: {
    title: "UNTITLED SCREENPLAY",
    author: "Omenka Writer",
    draftDate: new Date().toLocaleDateString(),
    country: "Nigeria",
  },
  content: [{ id: id(), type: "scene-heading", content: "INT. LIVING ROOM - DAY" }],
  lastModifiedISO: new Date().toISOString(),
};

function nextType(t: ScriptBlock["type"]): ScriptBlock["type"] {
  switch (t) {
    case "scene-heading":
      return "action";
    case "character":
      return "dialogue";
    case "parenthetical":
      return "dialogue";
    case "dialogue":
      return "character";
    case "transition":
      return "scene-heading";
    default:
      return "action";
  }
}

export default function EditorScreen() {
  const [projects, setProjects] = useState<ScriptProject[]>(() => {
    const existing = loadProjects();
    return existing.length ? existing : [DEFAULT_PROJECT];
  });

  const [activeId, setActiveId] = useState(() => projects[0]?.id);

  const active = useMemo(
    () => projects.find((p) => p.id === activeId) || projects[0],
    [projects, activeId]
  );

  // Autosave to localStorage
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  const updateActive = (updater: (p: ScriptProject) => ScriptProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === active.id ? updater(p) : p))
    );
  };

  const updateBlock = (blockId: string, content: string) => {
    updateActive((p) => ({
      ...p,
      lastModifiedISO: new Date().toISOString(),
      content: p.content.map((b) =>
        b.id === blockId ? { ...b, content } : b
      ),
    }));
  };

  const addBlockAfter = (afterId: string) => {
    updateActive((p) => {
      const idx = p.content.findIndex((b) => b.id === afterId);
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
        <button
          onClick={() => {
            const p: ScriptProject = {
              ...DEFAULT_PROJECT,
              id: id(),
              content: [{ id: id(), type: "scene-heading", content: "INT. NEW SCENE - DAY" }],
              lastModifiedISO: new Date().toISOString(),
            };
            setProjects((prev) => [p, ...prev]);
            setActiveId(p.id);
          }}
        >
          New Project
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
        Autosave: ON (Local). Last modified: {new Date(active.lastModifiedISO).toLocaleString()}
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
                      x.id === b.id ? { ...x, type: e.target.value as any } : x
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
                Delete
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
}export default function App() {
  return <EditorScreen />;
}

