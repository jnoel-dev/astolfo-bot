const { Events } = require('discord.js');
const MindsDB = require('mindsdb-js-sdk');
const { setTimeout } = require("timers/promises");
const Grapheme = require('grapheme-splitter');
const mysql = require('mysql');
const { Configuration, OpenAIApi } = require("openai");
const fs = require('fs');
const request = require('request');
const { readFile } = require('fs/promises')


const { MINDSDB_USERNAME, MINDSDB_PASSWORD, MINDSDB_MODEL, CONTEXT_DEPTH, OPENAI_API_KEY, LOWERCASE_WORDS, UPPERCASE_WORDS, TEXT_MODIFIERS } = require('../config.json');

module.exports = {
	name: Events.MessageCreate,
    memoryIndex: 0,
	async execute(message,forceResponse) {
        let parsedMessage = message.content.replace(/<@(.*?)>/,"");
        let botResponse = '';
        let chatlog = '';
        let textModifier = '';
        let query = '';
        let pastlog = '';
       
        this.memoryIndex = await countFileLines('./memories/memories.txt') + 1;

        async function countFileLines(filePath){
            return new Promise((resolve, reject) => {
            let lineCount = 0;
            fs.createReadStream(filePath)
              .on("data", (buffer) => {
                let idx = -1;
                lineCount--; // Because the loop will run once for idx=-1
                do {
                  idx = buffer.indexOf(10, idx+1);
                  lineCount++;
                } while (idx !== -1);
              }).on("end", () => {
                resolve(lineCount);
              }).on("error", reject);
            });
          };


      

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

            if (await isFileEmpty('./memories/names.txt') && await isFileEmpty('./memories/memories.txt')){
                pastlog = '(log is empty for now)';
            }
            else{
                pastlog = await readMemories('./memories/names.txt');
                pastlog = pastlog.concat(await readMemories('./memories/memories.txt'));
            }
          
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
            console.log(botResponse);
            
            if (botResponse.includes('Astolfo:')){
                botResponse = botResponse.replace(/Astolfo:/g,'');
            }
            try{
                if (botResponse.includes('###DALL-E###')){

                    textModifier = '';
                    parsedValues = botResponse.split('###DALL-E###');
                    botResponse = parsedValues[0];
                    
                    
                    const dalleResponse = await openai.createImage({
                        prompt: parsedValues[1],
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
                catchError(e,'...Probably sent a NSFW request...');
                return;
            }

            if (botResponse.includes('###LOG###')){
                let memory = botResponse.split('###LOG###')[1];

                if (pastlog == '(log is empty for now)'){
                    pastlog = '';
                }
                if(botResponse.includes('###NAME###')){
                   
                    botResponse = botResponse.replace('###NAME###','');
                    await writeToMemory('./memories/names.txt',memory,true,this.memoryIndex);
                }
                else{
                    await writeToMemory('./memories/memories.txt',memory,false,this.memoryIndex);
                }


                botResponse = botResponse.split('###LOG###')[0];
        

            }

            parseMentions();

            console.log(botResponse);
           
            message.reply(botResponse);
      
            
            
             
        }
        else if (getRandom(15)){

            chatlog = message.cleanContent;
            textModifier = '(respond back with a single emoji only, ensure that it is Discord compatible)';
            constructQuery();
            await attemptQuery(false);
            console.log(botResponse);
            try{
                message.react(botResponse);
            } catch(e){
                catchError(e)
            }
            
            
        }

        async function writeToMemory(filepath, memory, isName,index){
            
           
            return new Promise(async (resolve, reject) => {

                // data is the file contents as a single unified string
                // .split('\n') splits it at each new-line character and all splits are aggregated into an array (i.e. turns it into an array of lines)
                // .slice(1) returns a view into that array starting at the second entry from the front (i.e. the first element, but slice is zero-indexed so the "first" is really the "second")
                // .join() takes that array and re-concatenates it into a string
                if (isName){

                    resolve(fs.appendFile(filepath, `${memory}\n`, 'utf-8', err => {if (err){catchError(err)}}));

                }
                else{

                    var stringBuffer = await readMemories(filepath);
                    stringBuffer = stringBuffer.split('\n');
                    stringBuffer[index-1] = `${memory}\n`;
                    stringBuffer = stringBuffer.join('\n');
                    resolve(fs.writeFile(filepath, stringBuffer, function(err, data) { if (err) {catchError(err)} }));
                }

          
        });
        }

        async function isFileEmpty(fileName, ignoreWhitespace=true) {
            return new Promise((resolve, reject) => {
                fs.readFile(fileName, (err, data) => {
                    if( err ) {
                        reject(err);
                        return;
                    }
        
                    resolve((!ignoreWhitespace && data.length == 0) || (ignoreWhitespace && !!String(data).match(/^\s*$/)));
                });
            });
        }

        function parseMentions(){
            if (botResponse.includes('@')){

                let mentionedUsers = botResponse.match(/(@[^\s!]+)/g);
                let mentionedUsersClean = botResponse.match(/(@[^\s!]+)/g);
                for (user in mentionedUsers){
                    mentionedUsers[user] = mentionedUsers[user].substring(1,mentionedUsers[user].length-2);
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
        
        async function readMemories(filepath){
            return(await readFile(filepath, 'utf8'));
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
            //console.log(query);
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
            textModifier = textModifier.replace(/"/g,'');
            pastlog = pastlog.replace(/"/g,'');
            query = 
            `SELECT response from ${MINDSDB_MODEL}
            WHERE chatlog = "${chatlog} ${textModifier}"
            AND pastlog = "${pastlog}"`;
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

        function catchError(error,errMes = ''){
            message.reply({ content: `You just crashed me 😢 It hurts... 😞 ${errMes}`, ephemeral: false });
            console.log(error);
            return;
        }

	},
};
