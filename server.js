require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bot = require("./bot/telegramBot");
require("./bot/handlers"); // Your message handlers

const app = express();

/* =========================
   GLOBAL MIDDLEWARE
========================= */
app.use(cors()); // Allow all origins
app.use(express.json());

/* =========================
   SAFETY: PREVENT CRASHES
========================= */
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

/* =========================
   TELEGRAM WEBHOOK ENDPOINT
========================= */
app.post(`/bot${process.env.TELEGRAM_TOKEN}`, async (req, res) => {
  try {
    console.log("Telegram update received");
    await bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("Telegram webhook error:", err);
    res.sendStatus(500);
  }
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("Sophor Telegram Bot is running 🚀");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
