// /commands/general/math.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const math = require('mathjs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('math')
    .setDescription('Calculate a math expression.')
    .addStringOption(option =>
      option.setName('expression')
        .setDescription('Enter the math expression')
        .setRequired(true)),
  async execute(interaction) {
    const expr = interaction.options.getString('expression');

    try {
      const result = math.evaluate(expr);
      const ownerId = process.env.OWNER_IDS?.split(',')[0]?.trim();
      const owner = ownerId ? await interaction.client.users.fetch(ownerId).catch(() => null) : null;

      const embed = new EmbedBuilder()
        .setTitle('🧮 Math Result')
        .addFields(
          { name: 'Expression', value: `\`${expr}\`` },
          { name: 'Result', value: `\`${result}\`` }
        )
        .setColor('Blue')
        .setFooter({ text: `Developed by ${owner ? owner.tag : 'Unknown Owner'}`, iconURL: owner ? owner.displayAvatarURL() : interaction.client.user.displayAvatarURL() });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: '❌ Invalid expression.', flags: 64 });
    }
  }
};
