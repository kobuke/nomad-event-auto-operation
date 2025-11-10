
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { getSheetData, updateSheet, getEventDetailsFromSheet, updatePaymentStatusInSheet, updateCell } from './googleSheetHandler.js';
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
    const event = events.find(row => row[2] === reaction.message.id);
    console.log(`[DEBUG] Found event based on message ID: ${event ? event[0] : 'None'}`);

    if (!event) return;

    const customEmoji = event[3]; // Column D for the reaction emoji
    console.log(`[DEBUG] Custom emoji for event: ${customEmoji}`);

    const eventName = event[0];
    const rsvpData = await getSheetData('RSVP');
    const userNames = rsvpData.map(row => row[0]);
    const eventNames = rsvpData[0];
    console.log("rsvpData: " + rsvpData);

    const userIndex = userNames.indexOf(user.username);
    const eventIndex = eventNames.indexOf(eventName);
    console.log(`[DEBUG] User: ${user.username}, User Index: ${userIndex}, Event: ${eventName}, Event Index: ${eventIndex}`);

    if (userIndex === -1 || eventIndex === -1) return;

    const newRsvpData = rsvpData.map(row => [...row]);
    console.log("newRsvpData:" + newRsvpData);

    if (add) {
      if (!newRsvpData[userIndex][eventIndex]) {
        newRsvpData[userIndex][eventIndex] = new Date().toISOString();
      }

      // Stripe integration
      console.log(`[DEBUG] Reaction emoji: ${reaction.emoji.name}, Expected custom emoji: ${customEmoji}`);
      if (reaction.emoji.name === event[3]) {
        const eventDetails = await getEventDetailsFromSheet(eventName);
        if (eventDetails && eventDetails.fee > 0) {
          // Check payment status before sending a new Stripe link
          const paymentsSheetName = 'Payments';
          const paymentData = await getSheetData(paymentsSheetName);
          const paymentHeader = paymentData[0];
          const eventColumnIndex = paymentHeader.indexOf(eventName);
          // Assuming Discord ID is in the first column (index 0) of the 'Payments' sheet
          const discordIdColumnIndex = 0; 
          const userPaymentRow = paymentData.find(row => row[discordIdColumnIndex] === user.username);
          
          let currentPaymentStatus = '';
          if (userPaymentRow && eventColumnIndex > -1) {
            currentPaymentStatus = userPaymentRow[eventColumnIndex];
          }

            try {
              const session = await stripeClient.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                  {
                    price_data: {
                      currency: 'jpy',
                      product_data: {
                        name: eventDetails.title,
                      },
                      unit_amount: eventDetails.fee,
                    },
                    quantity: 1,
                  },
                ],
                mode: 'payment',
                success_url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/cancel`,
                metadata: {
                  discord_id: user.id,
                  event_id: eventName,
                },
              });

              const dmChannel = await user.createDM();
              await dmChannel.send(
                `Hello ${user.username}!\n\n` +
                `Here is the payment page for the event "${eventName}":\n${session.url}\n\n` +
                `This payment link expires in 24 hours. If the payment link expires, please RSVP again.\n\n` +
                `Thank you for your understanding! 🙏`
              );
              console.log(`✅ Sent Stripe checkout link to ${user.username}`);
              await updatePaymentStatusInSheet(user.id, eventName, 'DM Sent');
            } catch (stripeError) {
              console.error(`❌ Failed to create Stripe checkout session or send DM:`, stripeError);
            }
        }
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

    // Fetch reactions to ensure up-to-date count
    const threadId = event[1]; // Assuming Thread ID is in Column B
    const channel = await client.channels.fetch(threadId);
    const message = await channel.messages.fetch(reaction.message.id);
    // For standard emojis, name is the identifier. For custom, id is the identifier.
    const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;
    const reactionManager = message.reactions.cache;
    const specificReaction = reactionManager.get(emojiIdentifier);
    const currentParticipants = specificReaction ? specificReaction.count : 0;

    console.log("Current number of RSVPs: " + currentParticipants);

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
  console.log(`[DEBUG] Reaction added: ${reaction.emoji.name} by ${user.tag}`);
  if (user.bot) return;
  await updateRsvpSheet(reaction, user, true);
});

client.on('messageReactionRemove', async (reaction, user) => {
  console.log(`[DEBUG] Reaction removed: ${reaction.emoji.name} by ${user.tag}`);
  if (user.bot) return;
  await updateRsvpSheet(reaction, user, false);
});

client.login(process.env.DISCORD_BOT_TOKEN);
