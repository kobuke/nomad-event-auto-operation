
import { Client, GatewayIntentBits } from 'discord.js';
import { getSheetData, getEventDetailsFromSheet, updatePaymentStatusInSheet } from './googleSheetHandler.js';
import dotenv from 'dotenv';
import stripe from 'stripe';

dotenv.config();

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

export const checkUnsentPayments = async () => {
  console.log('🚀 Starting check for unsent payment links...');
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
  });

  let newPaymentLinksCount = 0; // Initialize counter

  try {
    console.log('Attempting to log in to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);



    const [events, rsvpData, paymentsData, usersData] = await Promise.all([
      getSheetData('Event Setting'),
      getSheetData('RSVP'),
      getSheetData('Payments'),
      getSheetData('Users'),
    ]);

    // 2. Create a map for userName -> userId
    const userMap = new Map(usersData.slice(1).map(row => [row[0], row[1]])); // userName -> userId

    // 3. Get header rows to find column indices
    const rsvpHeader = rsvpData[0];
    const paymentsHeader = paymentsData[0];
    const paymentsUserNameCol = paymentsData.map(row => row[0]); // Column A is User Name

    const eventsToProcess = events.slice(1).filter(eventRow => eventRow[0]); // Filter out empty event name rows

    // 4. Iterate through each event
    for (const eventRow of eventsToProcess) {
      const eventName = eventRow[0];
      const eventFee = parseFloat(eventRow[6]); // Corrected: Assuming fee is in column G (index 6)

      if (!eventName || isNaN(eventFee) || eventFee <= 0) {
        console.log(`[${eventName}] Skipping event with no name or zero/invalid fee.`);
        continue;
      }

      const rsvpEventCol = rsvpHeader.indexOf(eventName);
      const paymentEventCol = paymentsHeader.indexOf(eventName);

      if (rsvpEventCol === -1) {
        console.log(`[${eventName}] Event not found in RSVP sheet. Skipping.`);
        continue;
      }
      if (paymentEventCol === -1) {
        console.log(`[${eventName}] Event not found in Payments sheet. Skipping.`);
        continue;
      }

      console.log(`[${eventName}] Processing event...`);

      // 5. Find users who RSVP'd but have no payment status
      for (let i = 1; i < rsvpData.length; i++) {
        const rsvpRow = rsvpData[i];
        const userName = rsvpRow[0];
        const rsvpStatus = rsvpRow[rsvpEventCol];

        if (rsvpStatus) { // User has RSVP'd
          const userId = userMap.get(userName);
          if (!userId) {
            console.log(`[${eventName}] ⚠️ User '${userName}' from RSVP sheet not found in Users sheet. Cannot get userId.`);
            continue;
          }

          const paymentUserRowIndex = paymentsUserNameCol.indexOf(userName);
          let currentPaymentStatus = '';
          if (paymentUserRowIndex > -1) {
            currentPaymentStatus = paymentsData[paymentUserRowIndex][paymentEventCol];
          }

          console.log(`[DEBUG] User ID: ${userId}`);
          console.log(`[DEBUG] paymentUserRowIndex: ${paymentUserRowIndex}`);
          console.log(`[DEBUG] paymentEventCol: ${paymentEventCol}`);
          console.log(`[DEBUG] Current Payment Status for ${userName} (${eventName}): '${currentPaymentStatus}'`);
          if (currentPaymentStatus !== 'DM Sent' && currentPaymentStatus !== '支払い済み') {
            console.log(`[${eventName}] ❗️ Found user who needs payment link: ${userName} (ID: ${userId})`);

                            // 6. Send payment link
                        try {
                          const member = await client.users.fetch(userId);
                          if (member) {
                            const session = await stripeClient.checkout.sessions.create({
                              payment_method_types: ['card'],
                              line_items: [{
                                price_data: {
                                  currency: 'jpy',
                                  product_data: { name: eventName },
                                  unit_amount: eventFee,
                                },
                                quantity: 1,
                              }],
                              mode: 'payment',
                              success_url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/success`,
                              cancel_url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/cancel`,
                              metadata: { discord_id: userId, event_id: eventName },
                            });
            
                            await member.send(
                              `Hello ${userName}!\n\n` +
                              `We noticed you've RSVP'd for "${eventName}" but haven't received a payment link. Here it is:\n${session.url}\n\n` +
                              `This payment link expires in 24 hours. If the payment link expires, please RSVP again.\n\n` +
                              `Thank you for your understanding! 🙏`
                            );
                            console.log(`[${eventName}] ✅ Successfully sent payment link to ${userName}.`);
                            newPaymentLinksCount++; // Increment counter
                            
                            await updatePaymentStatusInSheet(userId, eventName, 'DM Sent');
                          }
                        } catch (error) {
                          if (error.code === 50007) {
                            console.error(`[${eventName}] ❌ Failed to send DM to ${userName} (ID: ${userId}). They may have DMs disabled.`, error.message);
                          } else {
                            console.error(`[${eventName}] ❌ An error occurred while creating Stripe session for ${userName} (ID: ${userId}):`, error);
                          }
                        }          }
        }
      }
    }
  } catch (error) {
    console.error('❌ An unexpected error occurred in checkUnsentPayments:', error);
  } finally {
    console.log('✅ Finished checking for unsent payment links.');
    console.log(`Total new payment links sent: ${newPaymentLinksCount}`);
    client.destroy();
  }
};
