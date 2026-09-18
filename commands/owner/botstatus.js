const { SlashCommandBuilder, ActivityType, PermissionFlagsBits } = require('discord.js');
const BotSettings = require('../../models/BotSettings');
const { isOwner } = require('../../utils/ownerCheck');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstatus')
        .setDescription('Update bot\'s presence (Bot Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('activity')
                .setDescription('Activity text')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type: Playing, Watching, Listening')
                .addChoices(
                    { name: 'Playing', value: 'Playing' },
                    { name: 'Watching', value: 'Watching' },
                    { name: 'Listening', value: 'Listening' }
                )
                .setRequired(true)),

    async execute(interaction) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({ content: '❌ Access Denied: Restricted to Bot Owner only.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const activity = interaction.options.getString('activity');
        const type = interaction.options.getString('type');

        await BotSettings.findOneAndUpdate(
            { _id: 'global' },
            {
                activityName: activity,
                activityType: type,
                status: 'online'
            },
            { upsert: true, new: true }
        );

        interaction.client.user.setPresence({
            activities: [{ name: activity, type: ActivityType[type] }],
            status: 'online'
        });

        await interaction.editReply({ content: `✅ Updated presence to **${type} ${activity}** and saved to database.` });
    },
    run: async (client, interaction) => {
        return module.exports.execute(interaction);
    }
};
