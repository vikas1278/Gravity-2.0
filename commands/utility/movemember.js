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
    .setName('movemember')
    .setDescription('Move a member to another voice channel')
    .addStringOption(option =>
      option.setName('member')
        .setDescription('Mention member (@user) or paste Member ID')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Select target voice channel')
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

    const memberInput = interaction.options.getString('member');
    const cleanMemberId = memberInput ? memberInput.replace(/[^0-9]/g, '') : '';

    if (!cleanMemberId) {
      return interaction.editReply({
        content: '❌ Invalid member input. Please mention a member (@user) or paste a valid Member ID.'
      });
    }

    let targetMember;
    try {
      targetMember = await interaction.guild.members.fetch(cleanMemberId);
    } catch (err) {
      return interaction.editReply({ content: `❌ Could not find member with ID \`${cleanMemberId}\` in this server.` });
    }

    if (!targetMember.voice || !targetMember.voice.channel) {
      return interaction.editReply({ content: `❌ **${targetMember.user.tag}** is not connected to any voice channel.` });
    }

    const rawTargetChannel = interaction.options.getChannel('channel');
    if (!rawTargetChannel) {
      return interaction.editReply({
        content: '❌ Invalid voice channel selected.'
      });
    }

    const targetChannel = await interaction.guild.channels.fetch(rawTargetChannel.id).catch(() => rawTargetChannel);

    if (!isVoiceChannel(targetChannel)) {
      return interaction.editReply({ content: `❌ Selected channel is not a valid voice channel.` });
    }

    if (targetMember.voice.channel.id === targetChannel.id) {
      return interaction.editReply({ content: `❌ **${targetMember.user.tag}** is already in **${targetChannel.name}**.` });
    }

    const oldChannel = targetMember.voice.channel;

    try {
      await targetMember.voice.setChannel(targetChannel.id, `Moved by ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setTitle('🔊 Member Moved')
        .setDescription(`Successfully moved **${targetMember.user.tag}**`)
        .addFields(
          { name: 'Member', value: `<@${targetMember.id}>`, inline: true },
          { name: 'From Voice Channel', value: `${oldChannel.name}`, inline: true },
          { name: 'To Voice Channel', value: `${targetChannel.name}`, inline: true }
        )
        .setColor('Green')
        .setFooter({ text: `Moved by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await logToChannel(interaction.guild, {
        title: '🔊 Voice Member Moved',
        fields: [
          { name: 'Member', value: `<@${targetMember.id}>`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'From Channel', value: `${oldChannel.name}`, inline: true },
          { name: 'To Channel', value: `${targetChannel.name}`, inline: true }
        ],
        color: 'Green'
      }, 'voice').catch(() => {});
    } catch (err) {
      console.error('Failed to move member:', err);
      return interaction.editReply({ content: `❌ Failed to move member: ${err.message}` });
    }
  }
};
