import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// --- Configuration ---
// IMPORTANT: Replace with your Discord Guild (Server) ID
const GUILD_ID = process.env.DISCORD_GUILD_ID; 
// --- End Configuration ---

if (!GUILD_ID) {
  console.error('❌ DISCORD_GUILD_ID is not set in your .env file. Please set it to the ID of the Discord server you want to export users from.');
  process.exit(1);
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error(`❌ Guild with ID ${GUILD_ID} not found.`);
      client.destroy();
      return;
    }

    console.log(`✅ Fetched guild: ${guild.name}`);

    // Fetch all members, ensuring all are fetched even if there are many
    const members = await guild.members.fetch();

    console.log(`Found ${members.size} members in ${guild.name}.`);
    console.log('\n--- Discord User Export ---');
    console.log('User ID,User Name,Display Name'); // CSV Header

    members.forEach(member => {
      const userId = member.user.id;
      const userName = member.user.username;
      const displayName = member.nickname || member.user.displayName || member.user.username; // Prioritize nickname, then display name, then username
      console.log(`${userId},${userName},${displayName}`);
    });

    console.log('--- Export Complete ---');

  } catch (error) {
    console.error('❌ An error occurred during user export:', error);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);