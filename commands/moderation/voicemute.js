const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logToChannel = require('../../utils/logToChannel');

function parseDuration(str) {
  if (!str) return null;
  const match = str.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voicemute')
    .setDescription('Voice mute a member for a specific duration (e.g. 1s, 5m, 1h, 1d)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to voice mute (@mention or user ID)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Time duration (e.g., 10s, 5m, 1h, 1d)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for voice mute')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

  async execute(interaction) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 1000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.editReply({
        content: '❌ Invalid duration! Please use formats like `1s`, `5m`, `1h`, or `1d` (min 1s, max 28d).'
      });
    }

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
      return interaction.editReply({ content: '❌ You cannot voice mute a member with equal or higher role hierarchy.' });
    }

    try {
      // Apply voice mute
      await member.voice.setMute(true, reason);

      const expiresTimestamp = Math.floor((Date.now() + durationMs) / 1000);
      const expiresTag = `<t:${expiresTimestamp}:R>`;

      // Confirmation Reply Embed
      const embed = new EmbedBuilder()
        .setTitle('🎙️ Member Voice Muted')
        .setColor('#FF3355')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User', value: `<@${member.id}> (${targetUser.tag})`, inline: true },
          { name: 'Voice Channel', value: `${member.voice.channel}`, inline: true },
          { name: 'Duration', value: `${durationStr} (${expiresTag})`, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: `${interaction.guild.name} • Moderation Audit` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Audit Log
      await logToChannel(interaction.guild, {
        title: '🎙️ Voice Mute Issued',
        user: targetUser,
        fields: [
          { name: 'User', value: `<@${member.id}> (${targetUser.tag})`, inline: true },
          { name: 'Voice Channel', value: `${member.voice.channel}`, inline: true },
          { name: 'Duration', value: `${durationStr} (${expiresTag})`, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
        ],
        color: 'Red'
      }, 'mod');

      // Auto Voice Unmute Timer
      setTimeout(async () => {
        try {
          const currentMember = await interaction.guild.members.fetch(member.id).catch(() => null);
          if (currentMember && currentMember.voice?.serverMute) {
            await currentMember.voice.setMute(false, 'Voice mute duration expired');

            await logToChannel(interaction.guild, {
              title: '🎙️ Voice Mute Expired',
              user: targetUser,
              fields: [
                { name: 'User', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                { name: 'Action', value: 'Auto Voice Unmuted', inline: true }
              ],
              color: 'Emerald'
            }, 'mod');
          }
        } catch (unmuteErr) {
          console.error('Failed to auto voice unmute member:', unmuteErr);
        }
      }, durationMs);

    } catch (err) {
      await interaction.editReply({ content: `❌ Voice Mute failed: ${err.message}` });
    }
  }
};
