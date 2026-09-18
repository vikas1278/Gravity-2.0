// /commands/info/emojiinfo.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emojiinfo')
    .setDescription('Displays information about a custom emoji.')
    .addStringOption(option =>
      option.setName('emoji')
        .setDescription('Emoji to get info on (e.g. <:smile:1234567890>)')
        .setRequired(true)),
  async execute(interaction) {
    const ownerId = process.env.OWNER_IDS?.split(',')[0]?.trim();
    const owner = ownerId ? await interaction.client.users.fetch(ownerId).catch(() => null) : null;
    const ownerLabel = owner ? owner.tag : 'Unknown Owner';
    const input = interaction.options.getString('emoji');
    const match = input.match(/<a?:\w+:(\d+)>/);

    if (!match) {
      return interaction.reply({ content: 'Invalid emoji format.', flags: MessageFlags.Ephemeral });
    }

    const emoji = interaction.client.emojis.cache.get(match[1]);
    if (!emoji) return interaction.reply({ content: 'Emoji not found in cache.', flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setTitle(`🧩 Emoji Info: ${emoji.name}`)
      .setThumbnail(emoji.url)
      .setColor('#a855f7')
      .addFields(
        { name: 'ID', value: emoji.id, inline: true },
        { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
        { name: 'Created', value: `<t:${Math.floor(emoji.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'URL', value: `[Link](${emoji.url})`, inline: false }
      )
      .setFooter({ text: `Developed by ${ownerLabel}` });

    await interaction.reply({ embeds: [embed] });
  }
};
