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