// /commands/info/userinfo.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Shows information about a user.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to get info on')
        .setRequired(false)),
  async execute(interaction) {
    const ownerId = process.env.OWNER_IDS?.split(',')[0]?.trim();
    const owner = ownerId ? await interaction.client.users.fetch(ownerId).catch(() => null) : null;
    const ownerLabel = owner ? owner.tag : 'Unknown Owner';
    const user = interaction.options.getUser('target') || interaction.user;
    let member;
    try {
      member = await interaction.guild.members.fetch(user.id);
    } catch (e) {
      member = null;
    }

    if (!member) {
      return interaction.reply({ content: '❌ Could not find that user in this server.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle(`👤 User Info: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setColor('#a855f7')
      .addFields(
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
        { name: 'Roles', value: `${member.roles.cache.map(r => r).join(', ')}`, inline: false }
      )
      .setFooter({ text: `Developed by ${ownerLabel}`, iconURL: owner ? owner.displayAvatarURL() : interaction.client.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  }
};
