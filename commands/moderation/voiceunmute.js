const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voiceunmute')
    .setDescription('Unmute a voice muted member in voice channels')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to voice unmute (@mention or user ID)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for voice unmute')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

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

    if (!member.voice?.serverMute) {
      return interaction.editReply({
        content: `⚠️ <@${member.id}> is not voice muted in this server!`
      });
    }

    try {
      await member.voice.setMute(false, reason);

      const embed = new EmbedBuilder()
        .setTitle('🎙️ Member Voice Unmuted')
        .setColor('#06D6A0')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User', value: `<@${member.id}> (${targetUser.tag})`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setFooter({ text: `${interaction.guild.name} • Moderation Audit` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await logToChannel(interaction.guild, {
        title: '🎙️ Voice Unmute Issued',
        user: targetUser,
        fields: [
          { name: 'User', value: `<@${member.id}> (${targetUser.tag})`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        ],
        color: 'Emerald'
      }, 'mod');

    } catch (err) {
      await interaction.editReply({ content: `❌ Voice Unmute failed: ${err.message}` });
    }
  }
};
