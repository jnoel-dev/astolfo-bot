const { Events } = require('discord.js');
const MindsDB = require('mindsdb-js-sdk');
const mysql = require('mysql');
const { setTimeout } = require("timers/promises");
const Grapheme = require('grapheme-splitter');

const { MINDSDB_USERNAME, MINDSDB_PASSWORD } = require('../config.json');

module.exports = {
	name: Events.MessageCreate,
	async execute(message,client) {

        let parsedMessage = message.content.replace(/<@(.*?)>/,"").substring(1)
        let botResponse = '';
        let chatlog = '';
        let textModifier = '';
        let query = '';

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
            `SELECT response from mindsdb.astolfo_model
            WHERE chatlog = "${chatlog}"
            AND author_username = "${mysql.escape(message.author.username)}"
            AND text="${mysql.escape(parsedMessage)} ${mysql.escape(textModifier)}"`;
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

        if (message.author.bot) return false;

        if (message.content.includes("@here") || message.content.includes("@everyone")) return false;

        if (message.mentions.has(client.user.id) || getRandom(200)) {

            await message.channel.sendTyping();

            await message.channel.messages.fetch({ limit: 4 }).then(messages => {

                messages = Array.from(messages);
                messages.shift().reverse();
                messages = new Map([...messages].reverse());
                messages.forEach(message => chatlog = chatlog.concat('<' + message.author.username + '>: ' + message.cleanContent) +' ')
                                    
                })
                .catch(console.error);

            if (isMostlyEmojis(parsedMessage)){
                textModifier = '(respond back with only emojis)';
                chatlog = '';
            }

            constructQuery();
            
            console.log(query);
            await attemptQuery();
            message.reply(botResponse);
            
            function isMostlyEmojis(str) {
                const emojiRegex = /\p{Extended_Pictographic}/ug;
                const emojis = str.match(emojiRegex) || [];
                let splitter = new Grapheme();
                let test = emojis.length / splitter.splitGraphemes(str).length >= 0.5;
                return test;
            }
             
        }
        else if (getRandom(15)){
         
            textModifier = '(respond back with a single emoji only)';
            constructQuery();
            await attemptQuery();
            message.react(botResponse);
            
        }


	},
};

