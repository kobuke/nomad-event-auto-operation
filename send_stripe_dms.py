import discord
import asyncio
import config
from notion_handler import get_today_payment_participants_with_stripe_url
from notion_handler import update_payment_status

intents = discord.Intents.default()
intents.members = True
client = discord.Client(intents=intents)

async def send_dm_to_participants():
    await client.wait_until_ready()

    # 募集終了日が今日のイベントと「参加する」回答者＋Stripeリンクを取得
    events = get_today_payment_participants_with_stripe_url()

    if not events:
        print("📭 本日が募集終了日のイベントはありません。")
        await client.close()
        return

    guild = discord.utils.get(client.guilds, id=int(config.DISCORD_GUILD_ID))

    for event in events:
        event_id = event["event_id"]
        event_title = event["event_title"]
        stripe_base_url = event["stripe_url"]
        participants = event["participants"]

        for user in participants:
            discord_user_id = user["user_id"]
            display_name = user["display_name"]

            stripe_url = f"{stripe_base_url}?discord_id={discord_user_id}"

            try:
                member = await guild.fetch_member(int(discord_user_id))
                if member is None:
                    print(f"⚠️ User not found: {discord_user_id}")
                    continue

                dm = await member.create_dm()
                await dm.send(
                    f"{display_name}さん、こんにちは！\n\n"
                    f"イベント「{event_title}」の決済ページはこちらです：\n{stripe_url}\n\n"
                    f"どうぞよろしくお願いします！🙏"
                )
                print(f"✅ DM sent to {display_name}")
                update_payment_status(discord_user_id, event_id, status="未払い")
            except Exception as e:
                print(f"❌ Failed to send DM to {discord_user_id}: {e}")

    await client.close()

@client.event
async def on_ready():
    await send_dm_to_participants()

client.run(config.DISCORD_BOT_TOKEN)