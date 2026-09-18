const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antistickerspam')
    .setDescription('Enable or disable anti-sticker-spam protection.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Enable or disable anti-sticker-spam.')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'enable' },
          { name: 'disable', value: 'disable' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Max number of stickers allowed per message (e.g. 3).')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Time window to count stickers (e.g. 10s, 5s, 30s).')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const action = interaction.options.getString('action');
    const limitInput = interaction.options.getInteger('limit');
    const durationInput = interaction.options.getString('duration');

    // Parse duration string like "10s", "5s", "30s"
    let durationSeconds = null;
    if (durationInput) {
      const match = durationInput.trim().match(/^(\d+)s$/i);
      if (!match) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('Invalid Duration')
              .setDescription('Duration must be in seconds format, e.g. `10s`, `5s`, `30s`.'),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
      durationSeconds = parseInt(match[1], 10);
      if (durationSeconds < 1 || durationSeconds > 120) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('Invalid Duration')
              .setDescription('Duration must be between `1s` and `120s`.'),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    let settings = await GuildSettings.findOne({ guildId }) || new GuildSettings({ guildId });

    settings.antiStickerSpam = action === 'enable';

    if (limitInput !== null) settings.stickerLimit = limitInput;
    if (durationSeconds !== null) settings.stickerDuration = durationSeconds;

    await settings.save();

    const automodOn = settings.automodEnabled;
    const statusText = settings.antiStickerSpam ? 'enabled ✅' : 'disabled ❌';

    const embed = new EmbedBuilder()
      .setTitle('🖼️ Anti-Sticker-Spam Toggled')
      .setColor(settings.antiStickerSpam ? 'Green' : 'Red')
      .setDescription(
        `Anti-sticker-spam protection is now **${statusText}**.\n\n` +
        `**Current Settings:**\n` +
        `• Max Stickers per message: **${settings.stickerLimit}**\n` +
        `• Time Window: **${settings.stickerDuration}s**\n\n` +
        (settings.antiStickerSpam && !automodOn
          ? '⚠️ **Note:** Automod is currently **disabled**. This will not take effect until you enable it with `/automode enable`.'
          : '')
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
