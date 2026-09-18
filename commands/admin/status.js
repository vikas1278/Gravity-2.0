const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('View the current Automod toggle status for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guild.id;

    let settings = await GuildSettings.findOne({ guildId });
    if (!settings) {
      settings = new GuildSettings({ guildId });
      await settings.save();
    }

    const status = (flag) => flag ? '✅ Enabled' : '❌ Disabled';

    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Automod Status for ${interaction.guild.name}`)
      .setColor('Blue')
      .addFields(
        { name: 'Automod', value: status(settings.automodEnabled), inline: true },
        { name: 'Anti-Link', value: status(settings.antiLink), inline: true },
        { name: 'Anti-Spam', value: status(settings.antiSpam), inline: true },
        { name: 'Anti-GhostPing', value: status(settings.antiGhostPing), inline: true },
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
