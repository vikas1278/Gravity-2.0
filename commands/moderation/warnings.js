const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../../models/Warn');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View a user\'s warnings')
    .addUserOption(option => option.setName('user').setDescription('User to view warnings').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const warnings = await Warn.findOne({ userId: user.id, guildId: interaction.guild.id });

    const embed = new EmbedBuilder()
      .setTitle(`📋 Warnings for ${user.tag}`)
      .setColor('Yellow')
      .setTimestamp();

    if (!warnings || warnings.warnings.length === 0) {
      embed.setDescription('No warnings found.');
    } else {
      warnings.warnings.slice(0, 10).forEach((warn, i) => {
        embed.addFields({
          name: `⚠️ Warning ${i + 1}`,
          value: `**Reason:** ${warn.reason}\n**Moderator:** <@${warn.modId}>\n**Date:** <t:${Math.floor(new Date(warn.date).getTime() / 1000)}:R>`
        });
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
