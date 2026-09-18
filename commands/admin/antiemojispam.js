const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiemojispam')
    .setDescription('Enable or disable anti-emoji-spam protection.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Enable or disable anti-emoji-spam.')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'enable' },
          { name: 'disable', value: 'disable' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Max number of emojis allowed per user in the time window (e.g. 5).')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Time window to count emojis (e.g. 10s, 5s, 30s).')
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

    settings.antiEmojiSpam = action === 'enable';

    // Only update limit/duration if provided
    if (limitInput !== null) settings.emojiLimit = limitInput;
    if (durationSeconds !== null) settings.emojiDuration = durationSeconds;

    await settings.save();

    const automodOn = settings.automodEnabled;
    const statusText = settings.antiEmojiSpam ? 'enabled ✅' : 'disabled ❌';

    const embed = new EmbedBuilder()
      .setTitle('🎭 Anti-Emoji-Spam Toggled')
      .setColor(settings.antiEmojiSpam ? 'Green' : 'Red')
      .setDescription(
        `Anti-emoji-spam protection is now **${statusText}**.\n\n` +
        `**Current Settings:**\n` +
        `• Max Emojis: **${settings.emojiLimit}** per user\n` +
        `• Time Window: **${settings.emojiDuration}s**\n\n` +
        (settings.antiEmojiSpam && !automodOn
          ? '⚠️ **Note:** Automod is currently **disabled**. This will not take effect until you enable it with `/automode enable`.'
          : '')
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
