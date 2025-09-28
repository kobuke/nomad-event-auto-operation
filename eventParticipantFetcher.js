
import { Client, GatewayIntentBits } from 'discord.js';
import { getSheetData } from './googleSheetHandler.js';


const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
});

export const getEventParticipants = async () => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  });

  const eventParticipants = {};

  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log(`Logged in as ${client.user.tag}!`);

      try {
        const events = await getSheetData('Event Setting');

        for (const event of events.slice(1)) { // Skip header row
          const [eventName, threadId, messageId, stamp] = event;

          try {
            const channel = await client.channels.fetch(threadId);
            const message = await channel.messages.fetch(messageId);
            const reactions = message.reactions.cache.get(stamp);

            if (reactions) {
              const users = await reactions.users.fetch();
              eventParticipants[eventName] = users.map(user => ({ userName: user.username, userId: user.id }));
            } else {
              eventParticipants[eventName] = [];
            }
          } catch (error) {
            console.error(`❌ Failed to process event ${eventName}:`, error);
            eventParticipants[eventName] = [];
          }
        }
        resolve(eventParticipants);
      } catch (error) {
        console.error('❌ Failed to fetch events from Google Sheets:', error);
        reject(error);
      } finally {
        client.destroy();
      }
    });

    client.login(process.env.DISCORD_BOT_TOKEN);
  });
};
