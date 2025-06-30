import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import fetch from 'node-fetch';
import fs from 'fs';
import config from './config_for_node.json' assert { type: 'json' };

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

    await fetch(config.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("❌ Error handling reaction:", err);
  }
});

client.login(config.NODE_DISCORD_BOT_TOKEN);