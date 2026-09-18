const { Schema, model } = require('mongoose');

const settingsSchema = new Schema({
  guildId: String,
  automodEnabled: { type: Boolean, default: false },
  antiLink: { type: Boolean, default: false },
  antiSpam: { type: Boolean, default: false },
  antiEmojiSpam: { type: Boolean, default: false },
  emojiLimit: { type: Number, default: 5 },
  emojiDuration: { type: Number, default: 10 },
  antiStickerSpam: { type: Boolean, default: false },
  stickerLimit: { type: Number, default: 3 },
  stickerDuration: { type: Number, default: 10 },
  antiImageSpam: { type: Boolean, default: false },
  imageLimit: { type: Number, default: 3 },
  imageDuration: { type: Number, default: 10 },
  antiGhostPing: { type: Boolean, default: false },
  logChannelId: { type: String, default: null },
  modLogChannelId: { type: String, default: null },
  msgLogChannelId: { type: String, default: null },
  voiceLogChannelId: { type: String, default: null },
  automodLogChannelId: { type: String, default: null },
  ignoredUsers: { type: [String], default: [] },
  ignoredRoles: { type: [String], default: [] },
  ignoredChannels: { type: [String], default: [] },
  autoResponses: [
    {
      trigger: String,
      response: String,
      image: String,
      title: String,
      color: String,
      footer: String,
      thumbnail: String,
      fields: [
        {
          name: String,
          value: String,
        },
      ],
    },
  ],
});

module.exports = model('GuildSettings', settingsSchema);
