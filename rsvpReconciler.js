
import { Client, GatewayIntentBits } from 'discord.js';
import { getSheetData, updateSheet } from './googleSheetHandler.js';
import dotenv from 'dotenv';

dotenv.config();

export const reconcileRsvps = async () => {
  console.log('🚀 Starting RSVP reconciliation...');
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });
  await client.login(process.env.DISCORD_BOT_TOKEN);

  let newRsvpsCount = 0; // Initialize counter

  try {
    // 1. Fetch all necessary data from Google Sheets
    console.log('[DEBUG] Fetching data from Google Sheets...');
    const [events, rsvpData] = await Promise.all([
      getSheetData('Event Setting'),
      getSheetData('RSVP'),
    ]);
    console.log(`[DEBUG] Found ${events.length - 1} events in 'Event Setting'.`);
    console.log(`[DEBUG] Found ${rsvpData.length - 1} users in 'RSVP' sheet.`);

    const newRsvpData = rsvpData.map(row => [...row]); // Create a mutable copy
    let updatesMade = 0;

    // 2. Get header rows and user column to find indices
    const eventSettingsHeader = events[0];
    const eventNameColIdx = eventSettingsHeader.indexOf('Event Name');
    const threadIdColIdx = eventSettingsHeader.indexOf('Thread ID');
    const messageIdColIdx = eventSettingsHeader.indexOf('Message ID');
    const emojiColIdx = eventSettingsHeader.indexOf('Stamp'); // Corrected column name

    console.log(`[DEBUG] 'Event Setting' Header:`, eventSettingsHeader);
    console.log(`[DEBUG] Index for 'Message ID': ${messageIdColIdx}`);
    console.log(`[DEBUG] Index for 'Stamp': ${emojiColIdx}`);

    if (messageIdColIdx === -1 || emojiColIdx === -1) {
        console.error("❌ Critical Error: Could not find 'Message ID' or 'Stamp' columns in 'Event Setting' sheet. Please check the column names.");
        return;
    }

    const rsvpHeader = rsvpData[0];
    const rsvpUserNames = rsvpData.map(row => row[0]);

    const eventsToProcess = events.slice(1).filter(row => row[messageIdColIdx] && row[emojiColIdx]);
    console.log(`[DEBUG] Found ${eventsToProcess.length} events with Message ID and Reaction to process.`);

    // 3. Iterate through each event defined in 'Event Setting'
    for (const eventRow of eventsToProcess) {
      const eventName = eventRow[eventNameColIdx];
      const threadId = eventRow[threadIdColIdx];
      const messageId = eventRow[messageIdColIdx];
      const emoji = eventRow[emojiColIdx];

      console.log(`\n[${eventName}] Processing event...`);
      console.log(`[${eventName}] Thread: ${threadId}, Message: ${messageId}, Emoji: ${emoji}`);

      const rsvpEventCol = rsvpHeader.indexOf(eventName);
      if (rsvpEventCol === -1) {
        console.log(`[${eventName}] ⚠️ Event not found in 'RSVP' sheet header. Skipping.`);
        continue;
      }

      try {
        // 4. Fetch reaction data from Discord
        console.log(`[${eventName}] Fetching message from Discord...`);
        const channel = await client.channels.fetch(threadId);
        if (!channel || !channel.isTextBased()) {
            console.log(`[${eventName}] ⚠️ Channel ${threadId} not found or is not a text channel. Skipping.`);
            continue;
        }
        const message = await channel.messages.fetch(messageId);
        const reaction = message.reactions.cache.get(emoji);

        if (!reaction) {
          console.log(`[${eventName}] ⚠️ No one has reacted with ${emoji} yet. Skipping.`);
          continue;
        }

        console.log(`[${eventName}] Fetching users for ${emoji} reaction...`);
        const reactionUsers = await reaction.users.fetch();
        console.log(`[${eventName}] Found ${reactionUsers.size} user(s) who reacted.`);

        // 5. Compare and find missing RSVPs
        for (const user of reactionUsers.values()) {
          if (user.bot) continue; // Ignore bots

          console.log(`[${eventName}] -- Checking user: ${user.username}`);
          const userRowIndex = rsvpUserNames.indexOf(user.username);
          
          if (userRowIndex === -1) {
            console.log(`[${eventName}] -- ⚠️ User '${user.username}' who reacted is not in the 'RSVP' sheet user list. Skipping.`);
            continue;
          }

          const currentRsvpStatus = newRsvpData[userRowIndex][rsvpEventCol];
          console.log(`[${eventName}] -- Current RSVP status for '${user.username}' is: '${currentRsvpStatus || 'EMPTY'}'`);

          // If the cell is empty, mark it as 'RSVP'
          if (!currentRsvpStatus) {
            console.log(`[${eventName}] -- ❗️ Found missing RSVP for '${user.username}'. Staging update.`);
            newRsvpData[userRowIndex][rsvpEventCol] = new Date().toISOString();
            updatesMade++;
            newRsvpsCount++; // Increment new RSVPs counter
          }
        }
      } catch (error) {
        console.error(`[${eventName}] ❌ An error occurred while processing event:`, error.message);
      }
    }

    // 6. Update the sheet if any changes were made
    if (updatesMade > 0) {
      console.log(`\n[INFO] Found ${updatesMade} total discrepancies. Updating sheet...`);
      await updateSheet('RSVP', newRsvpData);
      console.log(`✅ Finished reconciliation. Updated ${updatesMade} missing RSVP(s).`);
    } else {
      console.log('\n✅ Finished reconciliation. No discrepancies found.');
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred during reconciliation:', error);
  } finally {
    console.log('✅ Finished RSVP reconciliation.');
    console.log(`Total new RSVPs recorded: ${newRsvpsCount}`);
    client.destroy();
  }
};
