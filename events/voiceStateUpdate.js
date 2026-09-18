const { AuditLogEvent } = require('discord.js');
const logToChannel = require('../utils/logToChannel');

async function getExecutor(guild, type, targetId) {
  try {
    const fetchedLogs = await guild.fetchAuditLogs({
      limit: 5,
      type: type
    });
    const now = Date.now();

    // 1. Try finding log entry matching targetId
    let entry = fetchedLogs.entries.find(e => 
      e.target?.id === targetId && (now - e.createdTimestamp < 20000)
    );

    // 2. If target is null (Discord API voice disconnect entries), pick most recent entry within 20s
    if (!entry) {
      entry = fetchedLogs.entries.find(e => now - e.createdTimestamp < 20000);
    }

    if (entry) {
      return entry.executor;
    }
  } catch (err) {
    // Lacks View Audit Log permission or fetch failed
  }
  return null;
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    if (!newState.guild || newState.member?.user?.bot) return;

    // 1. Manual Voice Move (Channel Switch)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const executor = await getExecutor(newState.guild, AuditLogEvent.MemberMove, newState.member.id);
      const movedBy = executor ? `<@${executor.id}> (${executor.tag || executor.username})` : 'Self (User)';

      await logToChannel(newState.guild, {
        title: '🔊 Member Moved Voice Channel',
        user: newState.member?.user,
        fields: [
          { name: 'Member', value: `<@${newState.member.id}> (${newState.member.user.tag})`, inline: true },
          { name: 'From Channel', value: oldState.channel ? `${oldState.channel.name}` : `<#${oldState.channelId}>`, inline: true },
          { name: 'To Channel', value: newState.channel ? `${newState.channel.name}` : `<#${newState.channelId}>`, inline: true },
          { name: 'Moved By', value: movedBy, inline: true }
        ],
        color: 'Blue'
      }, 'voice');
    }

    // 2. Joined Voice Channel
    if (!oldState.channelId && newState.channelId) {
      await logToChannel(newState.guild, {
        title: '📥 Member Joined Voice',
        user: newState.member?.user,
        fields: [
          { name: 'Member', value: `<@${newState.member.id}> (${newState.member.user.tag})`, inline: true },
          { name: 'Channel', value: newState.channel ? `${newState.channel.name}` : `<#${newState.channelId}>`, inline: true }
        ],
        color: 'Green'
      }, 'voice');
    }

    // 3. Left / Disconnected Voice Channel
    if (oldState.channelId && !newState.channelId) {
      const executor = await getExecutor(newState.guild, AuditLogEvent.MemberDisconnect, oldState.member.id);
      const isDisconnected = !!executor;
      const actionBy = executor ? `<@${executor.id}> (${executor.tag || executor.username})` : 'Self (User)';
      const titleText = isDisconnected ? '🛑 Member Disconnected from Voice' : '📤 Member Left Voice';
      const colorTag = isDisconnected ? 'Red' : 'Orange';

      await logToChannel(newState.guild, {
        title: titleText,
        user: oldState.member?.user,
        fields: [
          { name: 'Member', value: `<@${oldState.member.id}> (${oldState.member.user.tag})`, inline: true },
          { name: 'Channel', value: oldState.channel ? `${oldState.channel.name}` : `<#${oldState.channelId}>`, inline: true },
          { name: 'Action By', value: actionBy, inline: true }
        ],
        color: colorTag
      }, 'voice');
    }

    // 4. Voice Server Mute Toggled
    if (oldState.serverMute !== newState.serverMute) {
      const executor = await getExecutor(newState.guild, AuditLogEvent.MemberUpdate, newState.member.id);
      const actionBy = executor ? `<@${executor.id}> (${executor.tag})` : '*Unknown Moderator*';

      await logToChannel(newState.guild, {
        title: newState.serverMute ? '🔇 Member Voice Muted' : '🔊 Member Voice Unmuted',
        user: newState.member?.user,
        fields: [
          { name: 'Member', value: `<@${newState.member.id}> (${newState.member.user.tag})`, inline: true },
          { name: 'Voice Channel', value: newState.channel ? `${newState.channel.name}` : '*Unknown*', inline: true },
          { name: 'Action By', value: actionBy, inline: true }
        ],
        color: newState.serverMute ? 'Red' : 'Green'
      }, 'voice');
    }

    // 5. Voice Server Deafen Toggled
    if (oldState.serverDeaf !== newState.serverDeaf) {
      const executor = await getExecutor(newState.guild, AuditLogEvent.MemberUpdate, newState.member.id);
      const actionBy = executor ? `<@${executor.id}> (${executor.tag})` : '*Unknown Moderator*';

      await logToChannel(newState.guild, {
        title: newState.serverDeaf ? '🛑 Member Voice Deafened' : '🔊 Member Voice Undeafened',
        user: newState.member?.user,
        fields: [
          { name: 'Member', value: `<@${newState.member.id}> (${newState.member.user.tag})`, inline: true },
          { name: 'Voice Channel', value: newState.channel ? `${newState.channel.name}` : '*Unknown*', inline: true },
          { name: 'Action By', value: actionBy, inline: true }
        ],
        color: newState.serverDeaf ? 'Orange' : 'Green'
      }, 'voice');
    }

    // 6. Handle TTS bot disconnect when the summoning user leaves
    if (newState.client.ttsUsers) {
      const ttsData = newState.client.ttsUsers.get(newState.guild.id);
      if (ttsData) {
        // If the user who summoned the bot leaves the voice channel
        if (oldState.id === ttsData.userId && oldState.channelId === ttsData.channelId && newState.channelId !== ttsData.channelId) {
          const { getVoiceConnection } = require('@discordjs/voice');
          const connection = getVoiceConnection(newState.guild.id);
          if (connection) {
            connection.destroy();
            newState.client.ttsUsers.delete(newState.guild.id);
          }
        }
      }
    }
  }
};
