const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema({
  doc_id: String,
  chunk_index: Number,
  chunk_text: String,
  embedding: [Number]
});

module.exports = mongoose.model("Chunk", chunkSchema);
