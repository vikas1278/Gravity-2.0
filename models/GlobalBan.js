const { Schema, model } = require('mongoose');

const globalBanSchema = new Schema({
  userId:       { type: String, required: true, unique: true },
  reason:       { type: String, default: 'No reason provided' },
  bannedBy:     { type: String, required: true },   // executor user ID
  bannedAt:     { type: Date,   default: Date.now },
  expiresAt:    { type: Date,   default: null },     // null = permanent
  active:       { type: Boolean, default: true },
});

module.exports = model('GlobalBan', globalBanSchema);
