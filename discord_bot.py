import discord
import asyncio
import subprocess
import config
from notion_handler import get_today_poll_events

intents = discord.Intents.default()
intents.message_content = True
intents.reactions = True
intents.guilds = True
intents.guild_messages = True

client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f"Logged in as {client.user}")

    events = get_today_poll_events()
    if not events:
        print("📭 No poll events found for today.")
        await client.close()
        return

    for event in events:
        title = event["properties"]["イベント名"]["title"][0]["plain_text"]
        event_id = event["id"]  # ページIDを取得
        message = await client.get_channel(int(config.DISCORD_CHANNEL_ID)).send(
            f"📢 {title} | {event_id}\n\nリアクションで出欠を教えてください！\n✅ 参加する\n❓ 興味あり\n❌ 参加しない"
        )

        for emoji in ["✅", "❓", "❌"]:
            await message.add_reaction(emoji)

    await asyncio.sleep(1)
    await client.close()

client.run(config.DISCORD_BOT_TOKEN)