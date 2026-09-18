const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to mute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for mute')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

  async execute(interaction) {
    await interaction.deferReply();
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!member) return interaction.editReply({ content: '❌ User not found in this server.' });

    // Moderatable & role hierarchy checks
    if (!member.moderatable) {
      return interaction.editReply({ content: '❌ I cannot mute this member. Make sure my role is higher than theirs and I have Moderate Members permission.' });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({ content: '❌ You cannot mute a member with equal or higher role hierarchy.' });
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
      await member.timeout(10 * 60 * 1000, reason); // 10 minutes timeout

      // 2. Send DM ONLY IF action succeeds
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('You have been muted')
          .setColor('Orange')
          .addFields(
            { name: 'Server', value: interaction.guild.name, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Duration', value: '10 minutes', inline: true },
            { name: 'Muted By', value: interaction.user.tag, inline: true }
          )
          .setFooter({ text: `Developed by ${ownerName}`, iconURL: ownerIcon })
          .setTimestamp();
        await member.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.log(`Could not send DM to ${member.user.tag}.`);
      }

      // 3. Edit reply in channel
      const embed = new EmbedBuilder()
        .setTitle('🔇 Member Muted')
        .setColor('Orange')
        .addFields(
          { name: 'User', value: `${member.user.tag}`, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Duration', value: '10 minutes', inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: `Developed by ${ownerName}`, iconURL: ownerIcon })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await logToChannel(interaction.guild, {
        title: '🔇 Member Muted',
        user: member.user,
        fields: [
          { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Duration', value: '10 minutes', inline: true },
          { name: 'Reason', value: reason, inline: true }
        ],
        color: 'Orange'
      }, 'mod');
    } catch (err) {
      console.error(err);
      interaction.editReply({ content: `❌ Failed to mute member: ${err.message}` });
    }
  }
};
