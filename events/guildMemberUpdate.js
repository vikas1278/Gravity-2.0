const { AuditLogEvent } = require('discord.js');
const logToChannel = require('../utils/logToChannel');

function formatDuration(ms) {
  if (!ms || ms <= 0) return '*Cleared*';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day(s) ${hours % 24} hr(s)`;
  if (hours > 0) return `${hours} hr(s) ${minutes % 60} min(s)`;
  if (minutes > 0) return `${minutes} min(s)`;
  return `${seconds} sec(s)`;
}

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    if (!newMember.guild || newMember.user?.bot) return;

    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;

    if (oldTimeout !== newTimeout) {
      const isTimedOut = newTimeout && newTimeout > Date.now();

      let executor = null;
      let reason = null;
      try {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MemberUpdate
        });
        const entry = fetchedLogs.entries.first();
        if (entry && entry.target?.id === newMember.id && (Date.now() - entry.createdTimestamp < 5000)) {
          executor = entry.executor;
          reason = entry.reason;
        }
      } catch (e) {}

      const actionBy = executor ? `<@${executor.id}> (${executor.tag})` : '*Moderator / Auto*';

      if (isTimedOut) {
        const durationMs = newTimeout - Date.now();
        const durationText = formatDuration(durationMs);
        const relativeTag = `<t:${Math.floor(newTimeout / 1000)}:R>`;

        await logToChannel(newMember.guild, {
          title: '⏳ Member Timed Out',
          user: newMember.user,
          fields: [
            { name: 'Member', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
            { name: 'Action By', value: actionBy, inline: true },
            { name: 'Duration', value: `${durationText} (${relativeTag})`, inline: true },
            { name: 'Until', value: `<t:${Math.floor(newTimeout / 1000)}:F>`, inline: true },
            { name: 'Reason', value: reason || '*No reason provided*', inline: true }
          ],
          color: 'Orange'
        }, 'mod');
      } else {
        await logToChannel(newMember.guild, {
          title: '⌛ Member Timeout Removed',
          user: newMember.user,
          fields: [
            { name: 'Member', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
            { name: 'Action By', value: actionBy, inline: true }
          ],
          color: 'Green'
        }, 'mod');
      }
    }
  }
};
