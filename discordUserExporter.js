
import { Client, GatewayIntentBits } from 'discord.js';
import { updateSheet } from './googleSheetHandler.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  try {
    console.log('Fetching all members from guild...');
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    const members = await guild.members.fetch();
    console.log(`Found ${members.size} members in total.`);

    const channel = await guild.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    const channelMembers = members.filter(member => {
      // Ignore bots
      if (member.user.bot) return false;
      // Check for view permissions
      return channel.permissionsFor(member).has('ViewChannel');
    });
    console.log(`Found ${channelMembers.size} members with permission to view the channel.`);

    const usersToExport = channelMembers.map(member => [member.user.username, member.user.id]);

    // Add header row
    const usersSheetData = [['userName', 'userId'], ...usersToExport];

    // Overwrite the sheet with the fresh user list
    await updateSheet('Users', usersSheetData);
    console.log(`✅ Successfully exported ${usersToExport.length} users to the 'Users' sheet.`);

  } catch (error) {
    console.error('❌ Failed to export users:', error);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
