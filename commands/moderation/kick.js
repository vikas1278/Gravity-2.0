const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .addUserOption(option =>
      option.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    await interaction.deferReply();
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!member) {
      return interaction.editReply({ content: '❌ User not found in this server.' });
    }

    if (!member.kickable) {
      return interaction.editReply({ content: '❌ I cannot kick this user. Make sure my role is higher than theirs and I have Kick Members permission.' });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({ content: '❌ You cannot kick a member with equal or higher role hierarchy.' });
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
      // 1. Kick FIRST
      await member.kick(reason);

      // 2. Try DM AFTER kick succeeds
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('You have been kicked')
          .setColor('Red')
          .addFields(
            { name: 'Server', value: interaction.guild.name, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Kicked By', value: interaction.user.tag, inline: true }
          )
          .setFooter({ text: `Developed by ${ownerName}`, iconURL: ownerIcon })
          .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.log(`Could not send DM to ${member.user?.tag || member.id}.`);
      }

      // 3. Channel reply
      const embed = new EmbedBuilder()
        .setTitle('✅ User Kicked')
        .setDescription(`Successfully kicked <@${member.id}>`)
        .addFields(
          { name: 'Reason', value: reason, inline: false },
          { name: 'Kicked By', value: `<@${interaction.user.id}>`, inline: false }
        )
        .setColor('#57F287')
        .setFooter({
          text: `Developed by ${ownerName}`,
          iconURL: ownerIcon
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await logToChannel(interaction.guild, {
        title: '👢 User Kicked',
        user: member.user,
        fields: [
          { name: 'User', value: `<@${member.id}> (${member.user?.tag || member.id})`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason }
        ],
        color: 'Red'
      }, 'mod');
    } catch (err) {
      await interaction.editReply({ content: `❌ Failed to kick user: ${err.message}` });
    }
  }
};
