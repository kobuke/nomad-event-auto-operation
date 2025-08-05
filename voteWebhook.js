
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const notion = new Client({ auth: process.env.NOTION_API_TOKEN });
const DB_ID = process.env.NOTION_ANSWER_DATABASE_ID;

const findExistingAnswer = async (userId, eventId) => {
  try {
    const response = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        and: [
          {
            property: 'Discord User ID',
            rich_text: { equals: userId },
          },
          {
            property: 'イベント',
            relation: { contains: eventId },
          },
        ],
      },
    });
    return response.results.length > 0 ? response.results[0].id : null;
  } catch (error) {
    console.error('❌ Failed to query Notion:', error);
    return null;
  }
};

app.post('/reaction', async (req, res) => {
  const { userId, emoji, eventId, username } = req.body;
  console.log('✅ Reaction received:', req.body);

  const emojiToAnswer = {
    '✅': '参加する',
    '❓': '興味あり',
    '❌': '参加しない',
  };

  const notionPayload = {
    properties: {
      'Discord User ID': {
        rich_text: [{ text: { content: userId } }],
      },
      'User Name': {
        title: [{ text: { content: username } }],
      },
      'イベント': {
        relation: [{ id: eventId }],
      },
      '回答': {
        select: { name: emojiToAnswer[emoji] || '未定義' },
      },
    },
  };

  const existingId = await findExistingAnswer(userId, eventId);
  let action = '';

  try {
    if (existingId) {
      await notion.pages.update({
        page_id: existingId,
        ...notionPayload,
      });
      action = 'Updated';
    } else {
      await notion.pages.create({
        parent: { database_id: DB_ID },
        ...notionPayload,
      });
      action = 'Created';
    }
    console.log(`✅ ${action} answer for ${userId} in event ${eventId}`);
    res.sendStatus(200);
  } catch (error) {
    console.error(`❌ Failed to update Notion:`, error);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
