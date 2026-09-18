require('dotenv').config();

module.exports = {
  TOKEN: process.env.TOKEN,
  language: "en",
  ownerID: process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',') : [],
  mongodbUri: process.env.MONGODB_URI,
  setupFilePath: './commands/setup.json',
  commandsDir: './commands',
  embedColor: "#e11d2e",
  customEmoji: true,  // true = use custom emoji IDs from emoji.js, false = use default unicode
  emojiTheme: "purplewhite", // active custom emoji theme key in emoji.js
  helpBannerUrl: "https://cdn.discordapp.com/attachments/1321125678736871464/1535900895466885120/b957edde-3442-4b7a-a1be-c6a764ec73f1.png?ex=6a7972ad&is=6a78212d&hm=7e86c56190d93b252cd3ed75998d63ea09f6bc552ed4097e1d3d81cb7ad2f0b5&", // Optional: set a direct image URL to show an inline banner in /help
  activityName: "Gravity Bot 3.0",
  activityType: "WATCHING",  // Available activity types : LISTENING , PLAYING
  SupportServer: "https://discord.gg/Cqc9qK4uNW",
  embedTimeout: 5,
  // Performance optimizations for low-memory environments (512MB RAM)
  errorLog: process.env.ERROR_LOG || ""
}
