const {
  SlashCommandBuilder,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MediaGalleryBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const config = require('../../config.js');
const fs = require('fs');
const path = require('path');
const { getLang } = require('../../utils/languageLoader');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const { safeDeferReply, stripLeadingIcons } = require('../../utils/responseHandler');
const { isOwner } = require('../../utils/ownerCheck');

const ALL_CATEGORIES = ['info', 'general', 'utility', 'moderation', 'admin', 'owner'];

const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Get information about Gravity Bot and its commands")
  .addStringOption(option =>
    option.setName("category")
      .setDescription("Select a category to view")
      .setRequired(false)
      .addChoices(
        { name: "🏠 Main Menu", value: "main" },
        { name: "🛡️ Moderation Commands", value: "moderation" },
        { name: "👑 Admin & AutoMod Commands", value: "admin" },
        { name: "📊 Info Commands", value: "info" },
        { name: "ℹ️ General Commands", value: "general" },
        { name: "🔧 Utility Commands", value: "utility" }
      )
  );

const COMMAND_MENTION_CACHE_TTL_MS = 5 * 60 * 1000;
const commandMentionCache = new Map();

function getVisibleCategories(interaction) {
  const userIsOwner = isOwner(interaction.user.id);
  const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;
  const member = interaction.member;

  let hasAdmin = userIsOwner || isGuildOwner;
  let hasMod = userIsOwner || isGuildOwner;

  if (member && member.permissions) {
    if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      hasAdmin = true;
      hasMod = true;
    }
    if (member.permissions.has(PermissionFlagsBits.BanMembers) ||
        member.permissions.has(PermissionFlagsBits.KickMembers) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
        member.permissions.has(PermissionFlagsBits.MoveMembers) ||
        member.permissions.has(PermissionFlagsBits.MuteMembers) ||
        member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      hasMod = true;
    }
  }

  const categories = ['info', 'general', 'utility'];

  if (hasMod) categories.push('moderation');
  if (hasAdmin) categories.push('admin');
  if (userIsOwner || isGuildOwner || hasAdmin) categories.push('owner');

  return categories;
}

function getCommandCategory(commandName) {
  const commandsDir = path.resolve(__dirname, '../../commands');

  for (const folder of ALL_CATEGORIES) {
    const folderPath = path.join(commandsDir, folder);
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
      for (const file of files) {
        try {
          const cmd = require(path.join(folderPath, file));
          if (cmd.data && cmd.data.name === commandName) {
            return folder;
          }
        } catch (_) {}
      }
    }
  }

  return 'general';
}

function groupCommandsByCategory(client) {
  const grouped = {};
  ALL_CATEGORIES.forEach(c => { grouped[c] = []; });

  client.commands.forEach((cmd, name) => {
    const category = cmd.category || getCommandCategory(name);
    if (grouped[category]) {
      grouped[category].push(cmd);
    } else {
      if (!grouped.general) grouped.general = [];
      grouped.general.push(cmd);
    }
  });

  return grouped;
}

function formatUptime(secondsTotal) {
  const days = Math.floor(secondsTotal / (3600 * 24));
  const hours = Math.floor((secondsTotal % (3600 * 24)) / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = Math.floor(secondsTotal % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getPingStatus(ping) {
  if (ping <= 90) return `${getEmoji('success')} Excellent`;
  if (ping <= 180) return `${getEmoji('success')} Good`;
  if (ping <= 280) return `${getEmoji('warning')} Stable`;
  return `${getEmoji('error')} High`;
}

function getCommandRef(commandName, mentionMap) {
  if (!mentionMap) return `/${commandName}`;
  return mentionMap.get(commandName) || `/${commandName}`;
}

async function getCommandMentionMap(client, interaction) {
  const guildId = interaction.guildId || 'global';
  const cache = commandMentionCache.get(guildId);
  const now = Date.now();

  if (cache && (now - cache.fetchedAt) < COMMAND_MENTION_CACHE_TTL_MS) {
    return cache.map;
  }

  const mentionMap = new Map();

  try {
    if (client.application?.commands) {
      const globalCommands = await client.application.commands.fetch();
      globalCommands.forEach((command) => {
        if (command.type === 1) {
          mentionMap.set(command.name, `</${command.name}:${command.id}>`);
        }
      });
    }
  } catch (_) { }

  try {
    if (interaction.guild?.commands) {
      const guildCommands = await interaction.guild.commands.fetch();
      guildCommands.forEach((command) => {
        if (command.type === 1) {
          mentionMap.set(command.name, `</${command.name}:${command.id}>`);
        }
      });
    }
  } catch (_) { }

  commandMentionCache.set(guildId, {
    fetchedAt: now,
    map: mentionMap
  });

  return mentionMap;
}

function getCategoryMeta(lang, categoryKey) {
  const fallback = {
    admin: { name: 'Admin & AutoMod', description: 'Configure bot settings, auto-responses, anti-link, and anti-spam filters' },
    general: { name: 'General & Basic Commands', description: 'Bot ping, stats, support, help, avatar, math calculations, and role member list' },
    info: { name: 'Information Commands', description: 'Detailed server, user, channel, emoji, and bot information' },
    moderation: { name: 'Moderation Commands', description: 'Kick, ban, mute, warn, clear messages, and voice channel controls' },
    owner: { name: 'Owner Commands', description: 'Developer options, bot status, and server management (Bot Owner Only)' },
    utility: { name: 'Utility Commands', description: 'Language settings, history, TTS, and features' }
  };

  const langCategory = lang?.help?.categories?.[categoryKey] || {};
  const fallbackCategory = fallback[categoryKey] || fallback.general;

  return {
    name: langCategory.name || fallbackCategory.name,
    description: langCategory.description || fallbackCategory.description
  };
}

function createNavigationButton(label, customId, emojiKey, style, disabled = false) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(stripLeadingIcons(label))
    .setStyle(style)
    .setDisabled(disabled);

  const emoji = getButtonEmoji(emojiKey);
  if (emoji) button.setEmoji(emoji);

  return button;
}

function buildTabsRows(activeKey, visibleCategories) {
  const styleFor = (key) => activeKey === key ? ButtonStyle.Danger : ButtonStyle.Secondary;

  const allButtons = [
    createNavigationButton('Overview', 'help_tab_overview', 'home', styleFor('overview'))
  ];

  const categoryLabels = {
    moderation: 'Moderation',
    admin: 'Admin',
    info: 'Info',
    general: 'General',
    utility: 'Utility',
    owner: 'Owner'
  };

  visibleCategories.forEach(cat => {
    const label = categoryLabels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
    allButtons.push(createNavigationButton(label, `help_tab_${cat}`, cat, styleFor(cat)));
  });

  const rows = [];
  for (let i = 0; i < allButtons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(allButtons.slice(i, i + 5)));
  }

  return rows;
}

function buildControlsRow(backCustomId) {
  return new ActionRowBuilder().addComponents(
    createNavigationButton('Back', backCustomId, 'home', ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('help_close')
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  );
}

function buildCommandSelect(categoryKey, commands) {
  const options = commands
    .slice(0, 25)
    .map((cmd) => ({
      label: `/${cmd.data.name}`,
      description: (cmd.data.description || 'No description').slice(0, 100),
      value: cmd.data.name
    }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`help_select_${categoryKey}`)
      .setPlaceholder('Select a command for detailed info')
      .addOptions(options)
  );
}

function buildCard(title, sections, actionRows = [], banner = null) {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent(`## ${title}`));

  if (banner) {
    container
      .addSeparatorComponents((separator) => separator)
      .addMediaGalleryComponents(banner);
  }

  for (const section of sections) {
    container
      .addSeparatorComponents((separator) => separator)
      .addTextDisplayComponents((textDisplay) => textDisplay.setContent(section));
  }

  if (actionRows.length) {
    container
      .addSeparatorComponents((separator) => separator)
      .addActionRowComponents(actionRows);
  }

  return container;
}

function buildHelpBanner() {
  const bannerUrl = String(config.helpBannerUrl || '').trim();
  if (!bannerUrl) return null;

  try {
    new URL(bannerUrl);
  } catch (_) {
    return null;
  }

  return new MediaGalleryBuilder().addItems(
    (mediaItem) => mediaItem
      .setURL(bannerUrl)
      .setDescription('Help Banner')
  );
}

function buildRotatingCommandHint(commandMentionMap) {
  const rotating = ['play', 'queue', 'join', 'leave', 'vcdisconnect', 'vcdisconnectall', 'ban', 'warn', 'autoresponse', 'toggle-automod', 'search', 'history', 'stats'];
  const start = Math.floor(Date.now() / 30000) % rotating.length;
  const picks = [
    rotating[start],
    rotating[(start + 1) % rotating.length],
    rotating[(start + 2) % rotating.length],
    rotating[(start + 3) % rotating.length],
    rotating[(start + 4) % rotating.length]
  ];

  const refs = picks.map((name) => getCommandRef(name, commandMentionMap));
  return `${getEmoji('search')} Try: ${refs.join(' • ')}`;
}

function buildMainBody(client, lang, groupedCommands, commandMentionMap, visibleCategories) {
  const botName = client.user?.username || 'Gravity Bot';
  const totalCommands = client.commands.size;
  const totalServers = client.guilds.cache.size;
  const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
  const uptime = formatUptime(process.uptime());
  const ping = client.ws.ping;

  const pingStatus = getPingStatus(ping);

  const categoriesList = visibleCategories.map(catKey => {
    const meta = getCategoryMeta(lang, catKey);
    const count = (groupedCommands[catKey] || []).length;
    return `• ${getEmoji(catKey)} **${meta.name}**: **${count}** commands`;
  }).join('\n');

  return [
    [
      `### ${getEmoji('commands')} Overview`,
      `• Commands: **${totalCommands}**`,
      `• Servers: **${totalServers}**`,
      `• Users: **${totalUsers.toLocaleString()}**`,
      `• Uptime: **${uptime}**`,
      `• Ping: **${ping}ms** (${pingStatus})`
    ].join('\n'),
    [
      `### ${getEmoji('folder')} Available Categories`,
      categoriesList
    ].join('\n'),
    `${getEmoji('home')} Select a tab below to view category commands.`,
    buildRotatingCommandHint(commandMentionMap)
  ];
}

function renderCategoryTree(categoryKey, commands, commandMentionMap) {
  const lines = commands.map(cmd => {
    const name = cmd.data.name;
    const desc = cmd.data.description || 'No description';
    const ref = getCommandRef(name, commandMentionMap);
    return `• ${ref} — *${desc}*`;
  });

  return lines.length ? lines.join('\n').trim() : '`No commands available.`';
}

function buildCategoryBody(lang, groupedCommands, categoryKey, commandMentionMap) {
  const categoryMeta = getCategoryMeta(lang, categoryKey);
  const commands = groupedCommands[categoryKey] || [];
  const sortedCommands = [...commands].sort((a, b) => a.data.name.localeCompare(b.data.name));
  const tree = sortedCommands.length
    ? renderCategoryTree(categoryKey, sortedCommands, commandMentionMap)
    : '`No commands available in this category.`';

  return [
    `${categoryMeta.description}`,
    `### ${getEmoji('folder')} Commands (${sortedCommands.length})\n${tree}`,
    `${getEmoji('search')} Select a command below to view details.`
  ];
}

function buildCommandDetailsBody(lang, categoryKey, command, commandMentionMap) {
  const categoryMeta = getCategoryMeta(lang, categoryKey);
  const json = typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
  const commandRef = getCommandRef(json.name, commandMentionMap);
  const options = (json.options || [])
    .map((opt) => `• \`${opt.name}\`: ${opt.description || 'No description'}`)
    .join('\n');

  return [
    `${getEmoji('commands')} **/${json.name}**\n${json.description || 'No description available.'}`,
    [
      `### ${getEmoji(categoryKey)} Category`,
      `• ${categoryMeta.name}`,
      `• Run: ${commandRef}`
    ].join('\n'),
    `### ${getEmoji('settings')} Options\n${options || '`No options for this command.`'}`
  ];
}

function buildExpiredBody(client) {
  const sample = ['help', 'play', 'ban', 'warn', 'queue', 'stats'].map((c) => `\`${c}\``).join(', ');
  return [
    `${getEmoji('warning')} **This interaction expired**\nRun the command again to open a fresh help panel.`,
    `${getEmoji('commands')} Quick commands: ${sample}`
  ];
}

function sendHelpResponse(interaction, components) {
  const response = {
    components,
    flags: MessageFlags.IsComponentsV2
  };

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  }

  if (interaction.isButton?.() || interaction.isStringSelectMenu?.()) {
    return interaction.update(response);
  }

  return interaction.reply(response);
}

async function showMainMenu(client, interaction) {
  const visibleCategories = getVisibleCategories(interaction);
  const lang = await getLang(interaction.guildId).catch(() => ({}));
  const groupedCommands = groupCommandsByCategory(client);
  const commandMentionMap = await getCommandMentionMap(client, interaction);
  const banner = buildHelpBanner();
  const card = buildCard(
    `${getEmoji('help')} ${client.user?.username || 'Gravity Bot'} Control Panel`,
    buildMainBody(client, lang, groupedCommands, commandMentionMap, visibleCategories),
    buildTabsRows('overview', visibleCategories),
    banner
  );

  return sendHelpResponse(interaction, [card]);
}

async function showCategoryPage(client, interaction, categoryKey) {
  const visibleCategories = getVisibleCategories(interaction);
  if (!visibleCategories.includes(categoryKey)) {
    return showMainMenu(client, interaction);
  }

  const lang = await getLang(interaction.guildId).catch(() => ({}));
  const groupedCommands = groupCommandsByCategory(client);
  const commandMentionMap = await getCommandMentionMap(client, interaction);
  const banner = buildHelpBanner();
  const safeCategory = visibleCategories.includes(categoryKey) ? categoryKey : 'general';
  const categoryCommands = [...(groupedCommands[safeCategory] || [])].sort((a, b) => a.data.name.localeCompare(b.data.name));
  const actionRows = [...buildTabsRows(safeCategory, visibleCategories)];
  if (categoryCommands.length) {
    actionRows.push(buildCommandSelect(safeCategory, categoryCommands));
  }
  actionRows.push(buildControlsRow('help_back_overview'));

  const card = buildCard(
    `${getEmoji(safeCategory)} ${getCategoryMeta(lang, safeCategory).name}`,
    buildCategoryBody(lang, groupedCommands, safeCategory, commandMentionMap),
    actionRows,
    banner
  );

  return sendHelpResponse(interaction, [card]);
}

async function showCommandDetails(client, interaction, categoryKey, commandName) {
  const visibleCategories = getVisibleCategories(interaction);
  if (!visibleCategories.includes(categoryKey)) {
    return showMainMenu(client, interaction);
  }

  const lang = await getLang(interaction.guildId).catch(() => ({}));
  const groupedCommands = groupCommandsByCategory(client);
  const commandMentionMap = await getCommandMentionMap(client, interaction);
  const banner = buildHelpBanner();
  const safeCategory = visibleCategories.includes(categoryKey) ? categoryKey : 'general';
  const categoryCommands = [...(groupedCommands[safeCategory] || [])].sort((a, b) => a.data.name.localeCompare(b.data.name));
  const command = categoryCommands.find((cmd) => cmd.data.name === commandName);

  if (!command) {
    return showCategoryPage(client, interaction, safeCategory);
  }

  const actionRows = [
    ...buildTabsRows(safeCategory, visibleCategories),
    buildCommandSelect(safeCategory, categoryCommands),
    buildControlsRow(`help_back_cat_${safeCategory}`)
  ];

  const card = buildCard(
    `${getEmoji('commands')} Command Details`,
    buildCommandDetailsBody(lang, safeCategory, command, commandMentionMap),
    actionRows,
    banner
  );

  return sendHelpResponse(interaction, [card]);
}

async function showExpired(client, interaction) {
  const banner = buildHelpBanner();
  const card = buildCard(
    'Bot Information',
    buildExpiredBody(client),
    [],
    banner
  );

  return sendHelpResponse(interaction, [card]);
}

async function renderFromSelection(client, interaction, selectedCategory) {
  if (selectedCategory === 'main' || selectedCategory === 'home' || selectedCategory === 'overview') {
    return showMainMenu(client, interaction);
  }

  return showCategoryPage(client, interaction, selectedCategory);
}

async function handleComponent(client, interaction) {
  const customId = interaction.customId;

  if (customId === 'help_close') {
    return showExpired(client, interaction);
  }

  if (customId === 'help_back_main' || customId === 'help_back_overview' || customId === 'help_home') {
    return showMainMenu(client, interaction);
  }

  if (customId.startsWith('help_back_cat_')) {
    const category = customId.replace('help_back_cat_', '');
    return showCategoryPage(client, interaction, category);
  }

  if (customId.startsWith('help_tab_')) {
    const tab = customId.replace('help_tab_', '');
    return renderFromSelection(client, interaction, tab);
  }

  if (customId.startsWith('help_cat_')) {
    const category = customId.replace('help_cat_', '');
    return showCategoryPage(client, interaction, category);
  }

  if (customId === 'help_category_select') {
    const selectedCategory = interaction.values[0];
    return renderFromSelection(client, interaction, selectedCategory);
  }

  if (customId.startsWith('help_select_')) {
    const category = customId.replace('help_select_', '');
    const commandName = interaction.values[0];
    return showCommandDetails(client, interaction, category, commandName);
  }
}

module.exports = {
  data: data,
  helpers: {
    showMainMenu,
    showCategoryPage,
    showCommandDetails,
    showExpired,
    renderFromSelection,
    handleComponent,
    groupCommandsByCategory
  },
  run: async (client, interaction) => {
    try {
      const deferred = await safeDeferReply(interaction);
      if (!deferred && !interaction.deferred && !interaction.replied) return;
      const selectedCategory = interaction.options.getString('category') || 'main';

      return renderFromSelection(client, interaction, selectedCategory);
    } catch (e) {
      console.error('Error in help command:', e);

      try {
        const errorCard = buildCard(
          'Help Error',
          ['❌ Failed to load the help interface. Please try again.']
        );

        return interaction.editReply({
          components: [errorCard],
          flags: MessageFlags.IsComponentsV2
        });
      } catch (_) {
        return interaction.editReply({ content: '❌ Failed to load help.' });
      }
    }
  },
  execute: async (interaction) => {
    return module.exports.run(interaction.client, interaction);
  }
};
