
import express from 'express';
import bodyParser from 'body-parser';
import stripe from 'stripe';

import { getEventDetailsFromSheet, updatePaymentStatusInSheet } from './googleSheetHandler.js';
import { Client as DiscordClient, IntentsBitField } from 'discord.js';



const app = express();
const PORT = process.env.PORT || 8080;

const discordClient = new DiscordClient({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.DirectMessages,
  ],
});

discordClient.login(process.env.DISCORD_BOT_TOKEN);

discordClient.on('ready', () => {
  console.log(`Logged in to Discord as ${discordClient.user.tag}`);
});

app.post('/create-checkout-session', bodyParser.json(), async (req, res) => {
  const { eventId, userId } = req.body;

  if (!eventId || !userId) {
    return res.status(400).json({ error: 'Missing eventId or userId' });
  }

  try {
    const eventDetails = await getEventDetailsFromSheet(eventId);
    if (!eventDetails) {
      return res.status(404).json({ error: 'Event not found or details missing' });
    }

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: eventDetails.title,
            },
            unit_amount: eventDetails.fee, // 参加費（円）をStripeの最小単位（円）で設定
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/cancel`,
      metadata: {
        discord_id: userId,
        event_id: eventId,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook
const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);
const stripeEndpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, stripeEndpointSecret);
  } catch (err) {
    console.log(`⚠️ Webhook signature verification failed.`, err.message);
    return res.sendStatus(400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const discordId = session.client_reference_id || session.metadata?.discord_id;
    const eventId = session.metadata?.event_id;

    if (!discordId || !eventId) {
      console.log('⚠️ discord_id or event_id not found in session');
      return res.json({ status: 'missing data' });
    }

    console.log(`✅ Payment completed for Discord ID: ${discordId}`);
    const success = await updatePaymentStatusInSheet(discordId, eventId, '支払い済み');

    if (success) {
      try {
        const user = await discordClient.users.fetch(discordId);
        if (user) {
          await user.send(`イベントへの決済が完了しました！ご参加ありがとうございます。`);
          console.log(`✅ Sent payment confirmation DM to ${user.tag}`);
        }
      } catch (dmError) {
        console.error(`❌ Failed to send payment confirmation DM to ${discordId}:`, dmError);
      }
    }
    res.json({ status: success ? 'success' : 'sheet update failed' });
  } else {
    res.json({ status: 'ignored' });
  }
});

app.get('/success', (req, res) => {
  res.send('<h1>決済が完了しました！ご参加ありがとうございます。</h1><p>DiscordのDMをご確認ください。</p>');
});

app.get('/cancel', (req, res) => {
  res.send('<h1>決済がキャンセルされました。</h1><p>ご不明な点があれば、お問い合わせください。</p>');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
