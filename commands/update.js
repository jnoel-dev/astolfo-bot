const { SlashCommandBuilder } = require('discord.js');
const { setTimeout } = require("timers/promises");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('update')
		.setDescription('update Astolfo'),
	async execute(interaction) {

        await interaction.channel.sendTyping();
        await setTimeout(2000);
		interaction.channel.send(`I have been updated! 🧠🧠🧠`);
	},
};