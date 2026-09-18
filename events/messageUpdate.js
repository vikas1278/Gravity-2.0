const logToChannel = require('../utils/logToChannel');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild) return;

    if (oldMessage.partial) {
      try { oldMessage = await oldMessage.fetch(); } catch (e) {}
    }
    if (newMessage.partial) {
      try { newMessage = await newMessage.fetch(); } catch (e) {}
    }

    if (newMessage.author?.bot || oldMessage.content === newMessage.content) return;

    const userLabel = newMessage.author ? `<@${newMessage.author.id}> (${newMessage.author.tag})` : '*Unknown User*';
    const channelLabel = newMessage.channel ? `<#${newMessage.channel.id}>` : '*Unknown Channel*';

    await logToChannel(newMessage.guild, {
      title: '✏️ Message Edited',
      user: newMessage.author,
      fields: [
        { name: 'User', value: userLabel, inline: true },
        { name: 'Channel', value: channelLabel, inline: true },
        { name: 'Before', value: oldMessage.content || '*[Uncached]*' },
        { name: 'After', value: newMessage.content || '*[No text content]*' }
      ],
      color: 'Cyan'
    }, 'message');
  }
};
