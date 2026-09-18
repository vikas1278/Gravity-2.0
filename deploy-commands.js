require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config.js');

async function deployCommands(clientId = null) {
  const commands = [];
  const ds = path.join(__dirname, 'commands');

  if (fs.existsSync(ds)) {
    fs.readdirSync(ds).forEach(dir => {
      const subPath = path.join(ds, dir);
      if (fs.lstatSync(subPath).isDirectory()) {
        const commandFiles = fs.readdirSync(subPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
          try {
            const command = require(path.join(subPath, file));
            if (command.data) {
              const cmdJSON = typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
              commands.push(cmdJSON);
            }
          } catch (err) {
            console.error(`❌ Error reading command file ${file}:`, err.message);
          }
        }
      }
    });
  }

  const token = process.env.DISCORD_TOKEN || process.env.TOKEN || config.TOKEN;
  const targetClientId = clientId || process.env.CLIENT_ID || config.clientId;

  if (!token) {
    console.warn('⚠️ No bot token found for deploying slash commands.');
    return;
  }

  if (!targetClientId) {
    console.warn('⚠️ No CLIENT_ID found. Command deployment will be performed automatically on client login.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`🔁 Auto-deploying ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(targetClientId),
      { body: commands }
    );
    console.log(`✅ Successfully deployed ${commands.length} slash commands globally!`);
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error.message);
  }
}

module.exports = deployCommands;

if (require.main === module) {
  deployCommands().then(() => process.exit(0)).catch(() => process.exit(1));
}
