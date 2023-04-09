const { Events } = require('discord.js');
const fetch = require('node-fetch');
const { HUGGINGFACE_MODEL_URL, HUGGINGFACE_TOKEN } = require('../config.json');

module.exports = {
	name: Events.MessageCreate,
	async execute(message,client) {
        if (message.author.bot) return false;

        if (message.content.includes("@here") || message.content.includes("@everyone") || message.type == "REPLY") return false;

        if (message.mentions.has(client.user.id)) {
            await message.channel.sendTyping();
            const payload = {
                inputs: {
                    text: message.content
                }
            };
            const headers = {
                'Authorization': 'Bearer ' + HUGGINGFACE_TOKEN
            };
            const response = await fetch(HUGGINGFACE_MODEL_URL, {
                method: 'post',
                body: JSON.stringify(payload),
                headers: headers
            });
            const data = await response.json();
            let botResponse = '';
            if (data.hasOwnProperty('generated_text')) {
                botResponse = data.generated_text;
            } else if (data.hasOwnProperty('error')) { // error condition
                botResponse = data.error;
            }
            
            // send message to channel as a reply
            message.reply(botResponse);
        }
	},
};

