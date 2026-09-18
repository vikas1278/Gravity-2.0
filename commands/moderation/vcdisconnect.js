const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcdisconnect')
    .setDescription('Disconnect a member from their current voice channel')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to disconnect from voice (@mention or user ID)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for disconnecting the member')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

  async execute(interaction) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    let member;
    try {
      member = await interaction.guild.members.fetch(targetUser.id);
    } catch (e) {
      return interaction.editReply({ content: '❌ Could not find that member in this server.' });
    }

    if (!member.voice?.channel) {
      return interaction.editReply({
        content: `⚠️ <@${member.id}> is not connected to any voice channel right now!`
      });
    }

    // Role hierarchy check
    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({ content: '❌ You cannot disconnect a member with equal or higher role hierarchy.' });
    }

    const currentChannel = member.voice.channel;

    try {
      // Disconnect member from voice channel
      await member.voice.disconnect(reason);

      // Reply Embed
      const embed = new EmbedBuilder()
        .setTitle('🛑 Member Disconnected from Voice')
        .setColor('#FF9F1C')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User', value: `<@${member.id}> (${targetUser.tag})`, inline: true },
          { name: 'Disconnected From', value: `${currentChannel.name}`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setFooter({ text: `${interaction.guild.name} • Moderation Audit` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Audit Log for Moderation channel
      await logToChannel(interaction.guild, {
        title: '🛑 Member Voice Disconnected',
        user: targetUser,
        fields: [
          { name: 'User', value: `<@${member.id}> (${targetUser.tag})`, inline: true },
          { name: 'Channel', value: `${currentChannel.name}`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        ],
        color: 'Orange'
      }, 'mod');

      // Audit Log for Voice channel
      await logToChannel(interaction.guild, {
        title: '🛑 Member Disconnected from Voice',
        user: targetUser,
        fields: [
          { name: 'Member', value: `<@${member.id}> (${targetUser.tag})`, inline: true },
          { name: 'Channel', value: `${currentChannel.name}`, inline: true },
          { name: 'Action By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true }
        ],
        color: 'Red'
      }, 'voice');

    } catch (err) {
      await interaction.editReply({ content: `❌ Failed to disconnect member: ${err.message}` });
    }
  }
};
