const { Events } = require('discord.js');
const MindsDB = require('mindsdb-js-sdk');
const { setTimeout } = require("timers/promises");
const Grapheme = require('grapheme-splitter');
const { Configuration, OpenAIApi } = require("openai");

const { MINDSDB_USERNAME, MINDSDB_PASSWORD, MINDSDB_MODEL, CONTEXT_DEPTH, OPENAI_API_KEY } = require('../config.json');

module.exports = {
	name: Events.MessageCreate,
    cooldown: false,
	async execute(message,client) {

        let parsedMessage = message.content.replace(/<@(.*?)>/,"");
        let botResponse = '';
        let chatlog = '';
        let textModifier = '';
        let query = '';

        await message.channel.messages.fetch({ limit: CONTEXT_DEPTH }).then(messages => {

            messages = Array.from(messages);
            messages = new Map([...messages].reverse());
            
            let attachmentUrl = '';

            for (let [key, value] of messages){
                
                if (value.attachments.size > 0){
                    let test = value.attachments.entries().next().value[1].url;
                    if (value.attachments.entries().next().value[1].url != null){
                        attachmentUrl = value.attachments.entries().next().value[1].url
                    }
                }

                chatlog = chatlog.concat(`${value.author.username}:${value.cleanContent} ${attachmentUrl}\n`);

            }
                                
            })
            .catch(console.error);

        if (message.author.bot) return false;

        if (message.content.includes("@here") || message.content.includes("@everyone")) return false;

        if (message.mentions.has(client.user.id) || getRandom(200)) {

            this.cooldown = true
            
            const configuration = new Configuration({
            apiKey: OPENAI_API_KEY,
            });
            const openai = new OpenAIApi(configuration);

            await message.channel.sendTyping();

            if (isMostlyEmojis(parsedMessage)){
                chatlog = message.cleanContent;
                textModifier = '(respond back with only relevant emojis)';
            }

            constructQuery();
            
            await attemptQuery();
            
            if (botResponse.includes('###DALL-E###')){

                
                const response = await openai.createImage({
                    prompt: message.cleanContent.replace('@Astolfo','').replace('@',''),
                    n: 1,
                    size: "512x512",
                  });
                  botResponse = response.data.data[0].url;
            }
            else if (botResponse.includes('@')){
                botResponse = botResponse.replace('@' + message.author.username,message.author);
            }


            message.reply(botResponse);
             
        }
        else if (getRandom(15)){

            chatlog = message.cleanContent;
            textModifier = '(respond back with a single emoji only)';
            constructQuery();
            await attemptQuery();
            message.react(botResponse);
            
        }

        function isMostlyEmojis(str) {
            const emojiRegex = /\p{Extended_Pictographic}/ug;
            const emojis = str.match(emojiRegex) || [];
            let splitter = new Grapheme();
            let test = emojis.length / splitter.splitGraphemes(str).length >= 0.5;
            return test;
        }

        async function mindsDBConnect(){
            try {
                await MindsDB.default.connect({
                    user: MINDSDB_USERNAME,
                    password: MINDSDB_PASSWORD
                });
                await attemptQuery();
                } catch(error) {
                // Failed to authenticate.
                catchError(error)
                
                }
        }

        async function attemptQuery(){
            console.log(query);
            try {
                await message.channel.sendTyping();
                const queryResult = await MindsDB.default.SQL.runQuery(query);

                if (queryResult.error_message == null){
                    botResponse = queryResult.rows[0].response;
                }

                else if (queryResult.error_message.includes("NoneType")){
                    client.user.setStatus('dnd')
                    await setTimeout(5000);
                    client.user.setStatus('online')
                    await attemptQuery();
                }
                
                } catch (error) {
                mindsDBConnect();
                }

        }

        function constructQuery(){

            query = 
            `SELECT response from ${MINDSDB_MODEL}
            WHERE chatlog = "${chatlog} + ${textModifier}"`;
            query = query.replace(/'/g, '');

        }

        function getRandom (chance){
            var num = Math.floor(Math.random() * chance);
            if (num === 1){
                return true;
            }
            else {
                return false;
            }
        }

        function catchError(error){
            console.log(error);
            return;
        }

	},
};
