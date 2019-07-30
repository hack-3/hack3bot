/**
 * norabot: a multi-purpose Discord bot
 *
 * Copyright (C) 2018 by nitroignika
 *
 * This file is part of norabot.
 *
 * norabot application is free software: you can redistribute
 * it and/or modify it under the terms of the GNU Affero General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * norabot application is distributed in the hope that it will
 * be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
 * of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU A General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with norabot.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @license AGPL-3.0+ <http://spdx.org/licenses/AGPL-3.0+>
 */

const fs = require('fs');
const Discord = require('discord.js');
const {
    prefix,
    token
} = require('./config.json');
const commandConfig = require('./commands.json');

const client = new Discord.Client({
    sync: true
});

client.prefixes = new Discord.Collection();
const commandFolders = fs.readdirSync('./commands');
for (const folder of commandFolders) {
    const commands = new Discord.Collection();
    const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        commands.set(command.name, command);
    }
    client.prefixes.set(commandConfig[folder].prefix, commands);
    commands.set('name', commandConfig[folder].prefix);
}

const cooldowns = new Discord.Collection();

client.on('ready', () => {
    console.log('Ready!');
});

client.on("guildMemberAdd", (member) => {
    let embed = new Discord.RichEmbed()
        .setColor('#8e86da')
        .setTitle("**Welcome to Hack3's Discord Server!**")
        .setDescription("Here's a few things you need to keep in mind during your stay here.")
        .setThumbnail('https://hack3.co/static/Hack3_Bare-77331f7f4ed24baf62b524164f22d1dc.png')
        .addField("Rules", "Before participating on the server, please be sure to read up on the rules in the `#rules` channel.")
        .addField("FAQ", "If you have any questions, please check the `#faq` channel before you do to avoid redundant questions.")
        .addField("Pre-Registering", "Please make sure you have pre-registered [here](https://hack3boston.typeform.com/to/OMh8VL). This does not mean you are required to go, but it allows us to better cater the event and provide updates faster.");

    member.send(embed);
});

client.on('message', message => {
    if (message.author.bot) return;
    let commandType;
    for (const prefixCollection of client.prefixes) {
        if (message.content.startsWith(prefixCollection[1].get('name') + prefix)) {
            commandType = prefixCollection[1].get('name');
        }
    }
    if (!commandType) return;

    const args = message.content.slice(commandType.length + prefix.length).split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixes.get(commandType).get(commandName) ||
        client.prefixes.get(commandType).find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    if (command.guildOnly && message.channel.type !== 'text') {
        return message.reply("Sorry, but you can only use that command on servers!")
    }

    if (command.adminReq && !message.member.hasPermission("ADMINISTRATOR")) {
        return message.reply("You don't have the adequate permissions!");
    }

    if (command.args && !args.length) {
        let reply = `You didn't provide the necessary arguments, ${message.author}! `;

        if (command.usage) {
            reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
        }

        return message.channel.send(reply)
    }

    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown) * 1000;

    if (!timestamps.has(message.author.id)) {
        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
    } else {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`Please wait ${timeLeft.toFixed(1)} before trying again`);
        }

        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
    }

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('Sorry, something went wrong! If the issue persists, please contact a developer').then(msg => {
            if (message.channel.type != 'dm') {
                msg.delete(8000)
            }
        }).catch(err => {
            console.log(err);
        });
        message.delete(8000).then(msg => {
            if (message.channel.type != 'dm') {
                msg.delete(8000);
            }
        });
    }
});

client.login(process.env.BOT_TOKEN);
process.on('unhandledRejection', console.error);