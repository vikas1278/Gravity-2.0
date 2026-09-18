const { Schema, model, models } = require('mongoose');

const warnSchema = new Schema({
  userId: String,
  guildId: String,
  warnings: [
    {
      modId: String,
      reason: String,
      date: { type: Date, default: Date.now }
    }
  ]
});

// ✅ Only compile if it doesn't already exist
module.exports = models.Warning || model('Warning', warnSchema);
