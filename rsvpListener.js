
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

      // Stripe integration
      if (reaction.emoji.name === '✅') {
        const eventDetails = await getEventDetailsFromSheet(eventName);
        if (eventDetails && eventDetails.fee > 0) {
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
              `${user.username}さん、イベント「${eventName}」へのご参加ありがとうございます！\n` +
              `決済はこちらからお願いします：
[決済URL](${session.url})

` +
              `ご不明な点があれば、お気軽にお問い合わせください。`
            );
            console.log(`✅ Sent Stripe checkout link to ${user.username}`);
            await updatePaymentStatusInSheet(user.id, eventName, 'DM送付済み');
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
