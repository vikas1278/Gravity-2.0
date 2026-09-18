const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const { updateLogCache } = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetlog')
    .setDescription('Reset or disable log channels for the server')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Log category to reset')
        .setRequired(false)
        .addChoices(
          { name: '🌐 All Logs (Reset ALL log channels)', value: 'all' },
          { name: '🔨 Moderation Logs', value: 'mod' },
          { name: '💬 Message Logs', value: 'message' },
          { name: '🔊 Voice Logs', value: 'voice' },
          { name: '🛡️ Automod Logs', value: 'automod' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const type = interaction.options.getString('type') || 'all';
    const guildId = interaction.guild.id;

    let settings = await GuildSettings.findOne({ guildId }) || new GuildSettings({ guildId });

    let typeName = 'All Log Categories';

    if (type === 'all') {
      settings.logChannelId = null;
      settings.modLogChannelId = null;
      settings.msgLogChannelId = null;
      settings.voiceLogChannelId = null;
      settings.automodLogChannelId = null;
      typeName = '🌐 All Log Categories';
    } else if (type === 'mod') {
      settings.modLogChannelId = null;
      typeName = '🔨 Moderation Logs';
    } else if (type === 'message') {
      settings.msgLogChannelId = null;
      typeName = '💬 Message Logs';
    } else if (type === 'voice') {
      settings.voiceLogChannelId = null;
      typeName = '🔊 Voice Logs';
    } else if (type === 'automod') {
      settings.automodLogChannelId = null;
      typeName = '🛡️ Automod Logs';
    }

    await settings.save();
    updateLogCache(guildId, settings);

    const displayChannel = (id) => id ? `<#${id}>` : '*Not set*';

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Log Channels Reset')
      .setDescription(`Successfully reset **${typeName}** back to \`*Not set*\`.`)
      .addFields(
        { name: '🔨 Mod Logs', value: displayChannel(settings.modLogChannelId), inline: true },
        { name: '💬 Message Logs', value: displayChannel(settings.msgLogChannelId), inline: true },
        { name: '🔊 Voice Logs', value: displayChannel(settings.voiceLogChannelId), inline: true },
        { name: '🛡️ Automod Logs', value: displayChannel(settings.automodLogChannelId), inline: true },
        { name: '🌐 General / Fallback', value: displayChannel(settings.logChannelId), inline: true }
      )
      .setColor('Orange')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
