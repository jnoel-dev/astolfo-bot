const { Events, AttachmentBuilder } = require('discord.js');
const MindsDB = require('mindsdb-js-sdk');
const { setTimeout } = require("timers/promises");
const Grapheme = require('grapheme-splitter');
const mysql = require('mysql');
const { Configuration, OpenAIApi } = require("openai");
const fetch = require("node-fetch");
const fs = require('fs');
const request = require('request');


const { MINDSDB_USERNAME, MINDSDB_PASSWORD, MINDSDB_MODEL, CONTEXT_DEPTH, OPENAI_API_KEY, LOWERCASE_WORDS, UPPERCASE_WORDS, TEXT_MODIFIERS } = require('../config.json');

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
                attachmentUrl = '';

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

            else if(getRandom(200)){
                
                textModifier = TEXT_MODIFIERS[Math.floor(Math.random() * (TEXT_MODIFIERS.length-1))];
            }

            constructQuery();
            
            await attemptQuery(true);
            
            if (botResponse.includes('Astolfo:')){
                botResponse = botResponse.replace(/Astolfo:/g,'');
            }
            try{
                if (botResponse.includes('###DALL-E###')){

                    textModifier = '';
                    botResponse = botResponse.replace('###DALL-E###','');
                    
                    
                    const dalleResponse = await openai.createImage({
                        prompt: message.cleanContent.replace('@Astolfo','').replace('@',''),
                        n: 1,
                        size: "512x512",
                      });

                    let download = async function(uri, filename, callback){
                    request.head(uri, function(err, res, body){
                        console.log('content-type:', res.headers['content-type']);
                        console.log('content-length:', res.headers['content-length']);
                    
                        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
                    });
                    };
                    
                    await download(dalleResponse.data.data[0].url, './images/image.png', async function(){
                    console.log('done');
                    parseMentions();
                    await message.reply(botResponse);
                    await message.reply({
                        files: [{
                            attachment: './images/image.png',
                            name: 'image.png',
                            description: 'uwu'
                        }]
                        })
                        .then(console.log)
                        .catch(console.error);
                        
                    });
                    return;
                    
                }
            } catch(e){
                catchError(e);
                return;
            }

            parseMentions();

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

        function parseMentions(){
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

            chatlog = chatlog.replace(/"/g,'');

            query = 
            `SELECT response from ${MINDSDB_MODEL}
            WHERE chatlog = "${mysql.escape(chatlog)} ${mysql.escape(textModifier)}"`;
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
            message.reply({ content: 'You just crashed me 😢 It hurts... 😞', ephemeral: false });
            console.log(error);
            return;
        }

	},
};
