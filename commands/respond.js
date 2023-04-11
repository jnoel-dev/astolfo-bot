const { SlashCommandBuilder, Events } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('respond')
		.setDescription('Astolfo will respond to the current message in chat'),
	async execute(interaction) {

		let lastMessage = '';
		await interaction.channel.messages.fetch({ limit: 1 }).then(messages => {
		lastMessage = messages.first();
		})
		.catch(console.error);
		interaction.client.emit(Events.MessageCreate, lastMessage, true);
	},
};