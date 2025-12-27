const bot = require("./telegramBot");

// Store user sessions in memory (for simplicity)
const sessions = {};

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  // Initialize session if not exists
  if (!sessions[chatId]) {
    sessions[chatId] = { step: 0, data: {} };
  }

  const session = sessions[chatId];

  try {
    // Start command
    if (text === "/start") {
      session.step = 1;
      await bot.sendMessage(chatId, "Welcome to Sophor Bot 👋\nLet's get started. What's your full name?");
      return;
    }

    // Conversation flow
    switch (session.step) {
      case 1: // Collect full name
        session.data.fullName = text;
        session.step = 2;
        await bot.sendMessage(chatId, `Thanks, ${text}! Please provide your email address.`);
        break;

      case 2: // Collect email
        session.data.email = text;
        session.step = 3;
        await bot.sendMessage(chatId, "Great! Now, what's your phone number?");
        break;

      case 3: // Collect phone number
        session.data.phone = text;
        session.step = 4;
        await bot.sendMessage(
          chatId,
          "Awesome! Here's what we can do for you:\n\n" +
          "💻 Software Development: Website, Web App, Mobile App\n" +
          "💼 IT Consulting\n" +
          "📚 Digital Training & AI Training\n" +
          "🤖 Prompt Engineering\n\n" +
          "And our ready-made products:\n" +
          "🛒 B2C eCommerce\n" +
          "🏫 School Management\n" +
          "🏢 Property Management\n" +
          "🏥 Digital Clinic\n\n" +
          "Reply with the service or product you're interested in, or type 'menu' to see this list again."
        );
        break;

      case 4: // Handle user selection or menu
        if (text.toLowerCase() === "menu") {
          await bot.sendMessage(
            chatId,
            "Here's what we offer:\n\n" +
            "💻 Software Development: Website, Web App, Mobile App\n" +
            "💼 IT Consulting\n" +
            "📚 Digital Training & AI Training\n" +
            "🤖 Prompt Engineering\n\n" +
            "Our products:\n" +
            "🛒 B2C eCommerce\n" +
            "🏫 School Management\n" +
            "🏢 Property Management\n" +
            "🏥 Digital Clinic"
          );
        } else {
          await bot.sendMessage(chatId, `Thanks for your interest in "${text}"! Our team will contact you soon.`);
          session.step = 0; // Reset session
        }
        break;

      default:
        await bot.sendMessage(chatId, "Sorry, I didn't understand that. Type /start to begin.");
        break;
    }

  } catch (error) {
    console.error("Bot error:", error);
    await bot.sendMessage(chatId, "Oops! Something went wrong 🤖. Please try again later.");
  }
});
