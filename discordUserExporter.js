
import { updateSheet } from './googleSheetHandler.js';
import dotenv from 'dotenv';

dotenv.config();

export const exportUsers = async (client) => {
  try {
    console.log('Exporting all users to sheet...');
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    // Fetch all members from the guild, which might take time on large guilds
    const members = await guild.members.fetch();
    console.log(`Found ${members.size} members in total.`);

    const channel = await guild.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    const channelMembers = members.filter(member => {
      // Ignore bots
      if (member.user.bot) return false;
      // Check for view permissions
      return channel.permissionsFor(member).has('ViewChannel');
    });
    console.log(`Found ${channelMembers.size} non-bot members with permission to view the channel.`);

    // Sort members by join date (oldest first)
    const sortedMembers = Array.from(channelMembers.values()).sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
    console.log('Sorted members by join date.');

    const usersToExport = sortedMembers.map(member => [member.user.username, member.user.id]);

    // Add header row
    const usersSheetData = [['userName', 'userId'], ...usersToExport];

    // Overwrite the sheet with the fresh user list
    await updateSheet('Users', usersSheetData);
    console.log(`✅ Successfully exported ${usersToExport.length} users to the 'Users' sheet.`);

  } catch (error) {
    console.error('❌ Failed to export users:', error);
    // Do not destroy the client here, as it's managed by the listener
  }
};
