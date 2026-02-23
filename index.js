// index.js
const express = require("express");
const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const cors = require("cors");

// Load environment variables from .env
dotenv.config();

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(cors()); // Enable CORS if your frontend is on a different port

// Initialize OpenAI client with your key from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/ai", async (req, res) => {
  const { moduleId, systemInstruction, moduleInstruction, payload } = req.body;

  try {
    // Call the Chat Completions API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // You can also use 'gpt-4o'
      messages: [
        {
          role: "system",
          content: `${systemInstruction} ${moduleInstruction}`,
        },
        { role: "user", content: payload },
      ],
      temperature: 0.7, // Adjust for creativity
    });

    // Return only the text response to the frontend
    res.json({ text: completion.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
