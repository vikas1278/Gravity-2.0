const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automode')
    .setDescription('Enable or disable Automod for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Choose to enable or disable Automod.')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'enable' },
          { name: 'disable', value: 'disable' }
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const action = interaction.options.getString('action');

    let settings = await GuildSettings.findOne({ guildId });
    if (!settings) {
      settings = new GuildSettings({ guildId });
    }

    settings.automodEnabled = action === 'enable';
    await settings.save();

    const status = settings.automodEnabled ? 'enabled ✅' : 'disabled ❌';
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Automod Updated')
      .setDescription(
        `Automod is now **${status}**.\n\n` +
        `**Current Settings:**\n` +
        `• Anti-Link: **${settings.antiLink ? 'ON' : 'OFF'}**\n` +
        `• Anti-Spam: **${settings.antiSpam ? 'ON' : 'OFF'}**\n` +
        `• Anti-Image-Spam: **${settings.antiImageSpam ? 'ON' : 'OFF'}**\n` +
        `• Anti-Emoji-Spam: **${settings.antiEmojiSpam ? 'ON' : 'OFF'}**\n` +
        `• Anti-Sticker-Spam: **${settings.antiStickerSpam ? 'ON' : 'OFF'}**`
      )
      .setColor(settings.automodEnabled ? 'Green' : 'Red')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
