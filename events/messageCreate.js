const { EmbedBuilder } = require('discord.js');
const GuildSettings = require('../models/GuildSettings');
const logToChannel = require('../utils/logToChannel');
const { cacheMessage } = require('../utils/messageCache');

const userMessages = new Map();
const linkViolations = new Map();
const spamViolations = new Map();
const emojiTracker = new Map();    // { key -> [{ count, timestamp }] }
const emojiViolations = new Map();
const stickerViolations = new Map();
const userStickerMessages = new Map(); // tracks sticker message timestamps per user
const imageViolations = new Map();
const userImageMessages = new Map();   // tracks image message timestamps per user
const linkRegex = /(https?:\/\/[^\s]+)/;
// Matches Unicode emoji and Discord custom emoji <:name:id> / <a:name:id>
const unicodeEmojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
const discordEmojiRegex = /<a?:[a-zA-Z0-9_]+:[0-9]+>/g;

function countEmojisInText(text) {
  const unicode = (text.match(unicodeEmojiRegex) || []).length;
  const discord = (text.match(discordEmojiRegex) || []).length;
  return unicode + discord;
}

function countEmojisWithRows(content) {
  // Total count across whole message
  const total = countEmojisInText(content);
  // Also check each line individually — catch row-based spam
  const lines = content.split('\n');
  const maxPerRow = Math.max(...lines.map(line => countEmojisInText(line)));
  return { total, maxPerRow };
}

// Silently ignore 10008 (Unknown Message) — message was already deleted
async function safeDelete(message) {
  try {
    if (message.deletable) await message.delete();
  } catch (err) {
    if (err.code !== 10008) console.error('Failed to delete message:', err);
  }
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // Cache message for delete logs
    cacheMessage(message);

    const settings = await GuildSettings.findOne({ guildId: message.guild.id });
    if (!settings) return;

    // Auto-Response
    if (settings.autoResponses && settings.autoResponses.length > 0) {
      const content = message.content.toLowerCase();
      const matchedResponse = settings.autoResponses.find(ar => content.includes(ar.trigger));

      if (matchedResponse) {
        const embed = new EmbedBuilder()
          .setDescription(matchedResponse.response.replace(/\\n/g, '\n'))
        try {
          embed.setColor(matchedResponse.color);
        } catch (e) {
          embed.setColor('Blue');
        }

        if (matchedResponse.title) embed.setTitle(matchedResponse.title);
        if (matchedResponse.footer) embed.setFooter({ text: matchedResponse.footer });
        if (matchedResponse.thumbnail) embed.setThumbnail(matchedResponse.thumbnail);
        if (matchedResponse.image) embed.setImage(matchedResponse.image);

        if (matchedResponse.fields && matchedResponse.fields.length > 0) {
          embed.addFields(matchedResponse.fields.map(f => ({
            name: f.name,
            value: f.value.replace(/\\n/g, '\n')
          })));
        }

        try {
          await message.channel.send({ embeds: [embed] });
        } catch (err) {
          console.error('Error sending auto-response:', err);
        }
      }
    }

    if (!settings.automodEnabled) return;

    // Bypass for Admins & Mods
    if (!message.member || message.member.permissions.has('Administrator') || message.member.permissions.has('ManageMessages')) return;

    // Bypass for Ignored Users and Roles
    if (settings.ignoredUsers && settings.ignoredUsers.includes(message.author.id)) return;
    if (settings.ignoredRoles && message.member.roles.cache.some(r => settings.ignoredRoles.includes(r.id))) return;
    // Bypass for Ignored Channels
    if (settings.ignoredChannels && settings.ignoredChannels.includes(message.channel.id)) return;

    // Anti-Link
    if (settings.antiLink && linkRegex.test(message.content)) {
      try {
        await safeDelete(message);

        const key = `${message.guild.id}-${message.author.id}`;
        let violations = linkViolations.get(key) || 0;
        violations++;
        linkViolations.set(key, violations);

        await logToChannel(message.guild, {
          title: '🛡️ Anti-Link Triggered',
          user: message.author,
          fields: [
            { name: 'User', value: `<@${message.author.id}>`, inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Violations', value: `${violations}/3`, inline: true },
            { name: 'Content', value: message.content || '*[Link]*' }
          ],
          color: 'Purple'
        }, 'automod');

        if (violations === 3) {
          try {
            await message.member.timeout(10 * 60 * 1000, 'Anti-link: Excessive link spam');

            try {
              const dmEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('You have been timed out')
                .setDescription(`You have been timed out in **${message.guild.name}** for **10 minutes**.\n**Reason:** Excessive link spam.`);
              await message.author.send({ embeds: [dmEmbed] });
            } catch (dmErr) {
              console.error('Could not DM user:', dmErr);
            }

            const muteEmbed = new EmbedBuilder()
              .setColor('Red')
              .setTitle('🔇 User Timed Out')
              .addFields(
                { name: 'User', value: `<@${message.author.id}>`, inline: true },
                { name: 'Duration', value: '10 minutes', inline: true },
                { name: 'Reason', value: '🔗 Link Spam', inline: true },
                { name: 'Violation', value: `Sent a link in ${message.channel} — **3rd offense**` }
              );
            const muteMsgLink = await message.channel.send({ embeds: [muteEmbed] });
            setTimeout(() => muteMsgLink.delete().catch(() => {}), 30 * 1000);

            setTimeout(() => {
              linkViolations.delete(key);
            }, 10 * 60 * 1000);

          } catch (err) {
            console.error('Failed to timeout member:', err);
            const embed = new EmbedBuilder()
              .setColor('Red')
              .setDescription(`🚫 No links allowed here, <@${message.author.id}>!`);
            const fallbackMsgLink = await message.channel.send({ embeds: [embed] });
            setTimeout(() => fallbackMsgLink.delete().catch(() => {}), 30 * 1000);
          }
        } else if (violations < 3) {
          const embed = new EmbedBuilder()
            .setColor('Red')
            .setDescription(`🚫 No links allowed here, <@${message.author.id}>! (Warning ${violations}/3)`);
          const warnMsgLink = await message.channel.send({ embeds: [embed] });
          setTimeout(() => warnMsgLink.delete().catch(() => {}), 30 * 1000);
        }
      } catch (err) {
        console.error('Error in anti-link handler:', err);
      }
      return;
    }

    // Anti-Spam
    // Skip if message has stickers and antiStickerSpam is enabled — let the sticker block handle it
    const hasStickers = message.stickers && message.stickers.size > 0;
    if (settings.antiSpam && !(hasStickers && settings.antiStickerSpam)) {
      const now = Date.now();
      const key = `${message.guild.id}-${message.author.id}`;
      if (!userMessages.has(key)) userMessages.set(key, []);
      const timestamps = userMessages.get(key);

      timestamps.push(now);
      const recent = timestamps.filter(ts => now - ts < 10000);
      userMessages.set(key, recent);

      if (recent.length >= 5) {
        try {
        await safeDelete(message);

          let violations = spamViolations.get(key) || 0;
          violations++;
          spamViolations.set(key, violations);

          await logToChannel(message.guild, {
            title: '🛡️ Anti-Spam Triggered',
            user: message.author,
            fields: [
              { name: 'User', value: `<@${message.author.id}>`, inline: true },
              { name: 'Channel', value: `${message.channel}`, inline: true },
              { name: 'Violations', value: `${violations}/3`, inline: true }
            ],
            color: 'Purple'
          }, 'automod');

          if (violations === 3) {
            try {
              await message.member.timeout(10 * 60 * 1000, 'Anti-spam: Excessive message spam');

              try {
                const dmEmbed = new EmbedBuilder()
                  .setColor('Red')
                  .setTitle('You have been timed out')
                  .setDescription(`You have been timed out in **${message.guild.name}** for **10 minutes**.\n**Reason:** Excessive message spam.`);
                await message.author.send({ embeds: [dmEmbed] });
              } catch (dmErr) {
                console.error('Could not DM user:', dmErr);
              }

              const muteEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🔇 User Timed Out')
                .addFields(
                  { name: 'User', value: `<@${message.author.id}>`, inline: true },
                  { name: 'Duration', value: '10 minutes', inline: true },
                  { name: 'Reason', value: '💬 Message Spam', inline: true },
                  { name: 'Violation', value: `Sent **${recent.length}+ messages** in 10 seconds in ${message.channel} — **3rd offense**` }
                );
              const muteMsgSpam = await message.channel.send({ embeds: [muteEmbed] });
              setTimeout(() => muteMsgSpam.delete().catch(() => {}), 30 * 1000);

              setTimeout(() => {
                spamViolations.delete(key);
              }, 10 * 60 * 1000);

            } catch (err) {
              console.error('Failed to timeout member:', err);
              const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`⚠️ Stop spamming, <@${message.author.id}>!`);
              const fallbackMsgSpam = await message.channel.send({ embeds: [embed] });
              setTimeout(() => fallbackMsgSpam.delete().catch(() => {}), 30 * 1000);
            }
          } else if (violations < 3) {
            const embed = new EmbedBuilder()
              .setColor('Red')
              .setDescription(`⚠️ Stop spamming, <@${message.author.id}>! (Warning ${violations}/3)`);
            const warnMsgSpam = await message.channel.send({ embeds: [embed] });
            setTimeout(() => warnMsgSpam.delete().catch(() => {}), 30 * 1000);
          }
        } catch (err) {
          console.error('Error in anti-spam handler:', err);
        }
      }
    }

    // ── Anti-Emoji-Spam (emojis only) ─────────────────────────────────────────
    if (settings.antiEmojiSpam) {
      const limit = settings.emojiLimit || 5;
      const key = `${message.guild.id}-${message.author.id}`;

      const { total, maxPerRow } = countEmojisWithRows(message.content);

      // Trigger if total emojis >= limit OR any single row >= limit
      if (total >= limit || maxPerRow >= limit) {
        try {
        await safeDelete(message);

          let violations = emojiViolations.get(key) || 0;
          violations++;
          emojiViolations.set(key, violations);

          await logToChannel(message.guild, {
            title: '🎭 Anti-Emoji-Spam Triggered',
            user: message.author,
            fields: [
              { name: 'User', value: `<@${message.author.id}>`, inline: true },
              { name: 'Channel', value: `${message.channel}`, inline: true },
              { name: 'Violations', value: `${violations}/3`, inline: true },
              { name: 'Emojis Detected', value: `${total} total (${maxPerRow} max in one row) / Limit: ${limit}` }
            ],
            color: 'Orange'
          }, 'automod');

          if (violations >= 3) {
            try {
              await message.member.timeout(10 * 60 * 1000, 'Anti-emoji-spam: Excessive emoji usage');

              const muteEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🎭 User Timed Out')
                .addFields(
                  { name: 'User', value: `<@${message.author.id}>`, inline: true },
                  { name: 'Duration', value: '10 minutes', inline: true },
                  { name: 'Reason', value: '🎭 Emoji Spam', inline: true },
                  { name: 'Violation', value: `Sent **${total} emojis** (limit: ${limit}) in ${message.channel} — **3rd offense**` }
                );

              const muteMsg = await message.channel.send({ embeds: [muteEmbed] });
              setTimeout(() => muteMsg.delete().catch(() => {}), 15000);

              setTimeout(() => { emojiViolations.delete(key); }, 10 * 60 * 1000);

            } catch (err) {
              console.error('Failed to timeout member (emoji spam):', err);
              const embed = new EmbedBuilder()
                .setColor('Orange')
                .setDescription(`🎭 Too many emojis, <@${message.author.id}>!`);
              const warnMsg = await message.channel.send({ embeds: [embed] });
              setTimeout(() => warnMsg.delete().catch(() => {}), 15000);
            }
          } else {
            const embed = new EmbedBuilder()
              .setColor('Orange')
              .setDescription(`🎭 Too many emojis, <@${message.author.id}>! (Warning ${violations}/3)`);
            const warnMsg = await message.channel.send({ embeds: [embed] });
            setTimeout(() => warnMsg.delete().catch(() => {}), 15000);
          }
        } catch (err) {
          console.error('Error handling emoji spam:', err);
        }
      }
    }

    // ── Anti-Sticker-Spam (tracks sticker messages over time, like anti-spam) ──
    if (settings.antiStickerSpam && hasStickers) {
      const limit = settings.stickerLimit || 3;
      const windowMs = (settings.stickerDuration || 10) * 1000;
      const now = Date.now();
      const key = `${message.guild.id}-${message.author.id}`;

      // Track timestamps of sticker messages in the window
      if (!userStickerMessages.has(key)) userStickerMessages.set(key, []);
      const stickerTimestamps = userStickerMessages.get(key);
      stickerTimestamps.push(now);
      const recentStickers = stickerTimestamps.filter(ts => now - ts < windowMs);
      userStickerMessages.set(key, recentStickers);

      // Trigger when user has sent `limit` sticker messages within the window
      if (recentStickers.length >= limit) {
        try {
          await safeDelete(message);

          let violations = stickerViolations.get(key) || 0;
          violations++;
          stickerViolations.set(key, violations);

          await logToChannel(message.guild, {
            title: '🖼️ Anti-Sticker-Spam Triggered',
            user: message.author,
            fields: [
              { name: 'User', value: `<@${message.author.id}>`, inline: true },
              { name: 'Channel', value: `${message.channel}`, inline: true },
              { name: 'Violations', value: `${violations}/3`, inline: true },
              { name: 'Stickers Detected', value: `${recentStickers.length} sticker message(s) in ${settings.stickerDuration || 10}s / Limit: ${limit}` }
            ],
            color: 'Yellow'
          }, 'automod');

          if (violations >= 3) {
            try {
              await message.member.timeout(10 * 60 * 1000, 'Anti-sticker-spam: Excessive sticker usage');

              const muteEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🖼️ User Timed Out')
                .addFields(
                  { name: 'User', value: `<@${message.author.id}>`, inline: true },
                  { name: 'Duration', value: '10 minutes', inline: true },
                  { name: 'Reason', value: '🖼️ Sticker Spam', inline: true },
                  { name: 'Violation', value: `Sent **${recentStickers.length} stickers** in ${settings.stickerDuration || 10}s in ${message.channel} — **3rd offense**` }
                );

              const muteMsg = await message.channel.send({ embeds: [muteEmbed] });
              setTimeout(() => muteMsg.delete().catch(() => {}), 30 * 1000);

              // Reset tracker and violations after timeout
              userStickerMessages.delete(key);
              setTimeout(() => { stickerViolations.delete(key); }, 10 * 60 * 1000);

            } catch (err) {
              console.error('Failed to timeout member (sticker spam):', err);
              const embed = new EmbedBuilder()
                .setColor('Yellow')
                .setDescription(`🖼️ Too many stickers, <@${message.author.id}>!`);
              const warnMsg = await message.channel.send({ embeds: [embed] });
              setTimeout(() => warnMsg.delete().catch(() => {}), 30 * 1000);
            }
          } else {
            const embed = new EmbedBuilder()
              .setColor('Yellow')
              .setDescription(`🖼️ Too many stickers, <@${message.author.id}>! (Warning ${violations}/3)`);
            const warnMsg = await message.channel.send({ embeds: [embed] });
            setTimeout(() => warnMsg.delete().catch(() => {}), 30 * 1000);
          }
        } catch (err) {
          console.error('Error handling sticker spam:', err);
        }
      }
    }

    // ── Anti-Image-Spam (tracks messages with attachments/embeds over time) ─────
    const imageAttachments = message.attachments.filter(a => a.contentType && a.contentType.startsWith('image/'));
    const hasImages = imageAttachments.size > 0;
    if (settings.antiImageSpam && hasImages) {
      const limit    = settings.imageLimit    || 3;
      const windowMs = (settings.imageDuration || 10) * 1000;
      const now      = Date.now();
      const key      = `${message.guild.id}-${message.author.id}`;

      // Push one timestamp per image (so bulk uploads in 1 message also count)
      if (!userImageMessages.has(key)) userImageMessages.set(key, []);
      const imageTimestamps = userImageMessages.get(key);
      for (let i = 0; i < imageAttachments.size; i++) imageTimestamps.push(now);
      const recentImages = imageTimestamps.filter(ts => now - ts < windowMs);
      userImageMessages.set(key, recentImages);

      // Trigger when user has sent `limit` image messages within the window
      if (recentImages.length >= limit) {
        try {
          await safeDelete(message);

          let violations = imageViolations.get(key) || 0;
          violations++;
          imageViolations.set(key, violations);

          await logToChannel(message.guild, {
            title: '🖼️ Anti-Image-Spam Triggered',
            user: message.author,
            fields: [
              { name: 'User',             value: `<@${message.author.id}>`, inline: true },
              { name: 'Channel',          value: `${message.channel}`,      inline: true },
              { name: 'Violations',       value: `${violations}/3`,          inline: true },
              { name: 'Images Detected',  value: `${recentImages.length} image message(s) in ${settings.imageDuration || 10}s / Limit: ${limit}` }
            ],
            color: 'Orange'
          }, 'automod');

          if (violations >= 3) {
            try {
              await message.member.timeout(10 * 60 * 1000, 'Anti-image-spam: Excessive image spam');

              try {
                const dmEmbed = new EmbedBuilder()
                  .setColor('Red')
                  .setTitle('You have been timed out')
                  .setDescription(`You have been timed out in **${message.guild.name}** for **10 minutes**.\n**Reason:** Excessive image spam.`);
                await message.author.send({ embeds: [dmEmbed] });
              } catch (dmErr) {
                console.error('Could not DM user:', dmErr);
              }

              const muteEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🖼️ User Timed Out')
                .addFields(
                  { name: 'User',      value: `<@${message.author.id}>`, inline: true },
                  { name: 'Duration',  value: '10 minutes',               inline: true },
                  { name: 'Reason',   value: '🖼️ Image Spam',            inline: true },
                  { name: 'Violation', value: `Sent **${recentImages.length} images** in ${settings.imageDuration || 10}s in ${message.channel} — **3rd offense**` }
                );

              const muteMsg = await message.channel.send({ embeds: [muteEmbed] });
              setTimeout(() => muteMsg.delete().catch(() => {}), 30 * 1000);

              // Reset tracker after timeout
              userImageMessages.delete(key);
              setTimeout(() => { imageViolations.delete(key); }, 10 * 60 * 1000);

            } catch (err) {
              console.error('Failed to timeout member (image spam):', err);
              const embed = new EmbedBuilder()
                .setColor('Orange')
                .setDescription(`🖼️ Stop spamming images, <@${message.author.id}>!`);
              const warnMsg = await message.channel.send({ embeds: [embed] });
              setTimeout(() => warnMsg.delete().catch(() => {}), 30 * 1000);
            }
          } else {
            const embed = new EmbedBuilder()
              .setColor('Orange')
              .setDescription(`🖼️ Stop spamming images, <@${message.author.id}>! (Warning ${violations}/3)`);
            const warnMsg = await message.channel.send({ embeds: [embed] });
            setTimeout(() => warnMsg.delete().catch(() => {}), 30 * 1000);
          }
        } catch (err) {
          console.error('Error handling image spam:', err);
        }
      }
    }
  }
};
