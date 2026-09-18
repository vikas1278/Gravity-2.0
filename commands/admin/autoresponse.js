const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoresponse')
        .setDescription('Manage auto-responses for the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new auto-response.')
                .addStringOption(option =>
                    option.setName('trigger')
                        .setDescription('The text that triggers the response.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('The message the bot should reply with.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('Optional image URL to include in the response.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Optional title for the embed.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Optional color for the embed (e.g., Red, Blue, #FFFFFF).')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer')
                        .setDescription('Optional footer text for the embed.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('thumbnail')
                        .setDescription('Optional thumbnail URL for the embed.')
                        .setRequired(false))
                .addStringOption(option => option.setName('field1_name').setDescription('Name for field 1').setRequired(false))
                .addStringOption(option => option.setName('field1_value').setDescription('Value for field 1').setRequired(false))
                .addStringOption(option => option.setName('field2_name').setDescription('Name for field 2').setRequired(false))
                .addStringOption(option => option.setName('field2_value').setDescription('Value for field 2').setRequired(false))
                .addStringOption(option => option.setName('field3_name').setDescription('Name for field 3').setRequired(false))
                .addStringOption(option => option.setName('field3_value').setDescription('Value for field 3').setRequired(false))
                .addStringOption(option => option.setName('field4_name').setDescription('Name for field 4').setRequired(false))
                .addStringOption(option => option.setName('field4_value').setDescription('Value for field 4').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove an auto-response.')
                .addStringOption(option =>
                    option.setName('trigger')
                        .setDescription('The trigger text to remove.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all auto-responses.')),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        let settings = await GuildSettings.findOne({ guildId }) || new GuildSettings({ guildId });

        if (subcommand === 'add') {
            const trigger = interaction.options.getString('trigger').toLowerCase();
            const response = interaction.options.getString('description');
            const image = interaction.options.getString('image');
            const title = interaction.options.getString('title');
            const color = interaction.options.getString('color');
            const footer = interaction.options.getString('footer');
            const thumbnail = interaction.options.getString('thumbnail');

            const fields = [];
            for (let i = 1; i <= 4; i++) {
                const name = interaction.options.getString(`field${i}_name`);
                const value = interaction.options.getString(`field${i}_value`);
                if (name && value) {
                    fields.push({ name, value });
                }
            }

            if (settings.autoResponses.some(ar => ar.trigger === trigger)) {
                return interaction.editReply({ content: `❌ An auto-response for "${trigger}" already exists.` });
            }

            settings.autoResponses.push({ trigger, response, image, title, color, footer, thumbnail, fields });
            await settings.save();

            return interaction.editReply({ content: `✅ Added auto-response for "${trigger}".` });
        }

        if (subcommand === 'remove') {
            const trigger = interaction.options.getString('trigger').toLowerCase();
            const initialLength = settings.autoResponses.length;

            settings.autoResponses = settings.autoResponses.filter(ar => ar.trigger !== trigger);

            if (settings.autoResponses.length === initialLength) {
                return interaction.editReply({ content: `❌ No auto-response found for "${trigger}".` });
            }

            await settings.save();
            return interaction.editReply({ content: `✅ Removed auto-response for "${trigger}".` });
        }

        if (subcommand === 'list') {
            if (settings.autoResponses.length === 0) {
                return interaction.editReply({ content: 'ℹ️ No auto-responses set up.' });
            }

            const embed = new EmbedBuilder()
                .setTitle('Auto-Responses')
                .setColor('Blue')
                .setDescription(settings.autoResponses.map((ar, i) =>
                    `**${i + 1}. Trigger:** \`${ar.trigger}\`\n**Description:** ${ar.response}${ar.image ? '\n**Image:** [Link](' + ar.image + ')' : ''}`
                ).join('\n\n'));

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
