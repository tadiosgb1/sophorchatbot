const bot = require("./telegramBot");

bot.on("message", async (msg) => {
    console.log("/start is called")
  try {
    const chatId = msg.chat.id;
    const text = msg.text || "";

    // Default reply
    let reply = "Sorry, I didn't understand that 🤖";

    // Simple commands
    if (text === "/start") {
      reply = "Welcome to Sophor Bot 👋\nHow can I help you?";
    } else if (text.toLowerCase().includes("price")) {
      reply = "Our pricing starts at $99/month 💰";
    }

    // Send reply
    await bot.sendMessage(chatId, reply);

  } catch (error) {
    console.error("Bot error:", error);
  }
});
