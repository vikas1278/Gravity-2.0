const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('membersofrole')
        .setDescription('List all members who have a specific role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to list members for')
                .setRequired(true)),

    async execute(interaction) {
        const roleOption = interaction.options.getRole('role');

        // Defer reply as fetching members might take time
        await interaction.deferReply();

        try {
            // Ensure all members are fetched to get accurate list
            await interaction.guild.members.fetch();

            // Re-fetch the role from cache to ensure .members is populated
            const role = await interaction.guild.roles.fetch(roleOption.id);

            if (!role) {
                return interaction.editReply({ content: `❌ Role not found.` });
            }

            // Get members with the role
            const membersWithRole = role.members.map(m => m);
            const memberCount = membersWithRole.length;

            if (memberCount === 0) {
                return interaction.editReply({ content: `❌ No members found with the role **${role.name}**.` });
            }

            const pageSize = 50;
            const totalPages = Math.ceil(memberCount / pageSize);

            const generateEmbed = (page) => {
                const start = page * pageSize;
                const end = start + pageSize;
                const displayedMembers = membersWithRole.slice(start, end);

                const list = displayedMembers.map((m, index) => {
                    return `**${start + index + 1}.** ${m.user.username} ➔ ${m.id}`;
                }).join('\n');

                const ownerId = process.env.OWNER_IDS?.split(',')[0]?.trim();
                // Note: Fetching owner inside the loop/render might be slow if not cached, 
                // but usually client.users.fetch checks cache first. 
                // For better performance, we could fetch owner once outside.
                const owner = interaction.client.users.cache.get(ownerId);

                return new EmbedBuilder()
                    .setTitle(`Members of Role [${memberCount}]`)
                    .setDescription(`${role} (${role.id})\n\n${list}`)
                    .setColor(role.color || '#a855f7')
                    .setFooter({
                        text: `Page ${page + 1}/${totalPages} • Developed by ${owner ? owner.tag : 'Unknown Owner'}`,
                        iconURL: owner ? owner.displayAvatarURL() : interaction.client.user.displayAvatarURL()
                    });
            };

            const generateButtons = (page) => {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === totalPages - 1)
                    );
                return row;
            };

            // Initial owner fetch if needed
            const ownerId = process.env.OWNER_IDS?.split(',')[0]?.trim();
            if (ownerId) await interaction.client.users.fetch(ownerId).catch(() => null);

            let currentPage = 0;
            const embed = generateEmbed(currentPage);
            const components = totalPages > 1 ? [generateButtons(currentPage)] : [];

            const message = await interaction.editReply({ embeds: [embed], components });

            if (totalPages > 1) {
                const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        return i.reply({ content: 'These buttons are not for you!', flags: MessageFlags.Ephemeral });
                    }

                    if (i.customId === 'prev') {
                        currentPage--;
                    } else if (i.customId === 'next') {
                        currentPage++;
                    }

                    await i.update({ embeds: [generateEmbed(currentPage)], components: [generateButtons(currentPage)] });
                });

                collector.on('end', () => {
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev')
                                .setLabel('Previous')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('next')
                                .setLabel('Next')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true)
                        );
                    interaction.editReply({ components: [disabledRow] }).catch(() => { });
                });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ An error occurred while fetching members.' });
        }
    }
};
