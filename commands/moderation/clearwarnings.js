const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warn = require('../../models/Warn');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Clear all warnings for a user')
    .addUserOption(option => option.setName('user').setDescription('User to clear warnings for').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const result = await Warn.findOneAndDelete({ userId: user.id, guildId: interaction.guild.id });

    const embed = new EmbedBuilder()
      .setTitle('🧹 Warnings Cleared')
      .setDescription(result ? `Cleared all warnings for ${user.tag}` : `No warnings to clear for ${user.tag}`)
      .setColor('Green')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await logToChannel(interaction.guild, {
      title: '🧹 Warnings Cleared',
      fields: [
        { name: 'User', value: `<@${user.id}>`, inline: true },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
      ],
      color: 'Green'
    });
  }
};
