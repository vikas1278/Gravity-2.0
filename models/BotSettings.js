const { Schema, model } = require('mongoose');

const botSettingsSchema = new Schema({
    // We can use a fixed ID or just always fetch the first document
    // Using a fixed ID 'global' makes it easy to find
    _id: { type: String, default: 'global' },
    activityName: { type: String, default: 'your server 👀' },
    activityType: { type: String, default: 'Watching' }, // Storing as string for readability
    status: { type: String, default: 'online' }
});

module.exports = model('BotSettings', botSettingsSchema);
