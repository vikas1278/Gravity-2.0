// /commands/info/botinfo.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');
const packageJson = require('../../package.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Shows detailed information about the bot.'),
  async execute(interaction) {
    const client = interaction.client;
    const ownerId = process.env.OWNER_IDS?.split(',')[0]?.trim();
    const owner = ownerId ? await client.users.fetch(ownerId).catch(() => null) : null;
    const ownerLabel = owner ? owner.tag : 'Unknown Owner';

    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot Information')
      .setColor('#a855f7')
      .addFields(
        { name: 'Name', value: client.user.username, inline: true },
        { name: 'Tag', value: client.user.discriminator, inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Uptime', value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true },
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Users', value: `${client.users.cache.size}`, inline: true },
        { name: 'Node.js', value: `${process.version}`, inline: true },
        { name: 'Platform', value: `${os.platform()} (${os.arch()})`, inline: true },
        { name: 'RAM Usage', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: 'Version', value: `v${packageJson.version}`, inline: true }
      )
      .setFooter({ text: `Developed by ${ownerLabel}`, iconURL: owner ? owner.displayAvatarURL() : client.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  }
};
