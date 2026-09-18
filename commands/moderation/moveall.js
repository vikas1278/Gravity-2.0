const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { isOwner } = require('../../utils/ownerCheck');
const logToChannel = require('../../utils/logToChannel');

function isAuthorized(interaction) {
  const userId = interaction.user.id;
  const guildOwnerId = interaction.guild?.ownerId;

  if (guildOwnerId && userId === guildOwnerId) return true;
  if (interaction.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.member?.permissions?.has(PermissionFlagsBits.MoveMembers)) return true;

  return isOwner(userId);
}

function isVoiceChannel(channel) {
  if (!channel) return false;
  return channel.type === ChannelType.GuildVoice ||
         channel.type === ChannelType.GuildStageVoice ||
         (typeof channel.isVoiceBased === 'function' && channel.isVoiceBased());
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moveall')
    .setDescription('Move all members from one voice channel to another')
    .addChannelOption(option =>
      option.setName('from')
        .setDescription('Source voice channel')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('to')
        .setDescription('Target voice channel')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
    } catch (e) {
      console.error('Defer error:', e);
    }

    if (!isAuthorized(interaction)) {
      return interaction.editReply({
        content: '❌ You do not have permission to use this command. (Requires **Move Members** permission, **Server Owner**, or **Bot Owner**)'
      });
    }

    const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
    if (botMember && !botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
      return interaction.editReply({
        content: '❌ I need the **Move Members** permission to move members between voice channels.'
      });
    }

    const rawFrom = interaction.options.getChannel('from');
    const rawTo = interaction.options.getChannel('to');

    if (!rawFrom || !rawTo) {
      return interaction.editReply({
        content: '❌ Invalid channel selection. Please select valid voice channels.'
      });
    }

    // Fetch full channel objects to ensure .members and channel type are fully resolved
    const fromChannel = await interaction.guild.channels.fetch(rawFrom.id).catch(() => rawFrom);
    const toChannel = await interaction.guild.channels.fetch(rawTo.id).catch(() => rawTo);

    if (!isVoiceChannel(fromChannel) || !isVoiceChannel(toChannel)) {
      return interaction.editReply({
        content: '❌ Both **from** and **to** channels must be valid voice channels.'
      });
    }

    if (fromChannel.id === toChannel.id) {
      return interaction.editReply({
        content: '❌ Source voice channel and target voice channel cannot be the same.'
      });
    }

    const members = fromChannel.members;
    if (!members || members.size === 0) {
      return interaction.editReply({
        content: `❌ No members are currently connected to **${fromChannel.name}**.`
      });
    }

    let movedCount = 0;
    let failedCount = 0;

    for (const [id, member] of members) {
      try {
        if (member.voice?.channelId) {
          await member.voice.setChannel(toChannel.id, `Mass moved by ${interaction.user.tag}`);
          movedCount++;
        }
      } catch (err) {
        console.error(`Failed to move member ${member.user?.tag || id}:`, err.message);
        failedCount++;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🔊 Mass Voice Move Completed')
      .setDescription(`Moved members from **${fromChannel.name}** to **${toChannel.name}**`)
      .addFields(
        { name: 'Successfully Moved', value: `${movedCount} member(s)`, inline: true },
        { name: 'From', value: `${fromChannel.name}`, inline: true },
        { name: 'To', value: `${toChannel.name}`, inline: true }
      )
      .setColor('Green')
      .setFooter({ text: `Executed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    if (failedCount > 0) {
      embed.addFields({ name: 'Failed to Move', value: `${failedCount} member(s)`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });

    await logToChannel(interaction.guild, {
      title: '🔊 Mass Voice Members Moved',
      fields: [
        { name: 'Moved Count', value: `${movedCount} members`, inline: true },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'From Channel', value: `${fromChannel.name}`, inline: true },
        { name: 'To Channel', value: `${toChannel.name}`, inline: true }
      ],
      color: 'Green'
    }, 'voice').catch(() => {});
  }
};
