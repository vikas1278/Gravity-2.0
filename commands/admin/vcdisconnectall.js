const { SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits } = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const { handleCommandError, safeDeferReply, buildPaleCard } = require('../../utils/responseHandler.js');
const { isOwner } = require('../../utils/ownerCheck.js');
const logToChannel = require('../../utils/logToChannel');

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

const data = new SlashCommandBuilder()
    .setName('vcdisconnectall')
    .setDescription('Disconnect all members from a voice channel (Bot Owner, Server Owner, or Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Voice channel to disconnect all members from')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('reason')
            .setDescription('Reason for disconnecting members')
            .setRequired(false)
    );

module.exports = {
    data: data,
    run: async (client, interaction) => {
        try {
            const deferred = await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred && !interaction.deferred && !interaction.replied) return;

            if (!isAuthorized(interaction)) {
                const denyContainer = buildPaleCard(
                    `${getEmoji('error') || '❌'} Access Denied`,
                    ['This command can only be used by the **Bot Owner**, **Server Owner**, or members with **Administrator** permission.']
                );

                return interaction.editReply({
                    components: [denyContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const guild = interaction.guild;
            let targetChannel = interaction.options.getChannel('channel');

            if (!targetChannel && interaction.member?.voice?.channel) {
                targetChannel = interaction.member.voice.channel;
            }

            if (!targetChannel) {
                const noChannelContainer = buildPaleCard(
                    `${getEmoji('warning') || '⚠️'} Voice Channel Required`,
                    ['Please select a target voice channel or join a voice channel first.']
                );

                return interaction.editReply({
                    components: [noChannelContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const members = targetChannel.members;
            if (!members || members.size === 0) {
                const emptyContainer = buildPaleCard(
                    `${getEmoji('warning') || '⚠️'} Channel Empty`,
                    [`No members are currently connected to **${targetChannel.name}**.`]
                );

                return interaction.editReply({
                    components: [emptyContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
            if (botMember && !targetChannel.permissionsFor(botMember)?.has(PermissionFlagsBits.MoveMembers)) {
                const noPermContainer = buildPaleCard(
                    `${getEmoji('error') || '❌'} Missing Bot Permission`,
                    ['I need the **Move Members** permission in that voice channel to disconnect members.']
                );

                return interaction.editReply({
                    components: [noPermContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const reason = interaction.options.getString('reason') || `Mass voice disconnect by ${interaction.user.tag}`;
            let disconnectedCount = 0;
            let failedCount = 0;

            for (const [id, member] of members) {
                try {
                    await member.voice.disconnect(reason);
                    disconnectedCount++;
                } catch (err) {
                    failedCount++;
                }
            }

            // Audit log
            await logToChannel(guild, {
                title: '🛑 Mass Voice Disconnect',
                fields: [
                    { name: 'Channel', value: `${targetChannel.name} (<#${targetChannel.id}>)`, inline: true },
                    { name: 'Disconnected Members', value: `${disconnectedCount}`, inline: true },
                    { name: 'Authorized By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                ],
                color: 'Red'
            }, 'voice').catch(() => {});

            const isGuildOwner = guild.ownerId === interaction.user.id;
            const isBotOwner = isOwner(interaction.user.id);
            let roleText = 'Administrator';
            if (isGuildOwner) roleText = 'Server Owner';
            if (isBotOwner) roleText = 'Bot Owner';

            const summaryLines = [
                `Successfully disconnected **${disconnectedCount}** member(s) from **${targetChannel.name}**!\n\n` +
                `• **Server:** ${guild.name}\n` +
                `• **Channel:** <#${targetChannel.id}>\n` +
                `• **Reason:** ${reason}\n` +
                `• **Authorized By:** ${interaction.user.tag} (${roleText})`
            ];

            if (failedCount > 0) {
                summaryLines.push(`⚠️ Failed to disconnect ${failedCount} member(s) (insufficient hierarchy or left).`);
            }

            const successContainer = buildPaleCard(
                `${getEmoji('success') || '✅'} Voice Disconnect Completed`,
                summaryLines
            );

            return interaction.editReply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            return handleCommandError(
                interaction,
                error,
                'vcdisconnectall',
                '## ❌ Error\n\nFailed to disconnect members from voice channel.\nPlease try again later.'
            );
        }
    },
    execute: async (interaction) => {
        return module.exports.run(interaction.client, interaction);
    }
};
