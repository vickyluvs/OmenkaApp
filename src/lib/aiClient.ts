const AI_ENABLED = process.env.REACT_APP_AI_ENABLED === "true";

type AIRequest = {
  moduleId: string;
  systemInstruction: string;
  moduleInstruction: string;
  payload: string;
};

export async function runAI(req: AIRequest): Promise<{ text: string; disabled?: boolean }> {
  if (!AI_ENABLED) {
    return { text: "AI is disabled in this environment.", disabled: true };
  }

  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(errText || `HTTP ${r.status}`);
  }

  return (await r.json()) as { text: string };
}
