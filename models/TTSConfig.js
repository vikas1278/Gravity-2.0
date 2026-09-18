const mongoose = require('mongoose');

const TTSConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    voice: {
        type: String,
        default: 'en-IN-NeerjaNeural'
    }
});

module.exports = mongoose.model('TTSConfig', TTSConfigSchema);
