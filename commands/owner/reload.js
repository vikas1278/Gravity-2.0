const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { isOwner } = require('../../utils/ownerCheck');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reload a command (Bot Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Name of the command to reload')
                .setRequired(true)),

    async execute(interaction) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({ content: '❌ Access Denied: Restricted to Bot Owner only.', flags: 64 });
        }

        const commandName = interaction.options.getString('command').toLowerCase();
        const command = interaction.client.commands.get(commandName);

        if (!command) {
            return interaction.reply({ content: `❌ Command \`${commandName}\` not found.`, flags: 64 });
        }

        const commandFoldersPath = path.join(__dirname, '../');
        const folder = fs.readdirSync(commandFoldersPath).find(folder => fs.existsSync(path.join(commandFoldersPath, folder, `${commandName}.js`)));

        if (!folder) return interaction.reply({ content: '❌ Command file not found.', flags: 64 });

        const resolvedPath = path.join(commandFoldersPath, folder, `${commandName}.js`);
        delete require.cache[require.resolve(resolvedPath)];

        try {
            const newCommand = require(resolvedPath);
            interaction.client.commands.set(newCommand.data.name, newCommand);
            await interaction.reply({ content: `✅ Successfully reloaded \`${commandName}\`.` });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: `❌ Error while reloading \`${commandName}\`: \n\`${error.message}\``, flags: 64 });
        }
    },
    run: async (client, interaction) => {
        return module.exports.execute(interaction);
    }
};
