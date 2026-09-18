const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiimagespam')
    .setDescription('Enable or disable anti-image-spam protection.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Enable or disable anti-image-spam.')
        .setRequired(true)
        .addChoices(
          { name: 'enable',  value: 'enable'  },
          { name: 'disable', value: 'disable' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Max number of images a user can send within the time window before action is taken (e.g. 3).')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Time window to count images. Min: 1s, Max: 120s (e.g. 1s, 3s, 5s, 10s, 30s).')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId       = interaction.guild.id;
    const action        = interaction.options.getString('action');
    const limitInput    = interaction.options.getInteger('limit');
    const durationInput = interaction.options.getString('duration');

    // ── Parse duration (must be Xs format) ───────────────────────────────────
    let durationSeconds = null;
    if (durationInput) {
      const match = durationInput.trim().match(/^(\d+)s$/i);
      if (!match) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('Invalid Duration')
              .setDescription('Duration must be in seconds format, e.g. `10s`, `30s`, `60s`.'),
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
              .setDescription('Duration must be between `1s` and `120s`. You can use very short windows like `3s` or `5s`.'),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    let settings = await GuildSettings.findOne({ guildId }) || new GuildSettings({ guildId });

    settings.antiImageSpam = action === 'enable';

    // Only update limit/duration if explicitly provided
    if (limitInput    !== null) settings.imageLimit    = limitInput;
    if (durationSeconds !== null) settings.imageDuration = durationSeconds;

    await settings.save();

    const automodOn  = settings.automodEnabled;
    const statusText = settings.antiImageSpam ? 'enabled ✅' : 'disabled ❌';

    const embed = new EmbedBuilder()
      .setTitle('🖼️ Anti-Image-Spam Updated')
      .setColor(settings.antiImageSpam ? 'Green' : 'Red')
      .setDescription(
        `Anti-image-spam protection is now **${statusText}**.\n\n` +
        `**Current Settings:**\n` +
        `• Max Images: **${settings.imageLimit}** per user\n` +
        `• Time Window: **${settings.imageDuration}s**\n\n` +
        (settings.antiImageSpam && !automodOn
          ? '⚠️ **Note:** Automod is currently **disabled**. This will not take effect until you enable it with `/automode enable`.'
          : '')
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
