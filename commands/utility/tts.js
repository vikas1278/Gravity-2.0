const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const { EdgeTTS } = require('node-edge-tts');
const TTSConfig = require('../../models/TTSConfig');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tts')
        .setDescription('Speak text in your voice channel')
        .addStringOption(option => 
            option.setName('text')
                .setDescription('The text you want the bot to say')
                .setRequired(true)
                .setMaxLength(2000)
        ),
    run: async (client, interaction) => {
        try {
            if (!client.ttsUsers) client.ttsUsers = new Map();
            
            const text = interaction.options.getString('text');
            const member = interaction.member;
            const voiceChannel = member.voice.channel;

            if (!voiceChannel) {
                return interaction.reply({
                    content: '❌ You need to be in a voice channel to use this command.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const botPermissions = voiceChannel.permissionsFor(interaction.guild.members.me);
            if (!botPermissions.has('Connect')) {
                return interaction.reply({
                    content: '❌ I do not have permission to join your voice channel.',
                    flags: MessageFlags.Ephemeral
                });
            }
            if (!botPermissions.has('Speak')) {
                return interaction.reply({
                    content: '❌ I do not have permission to speak in your voice channel.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Fetch TTS config for the guild
            let config = await TTSConfig.findOne({ guildId: interaction.guildId });
            const voiceName = config ? config.voice : 'en-IN-NeerjaNeural';

            // Check if text is Hindi (Devanagari script)
            const containsHindi = /[\u0900-\u097F]/.test(text);
            if (containsHindi && voiceName.startsWith('en-')) {
                return interaction.reply({
                    content: '⚠️ **Hindi Text Detected!** You are trying to read Hindi text, but your server is using an English voice.\nPlease ask an admin to use `/ttssetup` and select a Hindi AI speaker (like **Swara** or **Madhur**).',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply();

            const voiceLang = voiceName.split('-').slice(0, 2).join('-');
            const tts = new EdgeTTS({
                voice: voiceName,
                lang: voiceLang,
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
            });

            const outputPath = path.join(process.cwd(), `tts-${interaction.guildId}.mp3`);
            
            // Generate the audio file
            await tts.ttsPromise(text, outputPath);

            let connection = getVoiceConnection(interaction.guildId);

            if (!connection || connection.joinConfig.channelId !== voiceChannel.id) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
            }

            // Track the user who summoned the bot
            client.ttsUsers.set(interaction.guildId, {
                userId: interaction.user.id,
                channelId: voiceChannel.id
            });

            let player = connection.state.subscription?.player;
            if (!player) {
                player = createAudioPlayer();
                connection.subscribe(player);
                
                // Debug logs
                connection.on('stateChange', (oldState, newState) => {
                    console.log(`[VC DEBUG] Connection: ${oldState.status} -> ${newState.status}`);
                });
                player.on('error', error => {
                    console.error('[VC DEBUG] Audio Player Error:', error);
                });
            }

            const resource = createAudioResource(outputPath);
            player.play(resource);

            // Once the audio is done, delete the file
            player.once(AudioPlayerStatus.Idle, () => {
                setTimeout(() => {
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                }, 1000);
            });

            await interaction.editReply({
                content: `🗣️ Speaking: **${text}**`
            });

        } catch (error) {
            console.error('Error in tts command:', error);
            const outputPath = path.join(process.cwd(), `tts-${interaction.guildId}.mp3`);
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            if (interaction.deferred) {
                await interaction.editReply('❌ An error occurred while generating TTS.');
            } else {
                await interaction.reply({ content: '❌ An error occurred while generating TTS.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
