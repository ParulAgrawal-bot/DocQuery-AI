const express = require("express");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./db/connect");
const Chunk = require("./db/schema");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

connectDB();

function chunkText(text, size = 500) {
  if (!text || !text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "));
  }
  return chunks;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function generateEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;
  const retries = 3;
  const delay = 1000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: {
            parts: [
              {
                text: text
              }
            ]
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Embedding API failed: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      if (!data.embedding || !data.embedding.values) {
        throw new Error(`Invalid response format from Embedding API: ${JSON.stringify(data)}`);
      }
      return data.embedding.values;
    } catch (err) {
      console.warn(`Embedding attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) {
        throw err;
      }
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
}

app.post("/api/search", async (req, res) => {
  try {
    const { query, docId } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    if (!docId) {
      return res.json({ answer: "No active document found. Please upload a PDF or TXT file first.", chunks: [] });
    }

    // Fetch chunks from database only for this specific document
    const chunks = await Chunk.find({ doc_id: docId });
    if (chunks.length === 0) {
      return res.json({ answer: "No documents have been uploaded yet. Please upload a document first." });
    }

    // Rank chunks using in-memory cosine similarity
    const ranked = chunks.map(chunk => {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      return { chunk, similarity };
    });

    ranked.sort((a, b) => b.similarity - a.similarity);

    // Get top 3 chunks
    const topResults = ranked.slice(0, 3);
    const context = topResults.map(r => r.chunk.chunk_text).join("\n\n");

    // Generate response using Gemini REST API (using gemini-2.5-flash)
    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const generateResponse = await fetch(generateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a helpful document assistant. Answer the user's question using the provided context from the uploaded documents.
      
Context:
${context}

Question:
${query}

Answer:`
              }
            ]
          }
        ]
      })
    });

    if (!generateResponse.ok) {
      const errText = await generateResponse.text();
      throw new Error(`Gemini generateContent API failed: ${generateResponse.statusText} - ${errText}`);
    }

    const generateData = await generateResponse.json();
    const answerText = generateData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    res.json({ 
      answer: answerText,
      chunks: topResults.map(r => ({
        text: r.chunk.chunk_text,
        index: r.chunk.chunk_index,
        similarity: r.similarity
      }))
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    let text = "";

    if (req.file.mimetype === "application/pdf") {
      // Handle PDF
      const dataBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      try {
        const data = await parser.getText();
        text = data.text;
      } finally {
        await parser.destroy();
      }
    } else if (req.file.mimetype === "text/plain") {
      // Handle TXT
      text = fs.readFileSync(filePath, "utf8");
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return res.status(400).json({ 
        error: "No extractable text found in the document. Please ensure it is a text-based PDF/TXT and not scanned." 
      });
    }

    // Save chunks + embeddings in MongoDB
    const docId = req.file.filename;
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      await Chunk.create({
        doc_id: docId,
        chunk_index: i,
        chunk_text: chunks[i],
        embedding
      });
    }
     
    // Save extracted text as UTF-8 .txt file
    const utf8Path = path.join("uploads", `${req.file.filename}.txt`);
    fs.writeFileSync(utf8Path, text, "utf8");
    res.json({ message: "Document processed and stored", chunks: chunks.length, docId: docId });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message || "Failed to process file" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
