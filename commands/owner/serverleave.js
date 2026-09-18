const { SlashCommandBuilder, MessageFlags, ContainerBuilder, PermissionFlagsBits } = require('discord.js');
const { handleCommandError, safeDeferReply } = require('../../utils/responseHandler.js');
const { isOwner } = require('../../utils/ownerCheck.js');

const data = new SlashCommandBuilder()
    .setName('serverleave')
    .setDescription('(Owner only) Make the bot leave a server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option.setName('server')
            .setDescription('Server number (from /servers), Server ID, or exact server name')
            .setRequired(true)
    );

module.exports = {
    data,
    run: async (client, interaction) => {
        try {
            const deferred = await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred && !interaction.deferred && !interaction.replied) return;

            if (!isOwner(interaction.user.id)) {
                const deny = new ContainerBuilder()
                    .setAccentColor(0xED4245)
                    .addTextDisplayComponents(t => t.setContent('## ❌ Access Denied'))
                    .addSeparatorComponents(s => s)
                    .addTextDisplayComponents(t => t.setContent('This command is restricted to the **bot owner** only.'));

                return interaction.editReply({
                    components: [deny],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const input = interaction.options.getString('server').trim();
            const guilds = [...client.guilds.cache.values()];
            let targetGuild = null;

            if (/^\d+$/.test(input)) {
                const num = parseInt(input);
                if (num >= 1 && num <= guilds.length && input.length < 17) {
                    targetGuild = guilds[num - 1];
                } else {
                    targetGuild = client.guilds.cache.get(input);
                }
            } else {
                targetGuild = guilds.find(g =>
                    g.name.toLowerCase() === input.toLowerCase()
                );
            }

            if (!targetGuild) {
                const notFound = new ContainerBuilder()
                    .setAccentColor(0xED4245)
                    .addTextDisplayComponents(t => t.setContent('## ❌ Server Not Found'))
                    .addSeparatorComponents(s => s)
                    .addTextDisplayComponents(t => t.setContent(
                        `Could not find a server matching: **${input}**`
                    ))
                    .addSeparatorComponents(s => s)
                    .addTextDisplayComponents(t => t.setContent(
                        '**How to use:**\n' +
                        '> 🔢 Enter the **number** from `/servers` — e.g. `3`\n' +
                        '> 🆔 Enter the **server ID** — e.g. `782239943228391434`\n' +
                        '> 🔤 Enter the **exact server name**'
                    ));

                return interaction.editReply({
                    components: [notFound],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const serverName = targetGuild.name;
            const serverID = targetGuild.id;
            const memberCount = targetGuild.memberCount;

            await targetGuild.leave();

            const success = new ContainerBuilder()
                .setAccentColor(0x57F287)
                .addTextDisplayComponents(t => t.setContent('## ✅ Left Server Successfully'))
                .addSeparatorComponents(s => s)
                .addTextDisplayComponents(t => t.setContent(
                    `**Server Name:** ${serverName}\n` +
                    `**Server ID:** \`${serverID}\`\n` +
                    `**Members:** ${memberCount.toLocaleString()}`
                ))
                .addSeparatorComponents(s => s)
                .addTextDisplayComponents(t => t.setContent(
                    `🤖 Bot is now in **${client.guilds.cache.size}** server${client.guilds.cache.size !== 1 ? 's' : ''}.`
                ));

            return interaction.editReply({
                components: [success],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            return handleCommandError(interaction, error, 'serverleave',
                '## ❌ Error\n\nFailed to leave the server.\nPlease try again later.');
        }
    },
    execute: async (interaction) => {
        return module.exports.run(interaction.client, interaction);
    }
};
