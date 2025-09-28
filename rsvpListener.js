
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { getSheetData, updateSheet } from './googleSheetHandler.js';


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const updateRsvpSheet = async (reaction, user, add) => {
  try {
    const events = await getSheetData('Event Setting');
    const event = events.find(row => row[2] === reaction.message.id && row[3] === reaction.emoji.name);

    if (!event) return;

    const eventName = event[0];
    const rsvpData = await getSheetData('RSVP');
    const userNames = rsvpData.map(row => row[0]);
    const eventNames = rsvpData[0];

    const userIndex = userNames.indexOf(user.username);
    const eventIndex = eventNames.indexOf(eventName);

    if (userIndex === -1 || eventIndex === -1) return;

    const newRsvpData = rsvpData.map(row => [...row]);

    if (add) {
      if (!newRsvpData[userIndex][eventIndex]) {
        newRsvpData[userIndex][eventIndex] = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      }
    } else {
      newRsvpData[userIndex][eventIndex] = '';
    }

    await updateSheet('RSVP', newRsvpData);
    console.log(`✅ RSVP sheet updated for ${user.username} - Event: ${eventName}`);

  } catch (error) {
    console.error('❌ Failed to update RSVP sheet:', error);
  }
};

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  await updateRsvpSheet(reaction, user, true);
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  await updateRsvpSheet(reaction, user, false);
});

client.login(process.env.DISCORD_BOT_TOKEN);
