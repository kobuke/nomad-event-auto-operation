import stripe
import uvicorn
from fastapi import FastAPI, Request, Header
import config
from notion_handler import update_payment_status  # 後で実装

app = FastAPI()

# StripeのWebhook Secret
stripe.api_key = config.STRIPE_SECRET_KEY
endpoint_secret = config.STRIPE_WEBHOOK_SECRET

@app.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None)
):
    payload = await request.body()
    sig_header = stripe_signature

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        print("⚠️ Invalid payload:", e)
        return {"status": "invalid payload"}
    except stripe.error.SignatureVerificationError as e:
        print("❌ Invalid signature:", e)
        return {"status": "invalid signature"}

    # ✅ チェックアウト完了イベントを処理
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        # クエリパラメータのdiscord_idを取得
        discord_id = session.get("client_reference_id") or session.get("metadata", {}).get("discord_id")

        if not discord_id:
            print("⚠️ discord_id not found in session")
            return {"status": "missing discord_id"}

        print(f"✅ Payment completed for Discord ID: {discord_id}")

        # Notionに決済状況を更新
        success = update_payment_status(discord_id)

        if success:
            return {"status": "success"}
        else:
            return {"status": "notion update failed"}

    return {"status": "ignored"}