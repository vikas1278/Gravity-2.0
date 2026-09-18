const GuildSettings = require('../models/GuildSettings');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (message.partial || message.author?.bot || !message.guild) return;

    const settings = await GuildSettings.findOne({ guildId: message.guild.id });
    if (!settings?.automodEnabled) return;

    if (message.mentions.users.size > 0) {
      await message.channel.send({
        content: `👻 **Ghost ping detected!**\nUser: <@${message.author.id}>`,
      });
    }
  }
};
