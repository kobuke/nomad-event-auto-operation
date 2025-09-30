
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { getSheetData, updateSheet, getEventDetailsFromSheet, updatePaymentStatusInSheet } from './googleSheetHandler.js';
import dotenv from 'dotenv';
import stripe from 'stripe';

dotenv.config();

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
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

    // Capacity management
    const eventSettingHeader = events[0];
    const maxCapColumnIndex = eventSettingHeader.indexOf('Max Cap');
    const mcColumnIndex = eventSettingHeader.indexOf('MC');

    if (maxCapColumnIndex === -1 || mcColumnIndex === -1) {
      console.error('❌ Missing Max Cap or MC column in Event Setting sheet.');
      return;
    }

    const eventRowIndex = events.findIndex(row => row[0] === eventName);
    if (eventRowIndex === -1) return;

    const maxCap = parseInt(event[maxCapColumnIndex], 10);
    const mcStatus = event[mcColumnIndex];

    const currentParticipants = rsvpData.slice(1).filter(row => row[eventIndex]).length;

    const threadId = event[1]; // Assuming Thread ID is in Column B
    const channel = await client.channels.fetch(threadId);

    if (maxCap > 0) {
      if (currentParticipants >= maxCap && mcStatus !== '✅') {
        if (channel) {
          await channel.send(
            `🎉 **Heads up! ${eventName} has reached its maximum capacity of ${maxCap} participants!** 🎉\n` +
            `We're so excited by the overwhelming interest! If a spot opens up, we'll let you know! ✨`
          );
          console.log(`✅ Sent capacity reached message for event: ${eventName}`);
          await updateCell('Event Setting', eventRowIndex, mcColumnIndex, '✅');
        }
      } else if (currentParticipants < maxCap && mcStatus === '✅') {
        if (channel) {
          await channel.send(
            `🔔 **Good news! A spot has opened up for ${eventName}!** 🔔\n` +
            `There's still a chance to join! Don't miss out! 🚀`
          );
          console.log(`✅ Sent capacity available message for event: ${eventName}`);
          await updateCell('Event Setting', eventRowIndex, mcColumnIndex, '');
        }
      }
    }

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
