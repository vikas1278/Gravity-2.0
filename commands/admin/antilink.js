const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antilink')
    .setDescription('Enable or disable anti-link protection.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Choose to enable or disable anti-link protection.')
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

    settings.antiLink = action === 'enable';
    await settings.save();

    const embed = new EmbedBuilder()
      .setTitle('🔗 Anti-Link Updated')
      .setDescription(`Anti-link protection is now **${settings.antiLink ? 'enabled ✅' : 'disabled ❌'}**.${!settings.automodEnabled ? '\n\n⚠️ **Note:** Automod is currently **disabled**. This setting will not take effect until you enable it with `/automode enable`.' : ''}`)
      .setColor(settings.antiLink ? 'Green' : 'Red');

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
