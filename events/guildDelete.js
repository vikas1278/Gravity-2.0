const { getAutoplayCollection, getLanguageCollection } = require('../mongodb');
const colors = require('../UI/colors/colors');

module.exports = async (client, guild) => {
    try {
        const guildId = guild.id;
        const guildName = guild.name || guildId;

        // Delete autoplay & 24/7 settings for this server
        const autoplayColl = getAutoplayCollection();
        if (autoplayColl) {
            await autoplayColl.deleteOne({ guildId });
        }

        // Delete language setting for this server
        const languageColl = getLanguageCollection();
        if (languageColl) {
            await languageColl.deleteOne({ guildId });
        }

        console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.yellow}Cleaned up data for server: ${guildName} (${guildId})${colors.reset}`);

    } catch (error) {
        console.error(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.red}Failed to clean up data for guild ${guild?.id}: ${error.message}${colors.reset}`);
    }
};
