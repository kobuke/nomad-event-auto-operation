
import { Client, GatewayIntentBits } from 'discord.js';
import { getSheetData } from './googleSheetHandler.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  try {
    const events = await getSheetData('Event Setting');
    const header = events[0];
    const eventNameColumnIndex = header.indexOf('Event Name');
    const threadIdColumnIndex = header.indexOf('Thread ID');
    const deadlineColumnIndex = header.indexOf('〆 Date');

    if (eventNameColumnIndex === -1 || threadIdColumnIndex === -1 || deadlineColumnIndex === -1) {
      console.error('❌ Missing required columns in Event Setting sheet.');
      client.destroy();
      return;
    }

    const now = new Date();

    for (const event of events.slice(1)) { // Skip header row
      const eventName = event[eventNameColumnIndex];
      const threadId = event[threadIdColumnIndex];
      const deadline = event[deadlineColumnIndex];

      if (deadline && deadline !== '-') {
        const deadlineDate = new Date(deadline);

        if (now > deadlineDate) {
          try {
            const channel = await client.channels.fetch(threadId);
            if (channel) {
              await channel.send(
                `📢 **Recruitment for ${eventName} has officially closed!** 📢\n` +
                `Thank you to everyone who showed interest and signed up! We're so excited for the event! ✨`
              );
              console.log(`✅ Sent deadline message for event: ${eventName}`);
            } else {
              console.error(`❌ Discord thread not found: ${threadId}`);
            }
          } catch (discordError) {
            console.error(`❌ Failed to send deadline message for event ${eventName}:`, discordError);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to check deadlines:', error);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
