const { AuditLogEvent } = require('discord.js');
const logToChannel = require('../utils/logToChannel');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    if (!member.guild || member.user?.bot) return;

    let executor = null;
    let reason = null;

    try {
      const fetchedLogs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick
      });
      const entry = fetchedLogs.entries.first();
      if (entry && entry.target?.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
        executor = entry.executor;
        reason = entry.reason;
      }
    } catch (e) {}

    // Log kick if performed by a moderator
    if (executor) {
      await logToChannel(member.guild, {
        title: '👢 Member Kicked',
        user: member.user,
        fields: [
          { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Kicked By', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: 'Reason', value: reason || '*No reason provided*', inline: true }
        ],
        color: 'Red'
      }, 'mod');
    }
  }
};
