// /commands/info/channelinfo.js
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Displays information about a channel.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to get info on')
        .setRequired(true)),
  async execute(interaction) {
    const ownerId = process.env.OWNER_IDS?.split(',')[0]?.trim();
    const owner = ownerId ? await interaction.client.users.fetch(ownerId).catch(() => null) : null;
    const ownerLabel = owner ? owner.tag : 'Unknown Owner';
    const channel = interaction.options.getChannel('channel');

    const embed = new EmbedBuilder()
      .setTitle(`📺 Channel Info: ${channel.name}`)
      .setColor('#a855f7')
      .addFields(
        { name: 'ID', value: channel.id, inline: true },
        { name: 'Type', value: ChannelType[channel.type], inline: true },
        { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true },
        { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: `Developed by ${ownerLabel}` });

    await interaction.reply({ embeds: [embed] });
  }
};
