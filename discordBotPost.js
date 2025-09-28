
import { Client, IntentsBitField } from 'discord.js';
import { getEventsForTodayPost } from './notionHandler.js';


const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessageReactions,
  ],
});

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const events = await getEventsForTodayPost();
  if (!events || events.length === 0) {
    console.log('📭 No poll events found for today.');
    client.destroy();
    return;
  }

  for (const event of events) {
    const title = event.properties['イベント名'].title[0].plain_text;
    const eventId = event.id;
    const message = await client.channels.cache
      .get(process.env.DISCORD_CHANNEL_ID)
      .send(
        `📢 ${title} | ${eventId}\n\nリアクションで出欠を教えてください！\n✅ 参加する\n❓ 興味あり\n❌ 参加しない`
      );

    for (const emoji of ['✅', '❓', '❌']) {
      await message.react(emoji);
    }
  }

  setTimeout(() => {
    client.destroy();
  }, 1000);
});

client.login(process.env.DISCORD_BOT_TOKEN);
