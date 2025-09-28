
import { Client, IntentsBitField, GatewayIntentBits } from 'discord.js';


const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const sendDmToParticipants = async () => {
  await client.login(process.env.DISCORD_BOT_TOKEN);
  await client.guilds.fetch();

  const events = await getTodayPaymentParticipantsWithStripeUrl();

  if (!events || events.length === 0) {
    console.log('📭 本日が募集終了日のイベントはありません。');
    client.destroy();
    return;
  }

  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
  if (!guild) {
    console.error('Guild not found');
    client.destroy();
    return;
  }

  for (const event of events) {
    const { eventId, eventTitle, stripeUrl, participants } = event;

    for (const user of participants) {
      const { userId, displayName } = user;
      const stripeLink = `${stripeUrl}?discord_id=${userId}`;

      try {
        const member = await guild.members.fetch(userId);
        if (!member) {
          console.log(`⚠️ User not found: ${userId}`);
          continue;
        }

        const dmChannel = await member.createDM();
        await dmChannel.send(
          `${displayName}さん、こんにちは！\n\n` +
            `イベント「${eventTitle}」の決済ページはこちらです：\n${stripeLink}\n\n` +
            `どうぞよろしくお願いします！🙏`
        );
        console.log(`✅ DM sent to ${displayName}`);
        await updatePaymentStatus(userId, eventId, '未払い');
      } catch (error) {
        console.error(`❌ Failed to send DM to ${userId}:`, error);
      }
    }
  }

  client.destroy();
};

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await sendDmToParticipants();
});

client.login(process.env.DISCORD_BOT_TOKEN);
