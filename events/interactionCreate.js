const { InteractionType, MessageFlags } = require('discord.js');
const colors = require('../UI/colors/colors');
const { getLang, getLangSync } = require('../utils/languageLoader.js');
const { safeDeferUpdate } = require('../utils/responseHandler');

async function safeErrorReply(interaction, content) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  } catch (_) {}
}

module.exports = async (client, interaction) => {
  try {
    // ── Slash Commands ──────────────────────────────────────────────────
    if (interaction.type === InteractionType.ApplicationCommand || interaction.isChatInputCommand?.()) {
      if (!interaction?.guild) {
        const lang = await getLang(interaction.guildId).catch(() => getLangSync());
        return interaction?.reply({
          content: lang?.events?.interactionCreate?.noGuild ?? 'This command can only be used inside a server.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }

      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`${colors.cyan}[ INTERACTION ]${colors.reset} ${colors.red}Command not found: ${interaction.commandName}${colors.reset}`);
        return interaction?.reply({
          content: '❌ Unknown or unavailable command.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }

      const requiredPermissions = command.permissions;
      if (requiredPermissions && !interaction?.member?.permissions?.has(requiredPermissions)) {
        return interaction?.reply({
          content: '❌ You do not have permission to use this command.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }

      try {
        if (typeof command.run === 'function') {
          await command.run(client, interaction);
        } else if (typeof command.execute === 'function') {
          await command.execute(interaction);
        } else {
          console.error(`Command ${interaction.commandName} has neither run nor execute method.`);
        }
      } catch (error) {
        console.error(`${colors.cyan}[ INTERACTION ]${colors.reset} ${colors.red}Error executing command ${interaction.commandName}:${colors.reset}`, error);
        if (error?.code === 50027 || error?.message?.includes('Invalid Webhook Token')) return;
        await safeErrorReply(interaction, `❌ An error occurred while executing command \`/${interaction.commandName}\`: ${error.message}`);
      }
      return;
    }

    // ── Button Interactions ─────────────────────────────────────────────
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('help_')) {
        try {
          const deferred = await safeDeferUpdate(interaction);
          if (!deferred && !interaction.deferred && !interaction.replied) return;
          const helpCommand = client.commands.get('help');
          if (helpCommand && helpCommand.helpers?.handleComponent) {
            return await helpCommand.helpers.handleComponent(client, interaction);
          }
        } catch (error) {
          console.error('Error handling help button:', error);
          await safeErrorReply(interaction, 'An error occurred with help interaction button.');
        }
        return;
      }

      const button = client.buttons?.get(interaction.customId);
      if (button && typeof button.execute === 'function') {
        await button.execute(interaction);
      }
      return;
    }

    // ── Select Menu Interactions ────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('help_') || interaction.customId === 'help_category_select') {
        try {
          const deferred = await safeDeferUpdate(interaction);
          if (!deferred && !interaction.deferred && !interaction.replied) return;
          const helpCommand = client.commands.get('help');
          if (helpCommand && helpCommand.helpers?.handleComponent) {
            return await helpCommand.helpers.handleComponent(client, interaction);
          }
        } catch (error) {
          console.error('Error handling help select menu:', error);
          await safeErrorReply(interaction, 'An error occurred with help select menu.');
        }
        return;
      }

      const menu = client.selectMenus?.get(interaction.customId);
      if (menu && typeof menu.execute === 'function') {
        await menu.execute(interaction);
      }
      return;
    }

    // ── Modal Submissions ───────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const modal = client.modals?.get(interaction.customId);
      if (modal && typeof modal.execute === 'function') {
        await modal.execute(interaction);
      }
      return;
    }

  } catch (error) {
    console.error(`${colors.cyan}[ INTERACTION ]${colors.reset} ${colors.red}Unexpected interaction error:${colors.reset}`, error);
  }
};
