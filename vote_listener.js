import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import fetch from 'node-fetch';


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});

client.once('ready', () => {
  console.log(`🟢 vote_listener is running as ${client.user.tag}`);
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  try {
    await reaction.fetch(); // Ensure full reaction object

    const [eventTitleLine] = reaction.message.content.split('\n');
    const [title, event_id] = eventTitleLine.replace('📢 ', '').split(' | ');

    const member = await reaction.message.guild.members.fetch(user.id);
    const displayName = member.displayName || user.username;

    const payload = {
      user_id: user.id,
      username: displayName,
      emoji: reaction.emoji.name,
      message_id: reaction.message.id,
      event_id: event_id?.trim() || null,
    };

    console.log("✅ Reaction payload:", payload);

    if (reaction.emoji.name === '✅') {
      const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
      const stripeCheckoutUrl = `https://${railwayPublicDomain}/create-checkout-session`;
      console.log(`[DEBUG] RAILWAY_PUBLIC_DOMAIN: ${railwayPublicDomain}`);
      console.log(`[DEBUG] Attempting to fetch Stripe checkout session from: ${stripeCheckoutUrl}`);
      try {
        const createSessionResponse = await fetch(stripeCheckoutUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: event_id?.trim(), userId: user.id }),
        });
        console.log(`[DEBUG] Stripe checkout session response status: ${createSessionResponse.status}`);
        if (!createSessionResponse.ok) {
          console.error(`[ERROR] Stripe checkout session request failed with status: ${createSessionResponse.status}`);
          const errorText = await createSessionResponse.text();
          console.error(`[ERROR] Stripe checkout session error response: ${errorText}`);
        }
        const sessionData = await createSessionResponse.json();
        console.log('[DEBUG] Stripe session data:', sessionData);

        if (sessionData.url) {
          const dmChannel = await member.createDM();
          await dmChannel.send(
            `${displayName}さん、イベント「${title}」へのご参加ありがとうございます！\n` +
            `決済はこちらからお願いします：
[決済URL](${sessionData.url})

` +
            `ご不明な点があれば、お気軽にお問い合わせください。`
          );
          console.log(`✅ Sent Stripe checkout link to ${displayName}`);
        } else {
          console.error('❌ Failed to get Stripe checkout URL:', sessionData.error);
        }
      } catch (fetchError) {
        console.error(`[ERROR] Error during Stripe checkout session fetch: ${fetchError.message}`);
      }
    }

  } catch (err) {
    console.error("❌ Error handling reaction:", err);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);