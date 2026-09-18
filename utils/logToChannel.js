// utils/logToChannel.js
const { EmbedBuilder } = require('discord.js');
const GuildSettings = require('../models/GuildSettings');

const logSettingsCache = new Map();

// Modern Hex Color Palette
const COLOR_MAP = {
  Red: '#FF3355',       // Vivid Crimson
  Green: '#06D6A0',     // Emerald Green
  Blue: '#5865F2',      // Discord Blurple
  Orange: '#FF9F1C',    // Cyber Amber
  Yellow: '#FFC43D',    // Electric Gold
  Purple: '#9D4EDD',    // Neon Purple
  Cyan: '#00B4D8',      // Bright Cyan
  Grey: '#6C757D',      // Slate Grey
  Dark: '#2B2D31'       // Obsidian Dark
};

// Category Header Tags
const CATEGORY_HEADERS = {
  mod: '📜 MODERATION AUDIT LOG',
  automod: '🛡️ AUTOMOD SECURITY LOG',
  message: '💬 MESSAGE AUDIT LOG',
  voice: '🎙️ VOICE ACTIVITY LOG',
  default: '📊 SERVER AUDIT LOG'
};

async function getGuildSettings(guildId) {
  if (logSettingsCache.has(guildId)) {
    return logSettingsCache.get(guildId);
  }
  try {
    const settings = await GuildSettings.findOne({ guildId });
    if (settings) {
      const plainSettings = typeof settings.toObject === 'function' ? settings.toObject() : settings;
      logSettingsCache.set(guildId, plainSettings);
      return plainSettings;
    }
  } catch (e) {
    console.error('Database fetch error in logger:', e.message);
  }
  return null;
}

function updateLogCache(guildId, newSettings) {
  const plainSettings = typeof newSettings.toObject === 'function' ? newSettings.toObject() : newSettings;
  logSettingsCache.set(guildId, plainSettings);
}

function resolveColor(color) {
  if (!color) return COLOR_MAP.Blue;
  if (color.startsWith('#')) return color;
  return COLOR_MAP[color] || COLOR_MAP.Blue;
}

function formatFieldValue(name, value) {
  if (!value || typeof value !== 'string') return value;
  const lowerName = name.toLowerCase();

  // Highlight blockquote formatting for long text or reason/content
  if (['reason', 'content', 'message', 'before', 'after', 'details', 'violation'].includes(lowerName)) {
    if (!value.startsWith('>') && !value.startsWith('```')) {
      return value.split('\n').map(line => `> ${line}`).join('\n');
    }
  }
  return value;
}

async function logToChannel(guild, embedData, type = 'mod') {
  if (!guild) return;

  const settings = await getGuildSettings(guild.id);
  if (!settings) return;

  let targetChannelId = null;
  if (type === 'voice') {
    targetChannelId = settings.voiceLogChannelId || settings.logChannelId;
  } else if (type === 'message') {
    targetChannelId = settings.msgLogChannelId || settings.logChannelId;
  } else if (type === 'automod') {
    targetChannelId = settings.automodLogChannelId || settings.logChannelId;
  } else if (type === 'mod') {
    targetChannelId = settings.modLogChannelId || settings.logChannelId;
  } else {
    targetChannelId = settings.logChannelId;
  }

  if (!targetChannelId) return;

  let logChannel = guild.channels.cache.get(targetChannelId);
  if (!logChannel) {
    try {
      logChannel = await guild.channels.fetch(targetChannelId);
    } catch (e) {
      return;
    }
  }

  if (!logChannel) return;

  const color = resolveColor(embedData.color);
  const headerTag = CATEGORY_HEADERS[type] || CATEGORY_HEADERS.default;
  const guildIcon = guild.iconURL({ dynamic: true });

  const embed = new EmbedBuilder()
    .setAuthor({
      name: headerTag,
      iconURL: guildIcon || undefined
    })
    .setTitle(embedData.title)
    .setColor(color)
    .setTimestamp();

  if (embedData.description) {
    embed.setDescription(embedData.description);
  }

  // Target avatar / thumbnail logic
  let avatarUrl = null;
  if (embedData.user) {
    if (typeof embedData.user.displayAvatarURL === 'function') {
      avatarUrl = embedData.user.displayAvatarURL({ dynamic: true, size: 256 });
    } else if (typeof embedData.user.user?.displayAvatarURL === 'function') {
      avatarUrl = embedData.user.user.displayAvatarURL({ dynamic: true, size: 256 });
    }
  } else if (embedData.thumbnail) {
    avatarUrl = embedData.thumbnail;
  }

  // Extract mention user avatar if not explicitly passed
  if (!avatarUrl && embedData.fields && Array.isArray(embedData.fields)) {
    for (const f of embedData.fields) {
      const match = typeof f.value === 'string' ? f.value.match(/<@!?(\d+)>/) : null;
      if (match && match[1]) {
        const foundMember = guild.members.cache.get(match[1]);
        if (foundMember) {
          avatarUrl = foundMember.user.displayAvatarURL({ dynamic: true, size: 256 });
          break;
        }
      }
    }
  }

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  // Format fields
  if (embedData.fields && Array.isArray(embedData.fields)) {
    const formattedFields = embedData.fields.map(f => ({
      name: f.name,
      value: formatFieldValue(f.name, f.value),
      inline: typeof f.inline === 'boolean' ? f.inline : false
    }));
    embed.addFields(...formattedFields);
  }

  // Set modern footer
  embed.setFooter({
    text: `${guild.name} • Event Logger`,
    iconURL: guildIcon || undefined
  });

  logChannel.send({ embeds: [embed] }).catch(err => console.error('Failed to send log:', err.message));
}

module.exports = logToChannel;
module.exports.updateLogCache = updateLogCache;

