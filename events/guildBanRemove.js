const { AuditLogEvent } = require('discord.js');
const logToChannel = require('../utils/logToChannel');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    if (!ban.guild) return;

    let executor = null;
    try {
      const fetchedLogs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanRemove
      });
      const entry = fetchedLogs.entries.first();
      if (entry && entry.target?.id === ban.user.id && (Date.now() - entry.createdTimestamp < 5000)) {
        executor = entry.executor;
      }
    } catch (e) {}

    const actionBy = executor ? `<@${executor.id}> (${executor.tag})` : '*Moderator*';

    await logToChannel(ban.guild, {
      title: '🔓 Member Unbanned',
      user: ban.user,
      fields: [
        { name: 'User', value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
        { name: 'Unbanned By', value: actionBy, inline: true }
      ],
      color: 'Green'
    }, 'mod');
  }
};
