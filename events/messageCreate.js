const { Events } = require("discord.js");
const MindsDB = require("mindsdb-js-sdk");
const { setTimeout } = require("timers/promises");
const Grapheme = require("grapheme-splitter");
const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");
const request = require("request");
const { readFile } = require("fs/promises");

const {
  MINDSDB_USERNAME,
  MINDSDB_PASSWORD,
  MINDSDB_MODEL,
  CONTEXT_DEPTH,
  OPENAI_API_KEY,
  LOWERCASE_WORDS,
  UPPERCASE_WORDS,
  MEMORY_DEPTH,
  MEMORY_LOG_PATH,
  NAME_LOG_PATH,
} = require("../config.json");
const {
  USER_RESPONSE_MODIFIERS,
  EMOJI_RESPONSE,
  EMPTY_LOG,
  REACT_RESPONSE,
} = require("../text_modifiers.json");
const {
  LOG_RESPONSE,
  NAME_RESPONSE,
  DALLE_RESPONSE,
} = require("../response_identifiers.json");

module.exports = {
  name: Events.MessageCreate,
  memoryIndex: -1,
  async execute(message, forceResponse) {
    let parsedMessage = message.content.replace(/<@(.*?)>/, "");
    let botResponse = "";
    let chatlog = "";
    let textModifier = "";
    let query = "";
    let pastlog = "";

    for (word in LOWERCASE_WORDS) {
      if (
        new RegExp(LOWERCASE_WORDS[word] + "[!.,\\s]", "g").test(
          message.cleanContent.concat(" ")
        )
      ) {
        await message.channel.sendTyping();
        await setTimeout(2000);
        message.channel.send(
          "*" +
            LOWERCASE_WORDS[word].charAt(0).toLowerCase() +
            LOWERCASE_WORDS[word].slice(1)
        );
      }
    }

    for (word in UPPERCASE_WORDS) {
      if (
        new RegExp(UPPERCASE_WORDS[word] + "[!.,\\s]", "g").test(
          message.cleanContent.concat(" ")
        )
      ) {
        await message.channel.sendTyping();
        await setTimeout(2000);
        message.channel.send(
          "*" +
            UPPERCASE_WORDS[word].charAt(0).toUpperCase() +
            UPPERCASE_WORDS[word].slice(1)
        );
      }
    }

    if (message.author.bot) return false;

    if (
      message.content.includes("@here") ||
      message.content.includes("@everyone")
    )
      return false;

    if (
      message.mentions.has(message.client.user.id) ||
      getRandom(200) ||
      forceResponse
    ) {
      if (this.memoryIndex == -1) {
        this.memoryIndex = await countFileLines(MEMORY_LOG_PATH);
      }
      if (this.memoryIndex > MEMORY_DEPTH - 1) {
        this.memoryIndex = 0;
      }

      await message.channel.messages
        .fetch({ limit: CONTEXT_DEPTH })
        .then((messages) => {
          messages = Array.from(messages);
          messages = new Map([...messages].reverse());

          let attachmentUrl = "";

          for (let [key, value] of messages) {
            if (value.attachments.size > 0) {
              let test = value.attachments.entries().next().value[1].url;
              if (value.attachments.entries().next().value[1].url != null) {
                attachmentUrl = value.attachments.entries().next().value[1].url;
              }
            }

            chatlog = chatlog.concat(
              `${value.author.username}:${value.cleanContent} ${attachmentUrl}\n`
            );
            attachmentUrl = "";
          }
        })
        .catch(console.error);

      if (
        (await isFileEmpty(NAME_LOG_PATH)) &&
        (await isFileEmpty(MEMORY_LOG_PATH))
      ) {
        pastlog = EMPTY_LOG;
      } else {
        pastlog = await readMemories(NAME_LOG_PATH);
        pastlog = pastlog.concat(await readMemories(MEMORY_LOG_PATH));
      }

      const configuration = new Configuration({
        apiKey: OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);

      if (parsedMessage == " 🫂") {
        await setTimeout(2000);
        message.reply(" 🫂");
        return;
      }

      if (isMostlyEmojis(parsedMessage)) {
        chatlog = message.cleanContent;
        textModifier = EMOJI_RESPONSE;
      } else if (getRandom(200)) {
        textModifier =
          USER_RESPONSE_MODIFIERS[
            Math.floor(Math.random() * (USER_RESPONSE_MODIFIERS.length - 1))
          ];
      }

      constructQuery();

      await attemptQuery(true);
      console.log(botResponse);

      if (botResponse.includes("Astolfo:")) {
        botResponse = botResponse.replace(/Astolfo:/g, "");
      }
      try {
        if (botResponse.includes(DALLE_RESPONSE)) {
          textModifier = "";
          parsedValues = botResponse.split(DALLE_RESPONSE);
          botResponse = parsedValues[0];

          await message.channel.sendTyping();
          const dalleResponse = await openai.createImage({
            prompt: parsedValues[1],
            n: 1,
            size: "512x512",
          });

          let download = async function (uri, filename, callback) {
            request.head(uri, function (err, res, body) {
              console.log("content-type:", res.headers["content-type"]);
              console.log("content-length:", res.headers["content-length"]);

              request(uri)
                .pipe(fs.createWriteStream(filename))
                .on("close", callback);
            });
          };

          await download(
            dalleResponse.data.data[0].url,
            "./images/image.png",
            async function () {
              console.log("done");
              parseMentions();
              await message.reply(botResponse);
              await message.reply({
                files: [
                  {
                    attachment: "./images/image.png",
                  },
                ],
              });
            }
          );
          return;
        }
      } catch (e) {
        catchError(e, "...Probably sent a NSFW request...");
        return;
      }

      if (botResponse.includes(LOG_RESPONSE)) {
        let memory = botResponse.split(LOG_RESPONSE)[1];

        if (pastlog == EMPTY_LOG) {
          pastlog = "";
        }
        if (botResponse.includes(NAME_RESPONSE)) {
          botResponse = botResponse.replace(NAME_RESPONSE, "");
          await writeToMemory(NAME_LOG_PATH, memory, true, this.memoryIndex);
        } else {
          await writeToMemory(MEMORY_LOG_PATH, memory, false, this.memoryIndex);
          this.memoryIndex++;
        }

        botResponse = botResponse.split(LOG_RESPONSE)[0];
      }

      parseMentions();

      console.log(botResponse);

      message.reply(botResponse);
    } else if (getRandom(15)) {
      chatlog = message.cleanContent;
      textModifier = REACT_RESPONSE;
      constructQuery();
      await attemptQuery(false);
      console.log(botResponse);
      try {
        message.react(botResponse);
      } catch (e) {
        catchError(e);
      }
    }

    async function writeToMemory(filepath, memory, isName, index) {
      return new Promise(async (resolve, reject) => {
        if (isName) {
          resolve(
            fs.appendFile(filepath, `${memory}\n`, "utf-8", (err) => {
              if (err) {
                catchError(err);
              }
            })
          );
        } else {
          var stringBuffer = await readMemories(filepath);
          stringBuffer = stringBuffer.split("\n");
          if (stringBuffer[index] == "") {
            stringBuffer[index] = `${memory}\n`;
          } else {
            stringBuffer[index] = `${memory}`;
          }

          stringBuffer = stringBuffer.join("\n");
          resolve(
            fs.writeFile(filepath, stringBuffer, function (err, data) {
              if (err) {
                catchError(err);
              }
            })
          );
        }
      });
    }

    async function isFileEmpty(fileName, ignoreWhitespace = true) {
      return new Promise((resolve, reject) => {
        fs.readFile(fileName, (err, data) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(
            (!ignoreWhitespace && data.length == 0) ||
              (ignoreWhitespace && !!String(data).match(/^\s*$/))
          );
        });
      });
    }

    function parseMentions() {
      if (botResponse.includes("@")) {
        let mentionedUsers = botResponse.match(/(@[^\s!]+)/g);
        let mentionedUsersClean = botResponse.match(/(@[^\s!]+)/g);
        for (user in mentionedUsers) {
          mentionedUsers[user] = mentionedUsers[user].substring(
            1,
            mentionedUsers[user].length - 2
          );
          mentionedUsersClean[user] = mentionedUsersClean[user].replace(
            "@",
            ""
          );
          let userCache = Array.from(message.client.users.cache);
          for (index in userCache) {
            if (userCache[index][1].username.includes(mentionedUsers[user])) {
              botResponse = botResponse.replace(
                `@${mentionedUsersClean[user]}`,
                `<@${userCache[index][1].id}>`
              );
            }
          }
        }
      }
    }

    async function readMemories(filepath) {
      return await readFile(filepath, "utf8");
    }

    function isMostlyEmojis(str) {
      const emojiRegex = /\p{Extended_Pictographic}/gu;
      const emojis = str.match(emojiRegex) || [];
      let splitter = new Grapheme();
      let test = emojis.length / splitter.splitGraphemes(str).length >= 0.5;
      return test;
    }

    async function mindsDBConnect() {
      try {
        await MindsDB.default.connect({
          user: MINDSDB_USERNAME,
          password: MINDSDB_PASSWORD,
        });
        await attemptQuery(false);
      } catch (error) {
        // Failed to authenticate.
        catchError(error);
      }
    }

    async function attemptQuery(sendTyping) {
      //console.log(query);
      try {
        if (sendTyping) {
          await message.channel.sendTyping();
        }
        const queryResult = await MindsDB.default.SQL.runQuery(query);

        if (queryResult.error_message == null) {
          botResponse = queryResult.rows[0].response;
        } else if (queryResult.error_message.includes("NoneType")) {
          message.client.user.setStatus("dnd");
          await setTimeout(6000);
          message.client.user.setStatus("online");
          await attemptQuery(sendTyping);
        }
      } catch (error) {
        mindsDBConnect();
      }
    }

    function constructQuery() {
      chatlog = chatlog.replace(/"/g, "");
      textModifier = textModifier.replace(/"/g, "");
      pastlog = pastlog.replace(/"/g, "");
      query = `SELECT response from ${MINDSDB_MODEL}
            WHERE chatlog = "${chatlog} ${textModifier}"
            AND pastlog = "${pastlog}"`;
      query = query.replace(/'/g, "");
    }

    function getRandom(chance) {
      var num = Math.floor(Math.random() * chance);
      if (num === 1) {
        return true;
      } else {
        return false;
      }
    }

    function catchError(error, errMes = "") {
      message.reply({
        content: `You just crashed me 😢 It hurts... 😞 ${errMes}`,
        ephemeral: false,
      });
      console.log(error);
      return;
    }

    async function countFileLines(filePath) {
      return new Promise((resolve, reject) => {
        let lineCount = 0;
        fs.createReadStream(filePath)
          .on("data", (buffer) => {
            let idx = -1;
            lineCount--; 
            do {
              idx = buffer.indexOf(10, idx + 1);
              lineCount++;
            } while (idx !== -1);
          })
          .on("end", () => {
            resolve(lineCount);
          })
          .on("error", reject);
      });
    }
  },
};
