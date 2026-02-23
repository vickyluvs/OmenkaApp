import { useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { ScriptBlock, ScriptProject } from "../../lib/types";
import { loadProjects, saveProjects } from "../../lib/storage";
import {
  listProjects,
  upsertProject,
  removeProject,
} from "../../lib/projectsRepo";
import { useDebouncedEffect } from "../../lib/useDebouncedEffect";
import { runAI } from "../../lib/aiClient"; // New Import

// --- 1. HELPER FUNCTIONS ---
const id = () => Math.random().toString(36).slice(2, 10);

const makeDefaultProject = (): ScriptProject => ({
  id: id(),
  metadata: {
    title: "UNTITLED SCREENPLAY",
    author: "Omenka Writer",
    draftDate: new Date().toLocaleDateString(),
    country: "Nigeria",
  },
  content: [
    { id: id(), type: "scene-heading", content: "INT. LIVING ROOM - DAY" },
  ],
  lastModifiedISO: new Date().toISOString(),
});

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

type Props = { user: User };

export default function EditorScreen({ user }: Props) {
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("saved");

  // AI STATE
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const active = useMemo(() => {
    if (!projects.length) return null;
    return projects.find((p) => p.id === activeId) || projects[0];
  }, [projects, activeId]);

  // Initial Load
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
    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  // Persistence
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useDebouncedEffect(
    () => {
      if (!active) return;
      setSaveStatus("saving");
      upsertProject(user.uid, active)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    },
    [active],
    1000,
  );

  // AI ACTION LOGIC
  const handleGenerateSynopsis = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const response = await runAI({
        moduleId: "synopsis-generator",
        systemInstruction: "You are an expert Hollywood script consultant.",
        moduleInstruction:
          "Generate a dramatic 3-sentence screenplay synopsis based on the payload.",
        payload: aiPrompt,
      });
      if (response.disabled) alert("AI is disabled in .env");
      else setAiResult(response.text);
    } catch (e) {
      console.error(e);
      alert("AI Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- EDITOR ACTIONS ---
  const updateActive = (updater: (p: ScriptProject) => ScriptProject) => {
    if (!active) return;
    setSaveStatus("idle");
    setProjects((prev) =>
      prev.map((p) => (p.id === active.id ? updater(p) : p)),
    );
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
      const newBlock: ScriptBlock = {
        id: id(),
        type: nextType(after.type),
        content: "",
      };
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
    setActiveId(projects.find((p) => p.id !== idToDelete)?.id || null);
    await removeProject(user.uid, idToDelete);
  };

  // --- STYLES ---
  const status = {
    saving: {
      color: "#3b82f6",
      bg: "rgba(59, 130, 246, 0.1)",
      text: "Saving...",
    },
    saved: {
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.1)",
      text: "Saved to Cloud",
    },
    error: {
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.1)",
      text: "Sync Error",
    },
    idle: {
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.1)",
      text: "Unsaved Changes",
    },
  }[saveStatus] || { color: "#999", bg: "#eee", text: "Unknown" };

  if (loading)
    return <div style={{ padding: 40 }}>Loading Omenka Studio...</div>;

  // delete here
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#0f172a",
        fontFamily: "sans-serif",
      }}
    >
      {/* SIDEBAR */}
      <aside
        style={{
          width: 300,
          backgroundColor: "#1e293b",
          borderRight: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
          boxShadow: "4px 0 10px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ padding: "24px 20px" }}>
          <h1
            style={{
              color: "#38bdf8",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 1,
              marginBottom: 20,
            }}
          >
            OMENKA{" "}
            <span style={{ color: "#fff", fontWeight: 300 }}>STUDIO</span>
          </h1>
          <button
            onClick={createNewProject}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 8,
              backgroundColor: "#38bdf8",
              color: "#0f172a",
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              boxShadow: "0 4px 14px rgba(56, 189, 248, 0.4)",
            }}
          >
            + NEW SCRIPT
          </button>
        </div>

        <nav style={{ flex: 1, overflowY: "auto", padding: "0 15px" }}>
          <h2
            style={{
              fontSize: 10,
              color: "#64748b",
              fontWeight: 800,
              marginBottom: 10,
              paddingLeft: 10,
            }}
          >
            RECENT PROJECTS
          </h2>
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => setActiveId(p.id)}
              style={{
                padding: "12px 15px",
                borderRadius: 8,
                cursor: "pointer",
                marginBottom: 6,
                backgroundColor: activeId === p.id ? "#334155" : "transparent",
                border:
                  activeId === p.id
                    ? "1px solid #475569"
                    : "1px solid transparent",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: activeId === p.id ? 700 : 500,
                  color: activeId === p.id ? "#fff" : "#94a3b8",
                }}
              >
                {p.metadata.title}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                {new Date(p.lastModifiedISO).toLocaleDateString()}
              </div>
            </div>
          ))}
        </nav>

        {/* AI PANEL */}
        <div
          style={{
            padding: "20px",
            margin: "15px",
            borderRadius: 12,
            background: "linear-gradient(145deg, #1e293b, #0f172a)",
            border: "1px solid #38bdf855",
          }}
        >
          <h3
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#38bdf8",
              marginBottom: 10,
            }}
          >
            AI BRAINSTORM
          </h3>
          <textarea
            placeholder="Seed words..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            style={{
              width: "100%",
              fontSize: 13,
              padding: "10px",
              borderRadius: 6,
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              color: "#fff",
              resize: "none",
            }}
            rows={2}
          />
          <button
            onClick={handleGenerateSynopsis}
            disabled={isGenerating}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "10px",
              borderRadius: 6,
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {isGenerating ? "Consulting Muse..." : "GENERATE SYNOPSIS"}
          </button>
          {aiResult && (
            <div
              style={{
                marginTop: 12,
                padding: "10px",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  margin: 0,
                  fontStyle: "italic",
                  color: "#cbd5e1",
                }}
              >
                {aiResult}
              </p>
              <button
                onClick={() =>
                  updateActive((p) => ({
                    ...p,
                    content: [
                      ...p.content,
                      { id: id(), type: "action", content: aiResult },
                    ],
                  }))
                }
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: "#38bdf8",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                + INSERT AS ACTION
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* EDITOR */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "60px 20px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {active && (
          <div style={{ width: "100%", maxWidth: "850px" }}>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: 30,
              }}
            >
              <input
                value={active.metadata.title}
                onChange={(e) =>
                  updateActive((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, title: e.target.value },
                  }))
                }
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  outline: "none",
                  width: "70%",
                }}
              />
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 16px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    color: status.color,
                    backgroundColor: status.bg,
                    border: `1px solid ${status.color}`,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: status.color,
                      animation:
                        saveStatus === "saving" ? "pulse 1s infinite" : "none",
                    }}
                  />
                  {status.text}
                </div>
                <button
                  onClick={deleteCurrentProject}
                  style={{
                    display: "block",
                    marginTop: 12,
                    fontSize: 11,
                    color: "#f87171",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    marginLeft: "auto",
                  }}
                >
                  Delete Script
                </button>
              </div>
            </header>

            <div
              style={{
                backgroundColor: "white",
                minHeight: "1056px",
                width: "100%",
                padding: "90px 70px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              }}
            >
              {active.content.map((b) => (
                <div
                  key={b.id}
                  style={{ position: "relative", marginBottom: 12 }}
                  className="block-container"
                >
                  <div
                    style={{ display: "flex", gap: 10, marginBottom: 4 }}
                    className="block-tools"
                  >
                    <select
                      value={b.type}
                      onChange={(e) =>
                        updateActive((p) => ({
                          ...p,
                          content: p.content.map((x) =>
                            x.id === b.id
                              ? { ...x, type: e.target.value as any }
                              : x,
                          ),
                        }))
                      }
                      style={{
                        border: "none",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        background: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="scene-heading">Scene Heading</option>
                      <option value="action">Action</option>
                      <option value="character">Character</option>
                      <option value="parenthetical">Parenthetical</option>
                      <option value="dialogue">Dialogue</option>
                      <option value="transition">Transition</option>
                    </select>
                    <button
                      onClick={() => addBlockAfter(b.id)}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "#cbd5e1",
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeBlock(b.id)}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "#cbd5e1",
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <textarea
                    value={b.content}
                    onChange={(e) => updateBlock(b.id, e.target.value)}
                    placeholder={b.type.toUpperCase()}
                    rows={1}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      fontFamily: "'Courier Prime', Courier, monospace",
                      fontSize: 17,
                      lineHeight: "1.2",
                      backgroundColor: "transparent",
                      display: "block",
                      margin:
                        b.type === "character" ||
                        b.type === "parenthetical" ||
                        b.type === "dialogue"
                          ? "0 auto"
                          : "0",
                      maxWidth:
                        b.type === "dialogue"
                          ? "300px"
                          : b.type === "character" || b.type === "parenthetical"
                            ? "220px"
                            : "100%",
                      textAlign:
                        b.type === "character" ||
                        b.type === "parenthetical" ||
                        b.type === "dialogue"
                          ? "center"
                          : "left",
                      textTransform:
                        b.type === "character" ||
                        b.type === "scene-heading" ||
                        b.type === "transition"
                          ? "uppercase"
                          : "none",
                      color: "#000",
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addBlockAfter(b.id);
                        setTimeout(() => {
                          const tAs = document.querySelectorAll("textarea");
                          const idx = Array.from(tAs).indexOf(e.currentTarget);
                          (tAs[idx + 1] as HTMLElement)?.focus();
                        }, 50);
                      }
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const types: any[] = [
                          "scene-heading",
                          "action",
                          "character",
                          "parenthetical",
                          "dialogue",
                          "transition",
                        ];
                        const nextIdx =
                          (types.indexOf(b.type) + 1) % types.length;
                        updateActive((p) => ({
                          ...p,
                          content: p.content.map((x) =>
                            x.id === b.id ? { ...x, type: types[nextIdx] } : x,
                          ),
                        }));
                      }
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
        textarea::placeholder { color: #f1f5f9; }
      `}</style>
    </div>
  );
}
