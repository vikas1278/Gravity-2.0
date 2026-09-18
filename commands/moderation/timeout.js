const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ms = require('ms');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .addUserOption(option =>
      option.setName('user').setDescription('User to timeout').setRequired(true))
    .addStringOption(option =>
      option.setName('duration').setDescription('Time (e.g., 1h, 30m)').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply();
    const member = interaction.options.getMember('user');
    const durationStr = interaction.options.getString('duration');
    const duration = ms(durationStr);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!member) return interaction.editReply({ content: '❌ User not found in this server.' });

    if (!duration || duration < 10000 || duration > 28 * 24 * 60 * 60 * 1000) {
      return interaction.editReply({ content: '❌ Duration must be between 10s and 28d.' });
    }

    if (!member.moderatable) {
      return interaction.editReply({ content: '❌ I cannot timeout this member. Make sure my role is higher than theirs and I have Moderate Members permission.' });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({ content: '❌ You cannot timeout a member with equal or higher role hierarchy.' });
    }

    // Fetch owner info
    const ownerId = process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',')[0] : null;
    let ownerName = 'Bot Owner';
    let ownerIcon = null;

    if (ownerId) {
      try {
        const owner = await interaction.client.users.fetch(ownerId);
        ownerName = owner.username;
        ownerIcon = owner.displayAvatarURL();
      } catch (e) {
        console.error('Failed to fetch owner:', e);
      }
    }

    try {
      // 1. Perform action FIRST
      await member.timeout(duration, reason);

      // 2. Send DM ONLY IF action succeeds
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('You have been timed out')
          .setColor('Blue')
          .addFields(
            { name: 'Server', value: interaction.guild.name, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Duration', value: durationStr, inline: true },
            { name: 'Timed Out By', value: interaction.user.tag, inline: true }
          )
          .setFooter({ text: `Developed by ${ownerName}`, iconURL: ownerIcon })
          .setTimestamp();
        await member.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.log(`Could not send DM to ${member.user.tag}.`);
      }

      // 3. Channel reply
      const embed = new EmbedBuilder()
        .setTitle('⏱️ Member Timed Out')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Duration', value: durationStr, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor('Blue')
        .setFooter({ text: `Developed by ${ownerName}`, iconURL: ownerIcon })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      const expiresTag = `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`;
      await logToChannel(interaction.guild, {
        title: '⏱️ User Timed Out',
        user: member.user,
        fields: [
          { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Duration', value: `${durationStr} (${expiresTag})`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason }
        ],
        color: 'Orange'
      }, 'mod');
    } catch (err) {
      await interaction.editReply({ content: `❌ Timeout failed: ${err.message}` });
    }
  }
};
