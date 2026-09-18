const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a member')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to unmute')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('user');

    if (!member) return interaction.reply({ content: 'User not found.', flags: MessageFlags.Ephemeral });

    try {
      await member.timeout(null); // Remove timeout
      const embed = new EmbedBuilder()
        .setTitle('🔊 Member Unmuted')
        .setColor('Green')
        .addFields(
          { name: 'User', value: `${member.user.tag}`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      interaction.reply({ content: 'Failed to unmute the user.', flags: MessageFlags.Ephemeral });
    }
  }
};
