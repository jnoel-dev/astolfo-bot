const { Events } = require('discord.js');
const MindsDB = require('mindsdb-js-sdk');
const { setTimeout } = require("timers/promises");
const Grapheme = require('grapheme-splitter');
const { Configuration, OpenAIApi } = require("openai");

const { MINDSDB_USERNAME, MINDSDB_PASSWORD, MINDSDB_MODEL, CONTEXT_DEPTH, OPENAI_API_KEY, LOWERCASE_WORDS, UPPERCASE_WORDS } = require('../config.json');

module.exports = {
	name: Events.MessageCreate,
	async execute(message,forceResponse) {
        let parsedMessage = message.content.replace(/<@(.*?)>/,"");
        let botResponse = '';
        let chatlog = '';
        let textModifier = '';
        let query = '';

        for (word in LOWERCASE_WORDS){
            if (message.cleanContent.includes(LOWERCASE_WORDS[word])){
                await message.channel.sendTyping();
                await setTimeout(2000);
                message.channel.send("*"+LOWERCASE_WORDS[word].charAt(0).toLowerCase() + LOWERCASE_WORDS[word].slice(1));
            }
        }

        for (word in UPPERCASE_WORDS){
            if (message.cleanContent.includes(UPPERCASE_WORDS[word])){
                await message.channel.sendTyping();
                await setTimeout(2000);
                message.channel.send("*"+UPPERCASE_WORDS[word].charAt(0).toUpperCase() + UPPERCASE_WORDS[word].slice(1));
            }
        }

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

        if (message.mentions.has(message.client.user.id) || getRandom(200) || forceResponse) {
            
            const configuration = new Configuration({
            apiKey: OPENAI_API_KEY,
            });
            const openai = new OpenAIApi(configuration);

            await message.channel.sendTyping();

            if (parsedMessage == ' 🫂'){
                await setTimeout(2000);
                message.reply(' 🫂');
                return;
            }

            if (isMostlyEmojis(parsedMessage)){
                chatlog = message.cleanContent;
                textModifier = '(respond back with only relevant emojis)';
            }

            if(getRandom(200)){

            }

            constructQuery();
            
            await attemptQuery(true);
            
            if (botResponse.includes('Astolfo:')){
                botResponse.replace(/Astolfo:/g,'');
            }

            if (botResponse.includes('###DALL-E###')){

                
                const response = await openai.createImage({
                    prompt: message.cleanContent.replace('@Astolfo','').replace('@',''),
                    n: 1,
                    size: "512x512",
                  });
                  botResponse = response.data.data[0].url;
            }

            if (botResponse.includes('@')){

                let mentionedUsers = botResponse.match(/(@[^\s!]+)/g);
                let mentionedUsersClean = botResponse.match(/(@[^\s!]+)/g);
                for (user in mentionedUsers){
                    mentionedUsers[user] = mentionedUsers[user].substring(1,mentionedUsers[user].length-1);
                    mentionedUsersClean[user] = mentionedUsersClean[user].replace('@','');
                    let userCache = Array.from(message.client.users.cache);
                    for (index in userCache){
                        if(userCache[index][1].username.includes(mentionedUsers[user])){

                            botResponse = botResponse.replace(`@${mentionedUsersClean[user]}`,`<@${userCache[index][1].id}>`);
                        }
                        
                    }
                }

            }

            console.log(botResponse);
            message.reply(botResponse);
             
        }
        else if (getRandom(25)){

            chatlog = message.cleanContent;
            textModifier = '(respond back with a single emoji only)';
            constructQuery();
            await attemptQuery(false);
            console.log(botResponse);
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
                await attemptQuery(false);
                } catch(error) {
                // Failed to authenticate.
                catchError(error)
                
                }
        }

        async function attemptQuery(sendTyping){
            console.log(query);
            try {
                if (sendTyping){
                    await message.channel.sendTyping();
                }
                const queryResult = await MindsDB.default.SQL.runQuery(query);

                if (queryResult.error_message == null){
                    botResponse = queryResult.rows[0].response;
                }

                else if (queryResult.error_message.includes("NoneType")){
                    message.client.user.setStatus('dnd')
                    await setTimeout(6000);
                    message.client.user.setStatus('online')
                    await attemptQuery(sendTyping);
                }
                
                } catch (error) {
                mindsDBConnect();
                }

        }

        function constructQuery(){

            query = 
            `SELECT response from ${MINDSDB_MODEL}
            WHERE chatlog = "${chatlog} ${textModifier}"`;
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
