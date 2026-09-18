const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .addStringOption(option =>
      option.setName('user_id').setDescription('User ID to unban').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.unban(userId, reason);

      const embed = new EmbedBuilder()
        .setTitle('🔓 Member Unbanned')
        .setDescription(`Unbanned <@${userId}>`)
        .addFields({ name: 'Reason', value: reason })
        .setColor('Green')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await logToChannel(interaction.guild, {
        title: '🔓 User Unbanned',
        fields: [
          { name: 'User', value: `<@${userId}>`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason }
        ],
        color: 'Green'
      }, 'mod');
    } catch (err) {
      await interaction.reply({ content: `Unban failed: ${err.message}`, flags: MessageFlags.Ephemeral });
    }
  }
};
