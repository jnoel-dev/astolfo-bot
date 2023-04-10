const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const MindsDB = require('mindsdb-js-sdk');
const { DISCORD_TOKEN, MINDSDB_USERNAME, MINDSDB_PASSWORD } = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent] });

client.commands = new Collection();

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

async function mindsDBConnect(){
	try {
		await MindsDB.default.connect({
			user: MINDSDB_USERNAME,
			password: MINDSDB_PASSWORD
		});
		} catch(error) {
		// Failed to authenticate.
		catchError(error)
		
		}
}

mindsDBConnect();

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args,client));
	} else {
		client.on(event.name, (...args) => event.execute(...args,client));
	}
}

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}


client.login(DISCORD_TOKEN);

