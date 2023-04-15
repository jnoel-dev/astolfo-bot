const { SlashCommandBuilder } = require('discord.js');
const { setTimeout } = require("timers/promises");
const { FINISH_HIM_TEXT} = require('../finishhim_config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('finishhim')
		.setDescription('Astolfo will send the library thing'),
	async execute(interaction) {

        await interaction.channel.sendTyping();
        await setTimeout(6000);
        let lastMessage = '';
		await interaction.channel.messages.fetch({ limit: 1 }).then(messages => {
		lastMessage = messages.first();
		})
		.catch(console.error);
		lastMessage.reply('<@'+lastMessage.author.id + '>' + FINISH_HIM_TEXT);
	},
};