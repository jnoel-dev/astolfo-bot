const { SlashCommandBuilder } = require('discord.js');
const { setTimeout } = require("timers/promises");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('finishhim')
		.setDescription('Astolfo will send the library thing'),
	async execute(interaction) {

        await interaction.channel.sendTyping();
        await setTimeout(2000);
		interaction.channel.send(`I suppose you should jump off a building, definitions could be wrong about flight too. Why not be skeptical of the whole system, instead of the cherry picking what you want.

        This is how it goes every time. I demonstrate evidence and scientific studies and you point out that science could be wrong, or that maybe scientist haven't thought about "X" before. 
        
        I'm not trying to be mean, but I am sure that the scientific community has thought more deeply, about these issues, than you ever could; sitting in your chair as a security guard. The evidence is readily available to you, but you do not want to read or accept any of it. Only cherry pick that which conforms to your world view because you do not want to change.
        
        This isn't philosophy where everyone can have an equal opinion. 
        
        I know what the average American should know, but as evidenced by yourself unfortunately doesn't. 
        
        This is science. You need PHD's for this shit. And I will no longer be an Enabler to you.
        
        Go to fucking Library`);
	},
};