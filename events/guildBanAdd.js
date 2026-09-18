const { AuditLogEvent } = require('discord.js');
const logToChannel = require('../utils/logToChannel');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    if (!ban.guild) return;

    let executor = null;
    try {
      const fetchedLogs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanAdd
      });
      const entry = fetchedLogs.entries.first();
      if (entry && entry.target?.id === ban.user.id && (Date.now() - entry.createdTimestamp < 5000)) {
        executor = entry.executor;
      }
    } catch (e) {}

    const actionBy = executor ? `<@${executor.id}> (${executor.tag})` : '*Moderator*';

    await logToChannel(ban.guild, {
      title: '🔨 Member Banned',
      user: ban.user,
      fields: [
        { name: 'User', value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
        { name: 'Banned By', value: actionBy, inline: true },
        { name: 'Reason', value: ban.reason || '*No reason provided*', inline: true }
      ],
      color: 'Red'
    }, 'mod');
  }
};
