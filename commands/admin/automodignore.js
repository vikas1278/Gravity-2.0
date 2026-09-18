const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automodignore')
    .setDescription('Ignore specific roles, members, or channels from automod checks (anti-spam, anti-link, etc).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a role, user, or channel to the automod ignore list.')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to ignore')
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to ignore')
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to ignore (automod will not apply in this channel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role, user, or channel from the automod ignore list.')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to remove from ignore list')
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to remove from ignore list')
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to remove from ignore list')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all ignored roles, users, and channels.')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const channel = interaction.options.getChannel('channel');

    let settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = await GuildSettings.create({ guildId: interaction.guild.id });
    }

    if (!settings.ignoredUsers) settings.ignoredUsers = [];
    if (!settings.ignoredRoles) settings.ignoredRoles = [];
    if (!settings.ignoredChannels) settings.ignoredChannels = [];

    // ─── ADD ───────────────────────────────────────────────────────────────────
    if (subcommand === 'add') {
      if (!user && !role && !channel) {
        return interaction.reply({ content: 'Please provide at least a user, role, or channel to ignore.', ephemeral: true });
      }

      let added = [];

      if (user) {
        if (!settings.ignoredUsers.includes(user.id)) {
          settings.ignoredUsers.push(user.id);
          added.push(`<@${user.id}>`);
        }
      }

      if (role) {
        if (!settings.ignoredRoles.includes(role.id)) {
          settings.ignoredRoles.push(role.id);
          added.push(`<@&${role.id}>`);
        }
      }

      if (channel) {
        if (!settings.ignoredChannels.includes(channel.id)) {
          settings.ignoredChannels.push(channel.id);
          added.push(`<#${channel.id}>`);
        }
      }

      await settings.save();

      const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('🛡️ Automod Ignore Updated')
        .setDescription(
          added.length > 0
            ? `Successfully added to ignore list:\n${added.join('\n')}`
            : 'The provided user/role/channel is already in the ignore list.'
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── REMOVE ────────────────────────────────────────────────────────────────
    if (subcommand === 'remove') {
      if (!user && !role && !channel) {
        return interaction.reply({ content: 'Please provide at least a user, role, or channel to remove.', ephemeral: true });
      }

      let removed = [];

      if (user) {
        if (settings.ignoredUsers.includes(user.id)) {
          settings.ignoredUsers = settings.ignoredUsers.filter(id => id !== user.id);
          removed.push(`<@${user.id}>`);
        }
      }

      if (role) {
        if (settings.ignoredRoles.includes(role.id)) {
          settings.ignoredRoles = settings.ignoredRoles.filter(id => id !== role.id);
          removed.push(`<@&${role.id}>`);
        }
      }

      if (channel) {
        if (settings.ignoredChannels.includes(channel.id)) {
          settings.ignoredChannels = settings.ignoredChannels.filter(id => id !== channel.id);
          removed.push(`<#${channel.id}>`);
        }
      }

      await settings.save();

      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🛡️ Automod Ignore Updated')
        .setDescription(
          removed.length > 0
            ? `Successfully removed from ignore list:\n${removed.join('\n')}`
            : 'The provided user/role/channel was not in the ignore list.'
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── LIST ──────────────────────────────────────────────────────────────────
    if (subcommand === 'list') {
      const usersList    = settings.ignoredUsers.length    > 0 ? settings.ignoredUsers.map(id => `<@${id}>`).join('\n')    : 'None';
      const rolesList    = settings.ignoredRoles.length    > 0 ? settings.ignoredRoles.map(id => `<@&${id}>`).join('\n')   : 'None';
      const channelsList = settings.ignoredChannels.length > 0 ? settings.ignoredChannels.map(id => `<#${id}>`).join('\n') : 'None';

      const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🛡️ Automod Ignored List')
        .addFields(
          { name: '👤 Ignored Users',    value: usersList,    inline: true },
          { name: '🏷️ Ignored Roles',    value: rolesList,    inline: true },
          { name: '📢 Ignored Channels', value: channelsList, inline: true }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
