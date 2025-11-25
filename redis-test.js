// redis-test.js
import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();


console.log("🔍 Testing Redis connection...");

// Log all variables so you SEE if they exist
console.log("ENV VARIABLES:");
console.log({
  REDIS_URL: process.env.REDIS_URL,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD ? "***" : "(empty)",
});

let client;

if (process.env.REDIS_URL) {
  console.log("Using REDIS_URL");
  client = new Redis(process.env.REDIS_URL);
} else {
  console.log("Using HOST/PASSWORD config");

  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    console.error("❌ Missing REDIS_HOST or REDIS_PORT — cannot connect.");
    process.exit(1);
  }

  client = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || undefined,
    connectTimeout: 5000,
  });
}

client.on("connect", () => console.log("🔌 Redis raw connection opened..."));
client.on("ready", async () => {
  console.log("✅ Redis is ready!");

  try {
    const pong = await client.ping();
    console.log("📡 PING:", pong);
  } catch (err) {
    console.error("❌ Command error:", err);
  } finally {
    client.quit();
  }
});

client.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

client.on("close", () => console.log("📴 Redis connection closed"));
