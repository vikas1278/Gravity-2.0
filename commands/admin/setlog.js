const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const { updateLogCache } = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Configure log channels for different categories')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Log category to configure')
        .setRequired(true)
        .addChoices(
          { name: '🌐 All Logs (Set ALL log categories)', value: 'all' },
          { name: '🔨 Moderation Logs (Ban, Kick, Mute, Timeout, Warn)', value: 'mod' },
          { name: '💬 Message Logs (Message Delete, Edit)', value: 'message' },
          { name: '🔊 Voice Logs (Member Move, Voice Activity)', value: 'voice' },
          { name: '🛡️ Automod Logs (Anti-Link, Anti-Spam, Ghost Ping)', value: 'automod' }
        ))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Target text channel for logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guild.id;

    let settings = await GuildSettings.findOne({ guildId }) || new GuildSettings({ guildId });

    let typeName = 'All Logs';
    if (type === 'all') {
      settings.logChannelId = channel.id;
      settings.modLogChannelId = channel.id;
      settings.msgLogChannelId = channel.id;
      settings.voiceLogChannelId = channel.id;
      settings.automodLogChannelId = channel.id;
      typeName = '🌐 All Log Categories';
    } else if (type === 'mod') {
      settings.modLogChannelId = channel.id;
      typeName = '🔨 Moderation Logs';
    } else if (type === 'message') {
      settings.msgLogChannelId = channel.id;
      typeName = '💬 Message Logs';
    } else if (type === 'voice') {
      settings.voiceLogChannelId = channel.id;
      typeName = '🔊 Voice Logs';
    } else if (type === 'automod') {
      settings.automodLogChannelId = channel.id;
      typeName = '🛡️ Automod Logs';
    }

    await settings.save();
    updateLogCache(guildId, settings);

    const displayChannel = (id) => id ? `<#${id}>` : '*Not set*';

    const embed = new EmbedBuilder()
      .setTitle('✅ Log Channel Configured')
      .setDescription(`Successfully set **${typeName}** channel to ${channel}`)
      .addFields(
        { name: '🔨 Mod Logs', value: displayChannel(settings.modLogChannelId), inline: true },
        { name: '💬 Message Logs', value: displayChannel(settings.msgLogChannelId), inline: true },
        { name: '🔊 Voice Logs', value: displayChannel(settings.voiceLogChannelId), inline: true },
        { name: '🛡️ Automod Logs', value: displayChannel(settings.automodLogChannelId), inline: true },
        { name: '🌐 General / Fallback', value: displayChannel(settings.logChannelId), inline: true }
      )
      .setColor('Green')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
