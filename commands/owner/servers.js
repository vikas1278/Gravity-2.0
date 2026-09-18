const { SlashCommandBuilder, MessageFlags, ContainerBuilder, PermissionFlagsBits } = require('discord.js');
const { handleCommandError, safeDeferReply } = require('../../utils/responseHandler.js');
const { isOwner } = require('../../utils/ownerCheck.js');

const SERVERS_PER_PAGE = 10;

const data = new SlashCommandBuilder()
    .setName('servers')
    .setDescription('(Owner only) List all servers the bot is in')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function buildServerCard(guilds, page, totalPages) {
    const start = page * SERVERS_PER_PAGE;
    const slice = guilds.slice(start, start + SERVERS_PER_PAGE);

    const header = totalPages > 1
        ? `## 🌐 Server List  •  Page ${page + 1}/${totalPages}`
        : `## 🌐 Server List`;

    const summary = `> 🤖 **Bot is in ${guilds.length} server${guilds.length !== 1 ? 's' : ''}**`;

    const list = slice.map((g, i) => {
        const num = start + i + 1;
        return `**${num}.** **${g.name}**\n` +
               `╰ 👥 \`${g.memberCount.toLocaleString()}\` members  •  🆔 \`${g.id}\``;
    }).join('\n\n');

    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(t => t.setContent(header))
        .addSeparatorComponents(s => s)
        .addTextDisplayComponents(t => t.setContent(summary))
        .addSeparatorComponents(s => s)
        .addTextDisplayComponents(t => t.setContent(list));

    return container;
}

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

            const guilds = [...client.guilds.cache.values()];

            if (guilds.length === 0) {
                const empty = new ContainerBuilder()
                    .setAccentColor(0xED4245)
                    .addTextDisplayComponents(t => t.setContent('## 🌐 Server List'))
                    .addSeparatorComponents(s => s)
                    .addTextDisplayComponents(t => t.setContent('The bot is currently not in any servers.'));

                return interaction.editReply({
                    components: [empty],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const totalPages = Math.ceil(guilds.length / SERVERS_PER_PAGE);
            const card = buildServerCard(guilds, 0, totalPages);

            return interaction.editReply({
                components: [card],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            return handleCommandError(interaction, error, 'servers',
                '## ❌ Error\n\nFailed to retrieve the server list.\nPlease try again later.');
        }
    },
    execute: async (interaction) => {
        return module.exports.run(interaction.client, interaction);
    }
};
