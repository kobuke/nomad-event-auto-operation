import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

// --- Configuration ---
// IMPORTANT: Replace with your Discord Guild (Server) ID
const GUILD_ID = process.env.DISCORD_GUILD_ID; 
// --- End Configuration ---

if (!GUILD_ID) {
  console.error('❌ DISCORD_GUILD_ID is not set in your .env file. Please set it to the ID of the Discord server you want to export users from.');
  // Do not exit here, as it might be imported by other scripts that don't need GUILD_ID immediately
}

export const exportUsers = async (client, guildId) => {
  console.log('🚀 Starting user export...');

  if (!guildId) {
    console.error('❌ Guild ID is not provided for user export.');
    return;
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      console.error(`❌ Guild with ID ${guildId} not found.`);
      return;
    }

    console.log(`✅ Fetched guild: ${guild.name}`);

    const members = await guild.members.fetch();

    console.log(`Found ${members.size} members in ${guild.name}.`);
    console.log('\n--- Discord User Export ---');
    console.log('User ID,User Name,Display Name'); // CSV Header

    members.forEach(member => {
      const userId = member.user.id;
      const userName = member.user.username;
      const displayName = member.nickname || member.user.displayName || member.user.username;
      console.log(`${userId},${userName},${displayName}`);
    });

    console.log('--- Export Complete ---');

  } catch (error) {
    console.error('❌ An error occurred during user export:', error);
  }
};

// This block allows the script to be run directly for local testing
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await exportUsers(client, GUILD_ID);
    client.destroy(); // Destroy client after export
  });

  client.login(process.env.DISCORD_BOT_TOKEN);
}