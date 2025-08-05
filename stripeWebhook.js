
import express from 'express';
import stripe from 'stripe';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { updatePaymentStatus } from './notionHandler.js';

dotenv.config();

const app = express();
const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`⚠️  Webhook signature verification failed.`, err.message);
    return res.sendStatus(400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const discordId = session.client_reference_id || session.metadata?.discord_id;

    if (!discordId) {
      console.log('⚠️ discord_id not found in session');
      return res.json({ status: 'missing discord_id' });
    }

    console.log(`✅ Payment completed for Discord ID: ${discordId}`);

    const eventId = session.metadata?.event_id;
    if (!eventId) {
      console.log('⚠️ event_id not found in session metadata');
      return res.json({ status: 'missing event_id' });
    }

    const success = await updatePaymentStatus(discordId, eventId, '支払い済み');

    if (success) {
      res.json({ status: 'success' });
    } else {
      res.json({ status: 'notion update failed' });
    }
  } else {
    res.json({ status: 'ignored' });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
