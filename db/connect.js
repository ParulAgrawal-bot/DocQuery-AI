const mongoose = require("mongoose");
const dns = require("dns");
require("dotenv").config();

// Force Node.js to use public DNS servers (Cloudflare and Google) to resolve SRV records
dns.setServers(["1.1.1.1", "8.8.8.8"]);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

module.exports = connectDB;
