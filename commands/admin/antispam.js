const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Enable or disable anti-spam protection.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Choose to enable or disable anti-spam protection.')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'enable' },
          { name: 'disable', value: 'disable' }
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const action = interaction.options.getString('action');
    let settings = await GuildSettings.findOne({ guildId }) || new GuildSettings({ guildId });

    settings.antiSpam = action === 'enable';
    await settings.save();

    const embed = new EmbedBuilder()
      .setTitle('🚫 Anti-Spam Updated')
      .setDescription(`Anti-spam protection is now **${settings.antiSpam ? 'enabled ✅' : 'disabled ❌'}**.${!settings.automodEnabled ? '\n\n⚠️ **Note:** Automod is currently **disabled**. This setting will not take effect until you enable it with `/automode enable`.' : ''}`)
      .setColor(settings.antiSpam ? 'Green' : 'Red');

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
