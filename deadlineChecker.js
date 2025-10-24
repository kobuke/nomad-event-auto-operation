
import { Client, GatewayIntentBits } from 'discord.js';
import { getSheetData, updateCell } from './googleSheetHandler.js';
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
    const postedColumnIndex = header.indexOf('〆'); 
    const remind1DateColumnIndex = header.indexOf('Remind1 Date');
    const r1ColumnIndex = header.indexOf('R1');
    const remind2DateColumnIndex = header.indexOf('Remind2 Date');
    const r2ColumnIndex = header.indexOf('R2');

    if (eventNameColumnIndex === -1 || threadIdColumnIndex === -1 || deadlineColumnIndex === -1 || postedColumnIndex === -1 || remind1DateColumnIndex === -1 || r1ColumnIndex === -1 || remind2DateColumnIndex === -1 || r2ColumnIndex === -1) {
      console.error('❌ Missing required columns in Event Setting sheet.');
      client.destroy();
      return;
    }

    const now = new Date();

    for (let i = 1; i < events.length; i++) { // Iterate from the second row (index 1)
      const event = events[i];
      const eventName = event[eventNameColumnIndex];
      const threadId = event[threadIdColumnIndex];
      const deadline = event[deadlineColumnIndex];
      const posted = event[postedColumnIndex];
      const remind1Date = event[remind1DateColumnIndex];
      const r1Status = event[r1ColumnIndex];
      const remind2Date = event[remind2DateColumnIndex];
      const r2Status = event[r2ColumnIndex];

      console.log(`[DEBUG] Processing event: ${eventName}`);
      console.log(`[DEBUG] Raw Remind1 Date: ${remind1Date}, R1 Status: ${r1Status}`);
      console.log(`[DEBUG] Raw Remind2 Date: ${remind2Date}, R2 Status: ${r2Status}`);
      console.log(`[DEBUG] Current time: ${now}`);

      // Deadline check
      if (deadline && deadline !== '-' && posted !== '✅') {
        const deadlineDate = new Date(`${now.getFullYear()}/${deadline} GMT+0800`);
        console.log(`[DEBUG] Parsed Deadline Date: ${deadlineDate}, Comparison (now > deadlineDate): ${now > deadlineDate}`);

        if (now > deadlineDate) {
          try {
            const channel = await client.channels.fetch(threadId);
            if (channel) {
              await channel.send(
                `📢 **Recruitment for ${eventName} has officially closed!** 📢\n` +
                `Thank you to everyone who showed interest and signed up! We're so excited for the event! ✨`
              );
              console.log(`✅ Sent deadline message for event: ${eventName}`);
              await updateCell('Event Setting', i, postedColumnIndex, '✅');
            } else {
              console.error(`❌ Discord thread not found: ${threadId}`);
            }
          } catch (discordError) {
            console.error(`❌ Failed to send deadline message for event ${eventName}:`, discordError);
          }
        }
      }

      // Reminder 1 check
      if (remind1Date && remind1Date !== '-' && r1Status !== '✅') {
        const remind1DateTime = new Date(`${now.getFullYear()}/${remind1Date} GMT+0800`);
        console.log(`[DEBUG] Parsed Remind1 Date: ${remind1DateTime}, Comparison (now > remind1DateTime): ${now > remind1DateTime}`);

        if (now > remind1DateTime) {
          try {
            const channel = await client.channels.fetch(threadId);
            if (channel) {
              await channel.send(
                `🔔 **Friendly Reminder: ${eventName} is coming up soon!** 🔔\n` +
                `Just a quick heads-up about ${eventName}. Don't miss out! ✨`
              );
              console.log(`✅ Sent Reminder 1 message for event: ${eventName}`);
              await updateCell('Event Setting', i, r1ColumnIndex, '✅');
            } else {
              console.error(`❌ Discord thread not found: ${threadId}`);
            }
          } catch (discordError) {
            console.error(`❌ Failed to send Reminder 1 message for event ${eventName}:`, discordError);
          }
        }
      }

      // Reminder 2 check
      if (remind2Date && remind2Date !== '-' && r2Status !== '✅') {
        const remind2DateTime = new Date(`${now.getFullYear()}/${remind2Date} GMT+0800`);
        console.log(`[DEBUG] Parsed Remind2 Date: ${remind2DateTime}, Comparison (now > remind2DateTime): ${now > remind2DateTime}`);

        if (now > remind2DateTime) {
          try {
            const channel = await client.channels.fetch(threadId);
            if (channel) {
              await channel.send(
                `⏰ **Last Chance Reminder: ${eventName} is almost here!** ⏰\n` +
                `This is your final reminder for ${eventName}. Get ready! 🚀`
              );
              console.log(`✅ Sent Reminder 2 message for event: ${eventName}`);
              await updateCell('Event Setting', i, r2ColumnIndex, '✅');
            } else {
              console.error(`❌ Discord thread not found: ${threadId}`);
            }
          }
          catch (discordError) {
              console.error(`❌ Failed to send Reminder 2 message for event ${eventName}:`, discordError);
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
