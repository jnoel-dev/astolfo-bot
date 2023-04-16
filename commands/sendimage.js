const { SlashCommandBuilder } = require('discord.js');
const { setTimeout } = require("timers/promises");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('sendimage')
		.setDescription('Astolfo will send an image to a user')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('the user to send the image to')
				.setRequired(true))
		.addAttachmentOption(option =>
			option.setName('image')
				.setDescription('image to send')
				.setRequired(true)),
				

				
	async execute(interaction) {

		await interaction.deferReply({ ephemeral: true });
        await interaction.channel.sendTyping();
        await setTimeout(2000);

		await interaction.channel.send('<@' + interaction.options.getUser('user').id + '>');
		await interaction.channel.send({
			files: [{
				attachment: interaction.options.getAttachment('image').attachment
			}]
			});
		await interaction.editReply('Done!',{ ephemeral: true });
	},
};