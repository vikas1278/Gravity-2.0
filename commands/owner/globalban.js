const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../../utils/ownerCheck.js');
const { handleCommandError, safeDeferReply, buildPaleCard } = require('../../utils/responseHandler.js');
const GlobalBan = require('../../models/GlobalBan.js');

// ─── Duration parser ──────────────────────────────────────────────────────────
// Accepts: 10m, 2h, 7d, 1w — returns milliseconds or null if invalid
function parseDuration(input) {
    if (!input) return null;
    const match = input.trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
    if (!match) return null;
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
    return amount * multipliers[unit];
}

function formatDuration(ms) {
    if (!ms) return 'Permanent';
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ') || '0s';
}

// ─── Command ──────────────────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('globalban')
        .setDescription('(Bot Owner only) Ban a user from every server the bot is in.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('user')
                .setDescription('User ID or mention (e.g. 123456789012345678 or @User)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the global ban')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Optional ban duration (e.g. 10m, 6h, 7d, 2w). Leave empty for permanent.')
                .setRequired(false)
        ),

    async execute(interaction) {
        return module.exports.run(interaction.client, interaction);
    },

    run: async (client, interaction) => {
        try {
            const deferred = await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred && !interaction.deferred && !interaction.replied) return;

            // ── Owner-only guard ──────────────────────────────────────────────
            if (!isOwner(interaction.user.id)) {
                const denyCard = buildPaleCard(
                    '❌ Access Denied',
                    ['This command is restricted to **Bot Owners** only.']
                );
                return interaction.editReply({ components: [denyCard], flags: MessageFlags.IsComponentsV2 });
            }

            // ── Parse inputs ──────────────────────────────────────────────────
            const rawUser   = interaction.options.getString('user').trim();
            const reason    = interaction.options.getString('reason') || 'No reason provided';
            const rawDur    = interaction.options.getString('duration');

            // Extract user ID from mention (<@id> or <@!id>) or plain ID
            const userId = rawUser.replace(/^<@!?(\d+)>$/, '$1').trim();
            if (!/^\d{17,20}$/.test(userId)) {
                const badIdCard = buildPaleCard(
                    '❌ Invalid User',
                    ['Please provide a valid **user ID** or **@mention**.\n\nExample: `/globalban user:123456789012345678`']
                );
                return interaction.editReply({ components: [badIdCard], flags: MessageFlags.IsComponentsV2 });
            }

            // Prevent self-ban
            if (userId === interaction.user.id) {
                const selfCard = buildPaleCard('❌ Invalid Target', ['You cannot globally ban yourself.']);
                return interaction.editReply({ components: [selfCard], flags: MessageFlags.IsComponentsV2 });
            }

            // ── Duration ──────────────────────────────────────────────────────
            const durationMs = parseDuration(rawDur);
            if (rawDur && durationMs === null) {
                const durCard = buildPaleCard(
                    '❌ Invalid Duration',
                    ['Duration format must be like `10m`, `6h`, `7d`, `2w`.\n\nLeave empty for a **permanent** ban.']
                );
                return interaction.editReply({ components: [durCard], flags: MessageFlags.IsComponentsV2 });
            }
            const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;

            // ── Fetch target user object ──────────────────────────────────────
            let targetUser = null;
            try {
                targetUser = await client.users.fetch(userId);
            } catch {
                const notFoundCard = buildPaleCard(
                    '❌ User Not Found',
                    [`Could not find a Discord user with ID \`${userId}\`.\nThey may not exist or the ID is wrong.`]
                );
                return interaction.editReply({ components: [notFoundCard], flags: MessageFlags.IsComponentsV2 });
            }

            // ── Prevent banning another bot owner ────────────────────────────
            if (isOwner(userId)) {
                const ownerCard = buildPaleCard('❌ Forbidden', ['You cannot globally ban another **bot owner**.']);
                return interaction.editReply({ components: [ownerCard], flags: MessageFlags.IsComponentsV2 });
            }

            // ── Upsert the DB record ──────────────────────────────────────────
            await GlobalBan.findOneAndUpdate(
                { userId },
                {
                    userId,
                    reason,
                    bannedBy: interaction.user.id,
                    bannedAt: new Date(),
                    expiresAt,
                    active: true
                },
                { upsert: true, new: true }
            );

            // ── Send progress card ────────────────────────────────────────────
            const guilds = [...client.guilds.cache.values()];
            const progressCard = buildPaleCard(
                '🔨 Global Ban — In Progress',
                [
                    `**Target:** ${targetUser.tag} (\`${userId}\`)`,
                    `**Reason:** ${reason}`,
                    `**Duration:** ${formatDuration(durationMs)}`,
                    `⏳ Banning from **${guilds.length}** server(s)… please wait.`
                ]
            );
            await interaction.editReply({ components: [progressCard], flags: MessageFlags.IsComponentsV2 });

            // ── Execute bans across all guilds ────────────────────────────────
            let successCount = 0;
            let skipCount    = 0;
            let failCount    = 0;
            const failedGuilds = [];

            const BAN_REASON = `[Global Ban] ${reason} — by ${interaction.user.tag}`;

            await Promise.allSettled(
                guilds.map(async guild => {
                    try {
                        // Check if bot has ban permission in this guild
                        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
                        if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
                            skipCount++;
                            return;
                        }

                        // Don't ban the guild owner
                        if (guild.ownerId === userId) {
                            skipCount++;
                            return;
                        }

                        await guild.bans.create(userId, {
                            reason: BAN_REASON,
                            deleteMessageSeconds: 0,
                        });
                        successCount++;
                    } catch (err) {
                        // 10007 = Unknown Member (not in guild) — still counts as a ban entry
                        if (err.code === 10007 || err.code === 10013) {
                            // Try to ban even if not a member
                            try {
                                await guild.bans.create(userId, { reason: BAN_REASON, deleteMessageSeconds: 0 });
                                successCount++;
                            } catch {
                                failCount++;
                                failedGuilds.push(guild.name);
                            }
                        } else {
                            failCount++;
                            failedGuilds.push(guild.name);
                        }
                    }
                })
            );

            // ── Try to DM the banned user ─────────────────────────────────────
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('DarkRed')
                    .setTitle('🔨 You have been globally banned')
                    .setDescription(
                        `You have been **globally banned** from all servers managed by **${client.user.username}**.\n\n` +
                        `**Reason:** ${reason}\n` +
                        `**Duration:** ${formatDuration(durationMs)}\n\n` +
                        `*If you believe this is a mistake, please contact the bot owner.*`
                    )
                    .setTimestamp();
                await targetUser.send({ embeds: [dmEmbed] });
            } catch {
                // DMs disabled or blocked — ignore silently
            }

            // ── Final summary card ────────────────────────────────────────────
            const summaryLines = [
                `**Target:** ${targetUser.tag} (\`${userId}\`)`,
                `**Reason:** ${reason}`,
                `**Duration:** ${formatDuration(durationMs)}`,
                expiresAt ? `**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:F>` : '',
                `\n✅ **Banned in:** ${successCount} server(s)\n⏭️ **Skipped:** ${skipCount} server(s) (no permission / guild owner)\n❌ **Failed:** ${failCount} server(s)`,
            ].filter(Boolean);

            if (failedGuilds.length > 0) {
                summaryLines.push(`**Failed Servers:**\n${failedGuilds.slice(0, 10).join('\n')}${failedGuilds.length > 10 ? `\n…and ${failedGuilds.length - 10} more` : ''}`);
            }

            const doneCard = buildPaleCard('🔨 Global Ban — Complete', summaryLines);
            return interaction.editReply({ components: [doneCard], flags: MessageFlags.IsComponentsV2 });

        } catch (error) {
            return handleCommandError(
                interaction,
                error,
                'globalban',
                '## ❌ Error\n\nFailed to execute the global ban.\nPlease try again later.'
            );
        }
    }
};
