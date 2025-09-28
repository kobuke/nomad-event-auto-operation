
import { Client, GatewayIntentBits } from 'discord.js';
import { getSheetData, appendToSheet } from './googleSheetHandler.js';
import dotenv from 'dotenv';

dotenv.config();


const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  try {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    const channel = await guild.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    const members = await guild.members.fetch();

    const channelMembers = members.filter(member => channel.permissionsFor(member).has('ViewChannel'));

    const users = channelMembers.map(member => ({
      userName: member.user.username,
      userId: member.user.id,
    }));

    const existingUsers = await getSheetData('Users');
    const existingUserIds = existingUsers.map(row => row[1]);

    const newUsers = users.filter(user => !existingUserIds.includes(user.userId));

    if (newUsers.length > 0) {
      const values = newUsers.map(user => [user.userName, user.userId]);
      await appendToSheet('Users', values);
      console.log(`✅ Successfully exported ${newUsers.length} new users to Google Sheets.`);
    } else {
      console.log('No new users to export.');
    }
  } catch (error) {
    console.error('❌ Failed to export users:', error);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
