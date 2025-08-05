import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

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
      const createSessionResponse = await fetch(`${process.env.RAILWAY_PUBLIC_DOMAIN}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event_id?.trim(), userId: user.id }),
      });
      const sessionData = await createSessionResponse.json();

      if (sessionData.url) {
        const dmChannel = await member.createDM();
        await dmChannel.send(
          `${displayName}さん、イベント「${title}」へのご参加ありがとうございます！\n` +
          `決済はこちらからお願いします：\n${sessionData.url}\n\n` +
          `ご不明な点があれば、お気軽にお問い合わせください。`
        );
        console.log(`✅ Sent Stripe checkout link to ${displayName}`);
      } else {
        console.error('❌ Failed to get Stripe checkout URL:', sessionData.error);
      }
    }

    await fetch(process.env.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("❌ Error handling reaction:", err);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);