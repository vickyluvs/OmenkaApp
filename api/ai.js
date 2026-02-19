module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  try {
    const { moduleId, systemInstruction, moduleInstruction, payload } = req.body || {};

    if (!moduleId || !systemInstruction || !moduleInstruction || !payload) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Missing fields" }));
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "Missing OPENAI_API_KEY in server env" }));
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: systemInstruction,
        input: `MODULE: ${moduleId}\n\n${moduleInstruction}\n\n${payload}`,
        truncation: "auto",
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      res.statusCode = response.status;
      return res.end(t);
    }

    const data = await response.json();
    const text = data.output_text || "";
    res.statusCode = 200;
    return res.end(JSON.stringify({ text }));
  } catch (err) {
    console.error("AI function crash:", err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "Server error", details: String(err) }));
  }

  
};

console.log("Has key:", !!process.env.OPENAI_API_KEY);

