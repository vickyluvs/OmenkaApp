import { useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { ScriptBlock, ScriptProject } from "../../lib/types";
import { listProjects, upsertProject, removeProject } from "../../lib/projectsRepo";
import { useDebouncedEffect } from "../../lib/useDebouncedEffect";

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
        }
      } catch (e) {
        console.error("Failed to load projects:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.uid]);

  // The Debounced Autosave Hook
  useDebouncedEffect(
    () => {
      if (!active) return;
      setSaveStatus("saving");
      
      upsertProject(user.uid, active)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    },
    [active], 
    1000 
  );

  const updateActive = (updater: (p: ScriptProject) => ScriptProject) => {
    if (!active) return;
    // Immediately tell the UI we have unsaved changes
    setSaveStatus("idle"); 
    setProjects((prev) => prev.map((p) => (p.id === active.id ? updater(p) : p)));
  };

  // --- Dynamic Styles for the Status Badge ---
  const getStatusStyle = () => {
    switch (saveStatus) {
      case "saving":
        return { color: "#3b82f6", glow: "rgba(59, 130, 246, 0.5)", text: "Saving..." };
      case "saved":
        return { color: "#10b981", glow: "rgba(16, 185, 129, 0.3)", text: "All changes saved" };
      case "error":
        return { color: "#ef4444", glow: "rgba(239, 68, 68, 0.5)", text: "Save Error" };
      default:
        return { color: "#f59e0b", glow: "rgba(245, 158, 11, 0.3)", text: "Unsaved changes" };
    }
  };

  const status = getStatusStyle();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!active) return <div style={{ padding: 24 }}>No project found.</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "ui-sans-serif" }}>
      {/* Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <input
          value={active.metadata.title}
          onChange={(e) => updateActive(p => ({ ...p, metadata: { ...p.metadata, title: e.target.value } }))}
          style={{ fontSize: 24, fontWeight: 800, border: "none", outline: "none", flex: 1 }}
        />
        
        {/* Animated Save Badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          transition: "all 0.3s ease",
          color: status.color,
          backgroundColor: status.glow,
          border: `1px solid ${status.color}`
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: status.color,
            display: "inline-block",
            // This creates the pulsing animation if saving
            animation: saveStatus === "saving" ? "pulse 1s infinite" : "none"
          }} />
          {status.text}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Editor Content Area */}
      <div style={{ background: "white", borderRadius: 12, padding: 32, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}>
        {active.content.map((b) => (
           <div key={b.id} style={{ marginBottom: 20 }}>
             {/* ... (Your existing textarea and block controls) ... */}
           </div>
        ))}
      </div>
    </div>
  );
}