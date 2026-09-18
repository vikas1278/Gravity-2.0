const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const TTSConfig = require('../../models/TTSConfig');
const { isOwner } = require('../../utils/ownerCheck');
const { getEmoji } = require('../../UI/emojis/emoji');

function isAuthorized(interaction) {
    const userId = interaction.user.id;
    const guildOwnerId = interaction.guild?.ownerId;

    if (guildOwnerId && userId === guildOwnerId) {
        return true;
    }

    if (interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    return isOwner(userId);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ttssetup')
        .setDescription('Setup the Text-to-Speech voice for this server (Admin/Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('voice')
                .setDescription('Select a voice for the bot')
                .setRequired(true)
                .addChoices(
                    { name: 'Aditi (English - Indian Female)', value: 'en-IN-NeerjaNeural' },
                    { name: 'Prabhat (English - Indian Male)', value: 'en-IN-PrabhatNeural' },
                    { name: 'Swara (Hindi Female)', value: 'hi-IN-SwaraNeural' },
                    { name: 'Madhur (Hindi Male)', value: 'hi-IN-MadhurNeural' },
                    { name: 'Aria (US Female)', value: 'en-US-AriaNeural' },
                    { name: 'Christopher (US Male)', value: 'en-US-ChristopherNeural' },
                    { name: 'Sonia (UK Female)', value: 'en-GB-SoniaNeural' }
                )
        ),
    run: async (client, interaction) => {
        try {
            if (!isAuthorized(interaction)) {
                return interaction.reply({
                    content: `${getEmoji('error') || '❌'} This command is restricted to the **bot owner**, **server owner**, and **administrators** only.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const voice = interaction.options.getString('voice');

            let config = await TTSConfig.findOne({ guildId: interaction.guildId });
            if (!config) {
                config = new TTSConfig({ guildId: interaction.guildId, voice: voice });
            } else {
                config.voice = voice;
            }
            await config.save();

            const voiceMap = {
                'en-IN-NeerjaNeural': 'Aditi (English - Indian Female)',
                'en-IN-PrabhatNeural': 'Prabhat (English - Indian Male)',
                'hi-IN-SwaraNeural': 'Swara (Hindi Female)',
                'hi-IN-MadhurNeural': 'Madhur (Hindi Male)',
                'en-US-AriaNeural': 'Aria (US Female)',
                'en-US-ChristopherNeural': 'Christopher (US Male)',
                'en-GB-SoniaNeural': 'Sonia (UK Female)'
            };
            const voiceDisplayName = voiceMap[voice] || voice;

            return interaction.reply({
                content: `${getEmoji('success') || '✅'} The server's TTS voice has been updated to **${voiceDisplayName}**!`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error in ttssetup:', error);
            return interaction.reply({
                content: `${getEmoji('error') || '❌'} An error occurred while updating the TTS setup.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
