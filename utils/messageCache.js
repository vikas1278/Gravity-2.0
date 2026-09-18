// utils/messageCache.js
const messageMap = new Map();
const MAX_CACHE_SIZE = 2000;

function cacheMessage(message) {
  if (!message || !message.id || message.author?.bot) return;

  if (messageMap.size >= MAX_CACHE_SIZE) {
    const firstKey = messageMap.keys().next().value;
    messageMap.delete(firstKey);
  }

  messageMap.set(message.id, {
    id: message.id,
    author: message.author,
    content: message.content,
    channelId: message.channelId,
    createdAt: message.createdAt
  });
}

function getCachedMessage(messageId) {
  return messageMap.get(messageId) || null;
}

async function preloadMessageCache(client) {
  try {
    console.log('🔄 Preloading channel message cache...');
    let count = 0;
    for (const [, guild] of client.guilds.cache) {
      const textChannels = guild.channels.cache.filter(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has(['ViewChannel', 'ReadMessageHistory']));
      for (const [, channel] of textChannels) {
        try {
          const messages = await channel.messages.fetch({ limit: 50 });
          messages.forEach(msg => {
            cacheMessage(msg);
            count++;
          });
        } catch (err) {
          // Lacks permissions
        }
      }
    }
    console.log(`✅ Preloaded ${count} messages into cache.`);
  } catch (err) {
    console.error('Error preloading message cache:', err.message);
  }
}

module.exports = { cacheMessage, getCachedMessage, preloadMessageCache };

