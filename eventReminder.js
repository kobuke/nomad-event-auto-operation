import { Client, IntentsBitField } from 'discord.js';
import { getEventsForTomorrow, getParticipantsForEvent } from './notionHandler.js';


const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const events = await getEventsForTomorrow();

  if (!events || events.length === 0) {
    console.log('🗓️ No events scheduled for tomorrow.');
    client.destroy();
    return;
  }

  for (const event of events) {
    const eventId = event.id;
    const eventName = event.properties['イベント名']?.title[0]?.plain_text || 'Unknown Event';
    const eventDetails = event.properties['イベント詳細']?.rich_text[0]?.plain_text || '詳細なし';
    const eventLocation = event.properties['開催場所']?.rich_text[0]?.plain_text || '場所未定';

    const participants = await getParticipantsForEvent(eventId);
    const mentions = participants.map(id => `<@${id}>`).join(' ');

    const reminderMessage = `
📢 **イベントリマインダー: ${eventName}**

🗓️ **開催日時**: 明日
📍 **開催場所**: ${eventLocation}

📝 **イベント詳細**:
${eventDetails}

${mentions}

上記イベントにご参加予定の皆様、明日の開催です！お忘れなく！
`;

    try {
      const channel = await client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
      if (channel) {
        await channel.send(reminderMessage);
        console.log(`✅ Sent reminder for event: ${eventName}`);
      } else {
        console.error(`❌ Discord channel not found: ${process.env.DISCORD_CHANNEL_ID}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send reminder for event ${eventName}:`, error);
    }
  }

  setTimeout(() => {
    client.destroy();
  }, 1000);
});

client.login(process.env.DISCORD_BOT_TOKEN);
