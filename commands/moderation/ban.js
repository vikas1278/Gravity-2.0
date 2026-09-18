const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .addUserOption(option =>
      option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    await interaction.deferReply();
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      // Check guild member if present in server
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        if (!member.bannable) {
          return interaction.editReply({ content: '❌ I cannot ban this user. Make sure my role is higher than theirs and I have Ban Members permission.' });
        }
        if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
          return interaction.editReply({ content: '❌ You cannot ban a member with equal or higher role hierarchy.' });
        }
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

      // 1. Ban FIRST
      await interaction.guild.members.ban(user.id, { reason });

      // 2. Try to DM AFTER ban succeeds
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🔨 You have been banned')
          .setColor('Red')
          .setDescription(`You have been banned from **${interaction.guild.name}**`)
          .addFields(
            { name: 'Reason', value: reason },
            { name: 'Banned By', value: interaction.user.tag }
          )
          .setFooter({ text: `Developed by ${ownerName}`, iconURL: ownerIcon })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.error('Could not DM user:', err.message);
      }

      // 3. Channel reply
      const embed = new EmbedBuilder()
        .setTitle('🔨 Member Banned')
        .setDescription(`${user.tag} has been banned.`)
        .addFields({ name: 'Reason', value: reason })
        .setColor('Red')
        .setFooter({ text: `Developed by ${ownerName}`, iconURL: ownerIcon })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await logToChannel(interaction.guild, {
        title: '🔨 User Banned',
        user: user,
        fields: [
          { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason }
        ],
        color: 'Red'
      }, 'mod');
    } catch (err) {
      await interaction.editReply({ content: `❌ Failed to ban user: ${err.message}` });
    }
  }
};
