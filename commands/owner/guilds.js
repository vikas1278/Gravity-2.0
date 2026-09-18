const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../../utils/ownerCheck');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guilds')
        .setDescription('Shows the servers the bot is in (Bot Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({ content: '❌ Access Denied: Restricted to Bot Owner only.', flags: 64 });
        }

        const guildList = interaction.client.guilds.cache.map(g => `${g.name} (${g.id}) - ${g.memberCount} members`).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`🤖 Bot Guilds (${interaction.client.guilds.cache.size})`)
            .setDescription(`\`\`\`\n${guildList.slice(0, 4000)}\n\`\`\``)
            .setColor('#7289DA')
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
    run: async (client, interaction) => {
        return module.exports.execute(interaction);
    }
};
