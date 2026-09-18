const { AuditLogEvent } = require('discord.js');
const logToChannel = require('../utils/logToChannel');
const { getCachedMessage } = require('../utils/messageCache');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild) return;

    // Check in-memory message cache for uncached messages
    const cached = getCachedMessage(message.id);

    let author = message.author || cached?.author || null;
    const content = (message.content && message.content.length > 0) ? message.content : (cached?.content || null);

    if (author?.bot) return;

    // Fetch Audit Log for executor & target user if uncached
    let executor = null;
    try {
      const fetchedLogs = await message.guild.fetchAuditLogs({
        limit: 5,
        type: AuditLogEvent.MessageDelete
      });
      const entry = fetchedLogs.entries.find(e => 
        (e.target?.id === author?.id) || 
        (Date.now() - e.createdTimestamp < 10000)
      ) || fetchedLogs.entries.first();

      if (entry && (Date.now() - entry.createdTimestamp < 10000)) {
        executor = entry.executor;
        // If author was uncached, retrieve target user from Audit Logs
        if (!author && entry.target) {
          author = entry.target;
        }
      }
    } catch (e) {}

    if (author?.bot) return;

    const userTag = author ? (author.tag || author.username) : null;
    const userLabel = author ? `<@${author.id}> (${userTag})` : '*Unknown User*';
    const channelLabel = message.channel ? `<#${message.channel.id}>` : (cached?.channelId ? `<#${cached.channelId}>` : '*Unknown Channel*');
    const contentLabel = content && content.length > 0 ? content : '*[Message content uncached]*';
    
    let actionBy = 'Self (User)';
    if (executor) {
      if (author && executor.id === author.id) {
        actionBy = 'Self (User)';
      } else {
        actionBy = `<@${executor.id}> (${executor.tag || executor.username})`;
      }
    }

    const fields = [
      { name: 'User', value: userLabel, inline: true },
      { name: 'Channel', value: channelLabel, inline: true },
      { name: 'Deleted By', value: actionBy, inline: true },
      { name: 'Message', value: contentLabel, inline: false }
    ];

    await logToChannel(message.guild, {
      title: '🗑️ Message Deleted',
      user: author,
      fields: fields,
      color: 'Red'
    }, 'message');
  }
};


