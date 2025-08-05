
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_TOKEN });

const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

export const getEventsForTodayPost = async () => {
  const today = getTodayDate();
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_EVENT_DATABASE_ID,
      filter: {
        or: [
          {
            property: '募集開始日',
            date: { equals: today },
          },
          {
            property: '募集終了日',
            date: { equals: today },
          },
        ],
      },
    });
    return response.results;
  } catch (error) {
    console.error("❌ Failed to fetch today's postable events:", error);
    return [];
  }
};

export const getEventDetails = async (eventId) => {
  try {
    const response = await notion.pages.retrieve({ page_id: eventId });
    const title = response.properties['イベント名']?.title[0]?.plain_text || 'Unknown Event';
    const fee = response.properties['参加費（円）']?.number || 0; // Assuming '参加費（円）' is a number property
    return { title, fee };
  } catch (error) {
    console.error(`❌ Failed to fetch event details for ${eventId}:`, error);
    return null;
  }
};

export const getEventsForTodayPayment = async () => {
  const today = getTodayDate();
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_EVENT_DATABASE_ID,
      filter: {
        property: '募集終了日',
        date: { equals: today },
      },
    });
    return response.results;
  } catch (error) {
    console.error("❌ Failed to fetch today's payment events:", error);
    return [];
  }
};

export const getTodayPaymentParticipantsWithStripeUrl = async () => {
  const today = getTodayDate();
  const events = await getEventsForTodayPayment();
  const result = [];

  for (const event of events) {
    const eventId = event.id;
    const eventTitle = event.properties['イベント名']?.title[0]?.plain_text || '';
    const stripeUrl = event.properties['Stripe決済リンク']?.url || '';

    if (!stripeUrl) {
      console.log(`⚠️ Stripe URL not found for event: ${eventTitle}`);
      continue;
    }

    try {
      const answerResponse = await notion.databases.query({
        database_id: process.env.NOTION_ANSWER_DATABASE_ID,
        filter: {
          and: [
            {
              property: 'イベント',
              relation: { contains: eventId },
            },
            {
              property: '回答',
              select: { equals: '参加する' },
            },
          ],
        },
      });

      const participants = answerResponse.results.map((answer) => {
        const userId = answer.properties['Discord User ID']?.rich_text[0]?.plain_text || '';
        const displayName = answer.properties['User Name']?.title[0]?.plain_text || '';
        return { userId, displayName };
      });

      result.push({
        eventId,
        eventTitle,
        stripeUrl,
        participants,
      });
    } catch (error) {
      console.error(`❌ Failed to fetch answers for event ${eventTitle}:`, error);
    }
  }

  return result;
};

export const updatePaymentStatus = async (discordUserId, eventId, status = '未払い') => {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_ANSWER_DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Discord User ID',
            rich_text: { equals: discordUserId.toString() },
          },
          {
            property: 'イベント',
            relation: { contains: eventId },
          },
        ],
      },
    });

    if (response.results.length === 0) {
      console.log(`⚠️ No record found for user ${discordUserId} and event ${eventId}`);
      return false;
    }

    const pageId = response.results[0].id;

    await notion.pages.update({
      page_id: pageId,
      properties: {
        決済状況: {
          select: {
            name: status,
          },
        },
      },
    });

    console.log(`✅ Payment status updated for user ${discordUserId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update payment status for user ${discordUserId}:`, error);
    return false;
  }
};

const getTomorrowDate = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

export const getEventsForTomorrow = async () => {
  const tomorrow = getTomorrowDate();
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_EVENT_DATABASE_ID,
      filter: {
        property: '開催日時', // イベントDBの「開催日時」カラム
        date: { equals: tomorrow },
      },
    });
    return response.results;
  } catch (error) {
    console.error("❌ Failed to fetch tomorrow's events:", error);
    return [];
  }
};

export const getParticipantsForEvent = async (eventId) => {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_ANSWER_DATABASE_ID, // 参加者DBのID
      filter: {
        and: [
          {
            property: 'イベント', // 参加者DBの「イベント」リレーションカラム
            relation: { contains: eventId },
          },
          {
            property: '回答', // 参加者DBの「回答」カラム
            select: { equals: '参加する' },
          },
        ],
      },
    });
    return response.results.map(participant => participant.properties['Discord User ID']?.rich_text[0]?.plain_text);
  } catch (error) {
    console.error(`❌ Failed to fetch participants for event ${eventId}:`, error);
    return [];
  }
};
