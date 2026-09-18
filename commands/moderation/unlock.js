const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const logToChannel = require('../../utils/logToChannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a previously locked text or voice channel')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to unlock (defaults to current channel)')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
          ChannelType.GuildStageVoice
        )
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for unlocking the channel')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Fetch owner info
    const ownerId = process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',')[0] : null;
    let ownerName = 'Bot Owner';
    let ownerIcon = null;

    if (ownerId) {
      try {
        const owner = await interaction.client.users.fetch(ownerId);
        ownerName = owner.username;
        ownerIcon = owner.displayAvatarURL();
      } catch (e) {
        console.error('Failed to fetch owner:', e);
      }
    }

    // Check bot permissions in target channel
    const botMember = interaction.guild.members.me;
    const botPerms = channel.permissionsFor(botMember);
    if (!botPerms || !botPerms.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({
        content: `❌ I don't have **Manage Channels** permission in ${channel}.`,
      });
    }

    // Determine channel type
    const isVoice =
      channel.type === ChannelType.GuildVoice ||
      channel.type === ChannelType.GuildStageVoice;

    const everyoneRole = interaction.guild.roles.everyone;
    const currentPerms = channel.permissionOverwrites.resolve(everyoneRole.id);

    // Already unlocked?
    if (isVoice) {
      if (!currentPerms || !currentPerms.deny.has(PermissionFlagsBits.Connect)) {
        return interaction.editReply({
          content: `🔓 ${channel} is **not locked**.`,
        });
      }
    } else {
      if (!currentPerms || !currentPerms.deny.has(PermissionFlagsBits.SendMessages)) {
        return interaction.editReply({
          content: `🔓 ${channel} is **not locked**.`,
        });
      }
    }

    try {
      if (isVoice) {
        // Restore Connect to null (inherit from server default)
        await channel.permissionOverwrites.edit(everyoneRole, {
          Connect: null,
        });
      } else {
        // Restore text permissions to null (inherit from server default)
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null,
          SendMessagesInThreads: null,
          AddReactions: null,
        });
      }

      const channelTypeLabel = isVoice ? 'Voice Channel' : 'Text Channel';

      const embed = new EmbedBuilder()
        .setTitle('🔓 Channel Unlocked')
        .setDescription(`${channel} has been unlocked for **everyone**.`)
        .addFields(
          { name: 'Channel', value: `${channel} (${channelTypeLabel})`, inline: true },
          { name: 'Unlocked By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setColor('#06D6A0')
        .setFooter({ text: `Developed by ${ownerName}`, iconURL: ownerIcon })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Send an unlock notice in the text channel itself
      if (!isVoice) {
        try {
          // Find and delete the old pinned lock message
          const pinnedMessages = await channel.messages.fetchPinned();
          const lockMessage = pinnedMessages.find(m => 
            m.author.id === interaction.client.user.id && 
            m.embeds.length > 0 && 
            m.embeds[0].title === '🔒 Channel Locked'
          );

          if (lockMessage) {
            // Unpin and delete to clean up the channel
            await lockMessage.delete().catch(() => {});
          }

          // Send a new, friendly unlock message
          const noticeEmbed = new EmbedBuilder()
            .setTitle('🔓 Channel Unlocked')
            .setDescription(
              '**This channel is now unlocked!** 🎉\n\n' +
              'You are free to chat here again. Please remember to follow the server rules.'
            )
            .setColor('#06D6A0')
            .setTimestamp();

          await channel.send({ embeds: [noticeEmbed] });
        } catch (err) {
          console.error('Failed to manage unlock notices:', err.message);
        }
      }

      await logToChannel(
        interaction.guild,
        {
          title: '🔓 Channel Unlocked',
          fields: [
            { name: 'Channel', value: `<#${channel.id}> (${channelTypeLabel})`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason },
          ],
          color: 'Green',
        },
        'mod'
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply({
        content: `❌ Failed to unlock channel: ${err.message}`,
      });
    }
  },
};
