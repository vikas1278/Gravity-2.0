const { Client, GatewayIntentBits, Partials } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require('path');
const { connectToDatabase } = require('./mongodb');
const colors = require('./UI/colors/colors');
const { getLang, getLangSync } = require('./utils/languageLoader.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildBans,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
});

client.config = config;


process.on('unhandledRejection', (error) => {
  const lang = getLangSync();
  console.error(lang.console?.bot?.unhandledRejection || 'Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  const lang = getLangSync();
  console.error(lang.console?.bot?.uncaughtException || 'Uncaught Exception:', error);
});

client.on("clientReady", () => {
  const lang = getLangSync();
  console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}${lang.console?.bot?.clientLogged?.replace('{tag}', client.user.tag) || `Client logged as ${client.user.tag}`}${colors.reset}`);
});
client.config = config;

// Unified Event Loader for both function exports and object exports
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    const eventName = event.name || file.split(".")[0];
    if (typeof event === "function") {
      client.on(eventName, event.bind(null, client));
    } else if (event.execute) {
      if (event.once) {
        client.once(eventName, (...args) => event.execute(...args, client));
      } else {
        client.on(eventName, (...args) => event.execute(...args, client));
      }
    }
  }
}

client.commands = new Map();
client.commandsArray = [];

const loadCommands = () => {
  const loadCommandsFromDir = (dir, category = '') => {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        loadCommandsFromDir(fullPath, item.name);
      } else if (item.isFile() && item.name.endsWith('.js')) {
        try {
          const absolutePath = path.resolve(fullPath);
          const command = require(absolutePath);

          if (command.data && (command.run || command.execute)) {
            command.category = category || path.basename(dir);
            client.commands.set(command.data.name, command);
            const cmdJSON = typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
            client.commandsArray.push(cmdJSON);
          } else {
            const lang = getLangSync();
            console.log(`${colors.cyan}[ COMMANDS ]${colors.reset} ${colors.red}${lang.console?.bot?.commandLoadFailed?.replace('{name}', item.name) || `Failed to load: ${item.name} - Missing data or run/execute property`}${colors.reset}`);
          }
        } catch (error) {
          const lang = getLangSync();
          console.error(`${colors.cyan}[ COMMANDS ]${colors.reset} ${colors.red}${lang.console?.bot?.commandLoadError?.replace('{name}', item.name).replace('{message}', error.message) || `Error loading ${item.name}: ${error.message}`}${colors.reset}`);
        }
      }
    }
  };

  const commandsDir = path.resolve(__dirname, config.commandsDir || './commands');
  loadCommandsFromDir(commandsDir);
  const lang = getLangSync();
  console.log(`${colors.cyan}[ COMMANDS ]${colors.reset} ${colors.green}${lang.console?.bot?.commandsLoaded?.replace('{count}', client.commands.size) || `Total Commands Loaded: ${client.commands.size}`}${colors.reset}`);
};

loadCommands();




client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
  const lang = getLangSync();
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}${lang.console?.bot?.tokenVerification || '🔐 TOKEN VERIFICATION'}${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}${lang.console?.bot?.tokenAuthFailed || 'Authentication Failed ❌'}${colors.reset}`);
  console.log(`${colors.gray}${lang.console?.bot?.tokenError || 'Error: Turn On Intents or Reset New Token'}${colors.reset}`);
});
connectToDatabase().then(() => {
  const lang = getLangSync();
  console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}${lang.console?.bot?.databaseOnline || 'MongoDB Online ✅'}${colors.reset}`);
}).catch((err) => {
  const lang = getLangSync();
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}${lang.console?.bot?.databaseStatus || '🕸️  DATABASE STATUS'}${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.red}${lang.console?.bot?.databaseFailed || 'Connection Failed ❌'}${colors.reset}`);
  console.log(`${colors.gray}${lang.console?.bot?.databaseError?.replace('{message}', err.message) || `Error: ${err.message}`}${colors.reset}`);
});

