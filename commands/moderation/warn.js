const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../../models/Warn');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option => option.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply();
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    let warningData = await Warn.findOne({ userId: user.id, guildId: interaction.guild.id });
    if (!warningData) {
      warningData = new Warn({
        userId: user.id,
        guildId: interaction.guild.id,
        warnings: []
      });
    }

    const newWarning = {
      modId: interaction.user.id,
      reason: reason,
      date: new Date()
    };

    warningData.warnings.push(newWarning);

    await warningData.save();

    const warningCount = warningData.warnings.length;

    // Fetch owner for footer
    const ownerId = process.env.OWNER_IDS?.split(',')[0]?.trim();
    const owner = ownerId ? await interaction.client.users.fetch(ownerId).catch(() => null) : null;
    const ownerTag = owner ? owner.tag : 'Unknown Owner';

    // Format date for footer and field
    const date = new Date();
    const dateString = date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const fieldDateString = date.toLocaleString('en-US'); // Matches 11/21/2025, 4:58:21 AM style roughly

    const dmEmbed = new EmbedBuilder()
      .setTitle('⚠️ You have been warned')
      .setDescription(`You have received a warning in **${interaction.guild.name}** >>>`)
      .addFields(
        { name: 'Reason', value: reason, inline: false },
        { name: 'Warning Count', value: `${warningCount}`, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Date', value: fieldDateString, inline: true }
      )
      .setColor('#FFC700') // Yellowish-Orange
      .setFooter({
        text: `Developed by ${ownerTag} | Please follow the server rules • ${dateString}`,
        iconURL: owner ? owner.displayAvatarURL() : interaction.client.user.displayAvatarURL()
      });

    // Send DM
    try {
      await user.send({ embeds: [dmEmbed] });
    } catch (err) {
      console.log(`Could not send DM to ${user.tag}.`);
    }

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Member Warned')
      .setDescription(`Warned ${user.tag} for: **${reason}**`)
      .setColor('Orange')
      .setFooter({
        text: `Developed by ${ownerTag} | Please follow the server rules • ${dateString}`,
        iconURL: owner ? owner.displayAvatarURL() : interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await logToChannel(interaction.guild, {
      title: '⚠️ User Warned',
      user: user,
      fields: [
        { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason }
      ],
      color: 'Orange'
    }, 'mod');
  }
};
