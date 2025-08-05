
import express from 'express';
import bodyParser from 'body-parser';
import stripe from 'stripe';
import dotenv from 'dotenv';
import { updatePaymentStatus } from './notionHandler.js';
import { Client as NotionClient } from '@notionhq/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

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
    const success = await updatePaymentStatus(discordId, eventId, '支払い済み');
    res.json({ status: success ? 'success' : 'notion update failed' });
  } else {
    res.json({ status: 'ignored' });
  }
});

// Vote Webhook
const notion = new NotionClient({ auth: process.env.NOTION_API_TOKEN });
const NOTION_DB_ID = process.env.NOTION_ANSWER_DATABASE_ID;

const findExistingAnswer = async (userId, eventId) => {
  try {
    const response = await notion.databases.query({
      database_id: NOTION_DB_ID,
      filter: {
        and: [
          { property: 'Discord User ID', rich_text: { equals: userId } },
          { property: 'イベント', relation: { contains: eventId } },
        ],
      },
    });
    return response.results.length > 0 ? response.results[0].id : null;
  } catch (error) {
    console.error('❌ Failed to query Notion:', error);
    return null;
  }
};

app.post('/vote-webhook', bodyParser.json(), async (req, res) => {
  const { userId, emoji, eventId, username } = req.body;
  console.log('✅ Reaction received:', req.body);

  const emojiToAnswer = { '✅': '参加する', '❓': '興味あり', '❌': '参加しない' };
  const answer = emojiToAnswer[emoji] || '未定義';

  const properties = {
    'Discord User ID': { rich_text: [{ text: { content: userId } }] },
    'User Name': { title: [{ text: { content: username } }] },
    'イベント': { relation: [{ id: eventId }] },
    '回答': { select: { name: answer } },
  };

  try {
    const existingId = await findExistingAnswer(userId, eventId);
    if (existingId) {
      await notion.pages.update({ page_id: existingId, properties });
      console.log(`✅ Updated answer for ${userId} in event ${eventId}`);
    } else {
      await notion.pages.create({ parent: { database_id: NOTION_DB_ID }, properties });
      console.log(`✅ Created answer for ${userId} in event ${eventId}`);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error(`❌ Failed to update Notion:`, error);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
