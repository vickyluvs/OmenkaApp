import { useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { ScriptBlock, ScriptProject } from "../../lib/types";
import { loadProjects, saveProjects } from "../../lib/storage"; // LocalStorage features
import { listProjects, upsertProject, removeProject } from "../../lib/projectsRepo"; // Firebase features
import { useDebouncedEffect } from "../../lib/useDebouncedEffect";

// --- Helper Functions ---
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

export default function EditorScreen({ user }: Props) {
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("saved");

  const active = useMemo(() => {
    if (!projects.length) return null;
    return projects.find((p) => p.id === activeId) || projects[0];
  }, [projects, activeId]);

  // FEATURE: Initial Load (Syncs Firebase & fallback to LocalStorage if offline)
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
          // Fallback to local storage if Firebase is empty
          const local = loadProjects();
          const initial = local.length ? local : [makeDefaultProject()];
          setProjects(initial);
          setActiveId(initial[0].id);
        }
      } catch (e) {
        console.error("Failed to load projects:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.uid]);

  // FEATURE: Double-Backup (Saves to LocalStorage immediately, Firebase debounced)
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useDebouncedEffect(() => {
    if (!active) return;
    setSaveStatus("saving");
    upsertProject(user.uid, active)
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("error"));
  }, [active], 1000);

  // --- Actions ---
  const updateActive = (updater: (p: ScriptProject) => ScriptProject) => {
    if (!active) return;
    setSaveStatus("idle");
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
    const p = makeDefaultProject();
    setProjects((prev) => [p, ...prev]);
    setActiveId(p.id);
    await upsertProject(user.uid, p);
  };

  const deleteCurrentProject = async () => {
    if (!active) return;
    if (!window.confirm("Delete this script permanently?")) return;
    const idToDelete = active.id;
    setProjects((prev) => prev.filter((p) => p.id !== idToDelete));
    setActiveId(projects.find(p => p.id !== idToDelete)?.id || null);
    await removeProject(user.uid, idToDelete);
  };

  // --- Styles ---
  const status = {
    saving: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", text: "Saving..." },
    saved: { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", text: "Saved to Cloud" },
    error: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", text: "Sync Error" },
    idle: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", text: "Unsaved Changes" }
  }[saveStatus];

  if (loading) return <div style={{ padding: 40 }}>Loading Omenka Studio...</div>;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#f3f4f6" }}>
      {/* Sidebar History */}
      <aside style={{ width: 280, backgroundColor: "white", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "#9ca3af", marginBottom: 16 }}>HISTORY</h2>
          <button onClick={createNewProject} style={{ width: "100%", padding: "10px", borderRadius: 8, backgroundColor: "#111827", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>
            + New Script
          </button>
        </div>
        <nav style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {projects.map(p => (
            <div key={p.id} onClick={() => setActiveId(p.id)} style={{
              padding: "12px 16px", borderRadius: 8, cursor: "pointer", marginBottom: 4,
              backgroundColor: activeId === p.id ? "#f9fafb" : "transparent",
              border: activeId === p.id ? "1px solid #e5e7eb" : "1px solid transparent"
            }}>
              <div style={{ fontSize: 14, fontWeight: activeId === p.id ? 700 : 500, color: "#374151" }}>{p.metadata.title}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{new Date(p.lastModifiedISO).toLocaleDateString()}</div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Editor Main */}
      <main style={{ flex: 1, overflowY: "auto", padding: "40px 20px" }}>
        {active && (
          <div style={{ maxWidth: 850, margin: "0 auto" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
              <input 
                value={active.metadata.title} 
                onChange={(e) => updateActive(p => ({ ...p, metadata: { ...p.metadata, title: e.target.value } }))}
                style={{ fontSize: 32, fontWeight: 800, border: "none", background: "transparent", outline: "none", color: "#111827", width: "70%" }}
              />
              <div style={{ textAlign: "right" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: status.color, backgroundColor: status.bg, border: `1px solid ${status.color}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: status.color, animation: saveStatus === "saving" ? "pulse 1s infinite" : "none" }} />
                  {status.text}
                </div>
                <button onClick={deleteCurrentProject} style={{ display: "block", marginTop: 8, fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Delete Script</button>
              </div>
            </header>

            <div style={{ backgroundColor: "white", padding: "80px 60px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderRadius: 4, minHeight: "100vh" }}>
              {active.content.map((b) => (
                <div key={b.id} style={{ position: "relative", marginBottom: 10 }} className="block-container">
                  <div style={{ display: "flex", gap: 10, marginBottom: 4 }} className="block-tools">
                    <select 
                      value={b.type} 
                      onChange={(e) => updateActive(p => ({ ...p, content: p.content.map(x => x.id === b.id ? { ...x, type: e.target.value as any } : x) }))}
                      style={{ border: "none", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", background: "#f9fafb", cursor: "pointer" }}
                    >
                      <option value="scene-heading">Scene Heading</option>
                      <option value="action">Action</option>
                      <option value="character">Character</option>
                      <option value="parenthetical">Parenthetical</option>
                      <option value="dialogue">Dialogue</option>
                      <option value="transition">Transition</option>
                    </select>
                    <button onClick={() => addBlockAfter(b.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#d1d5db" }}>+</button>
                    <button onClick={() => removeBlock(b.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#d1d5db" }}>✕</button>
                  </div>
                  <textarea
                    value={b.content}
                    onChange={(e) => updateBlock(b.id, e.target.value)}
                    placeholder={b.type.toUpperCase()}
                    rows={1}
                    style={{
                      width: "100%", border: "none", outline: "none", resize: "none",
                      fontFamily: "'Courier Prime', Courier, monospace", fontSize: 17, lineHeight: "1.2",
                      textAlign: (b.type === "character" || b.type === "parenthetical" || b.type === "dialogue") ? "center" : "left",
                      padding: b.type === "dialogue" ? "0 15%" : "0",
                      textTransform: (b.type === "character" || b.type === "scene-heading" || b.type === "transition") ? "uppercase" : "none",
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .block-tools { opacity: 0; transition: opacity 0.2s; }
        .block-container:hover .block-tools { opacity: 1; }
        textarea::placeholder { color: #f3f4f6; }
      `}</style>
    </div>
  );
}