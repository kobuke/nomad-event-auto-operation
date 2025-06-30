import requests
import config
import datetime

headers = {
    "Authorization": f"Bearer {config.NOTION_API_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

# 📌 今日の日付（YYYY-MM-DD）を取得
def get_today_date():
    return datetime.datetime.now().strftime("%Y-%m-%d")

# ✅ 募集開始日または終了日が今日のイベントを取得（12時用）
def get_events_for_today_post():
    today = get_today_date()
    url = f"https://api.notion.com/v1/databases/{config.NOTION_EVENT_DATABASE_ID}/query"
    payload = {
        "filter": {
            "or": [
                {
                    "property": "募集開始日",
                    "date": {"equals": today}
                },
                {
                    "property": "募集終了日",
                    "date": {"equals": today}
                }
            ]
        }
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        print("❌ Failed to fetch today's postable events:", response.text)
        return []
    return response.json().get("results", [])

# ✅ 募集終了日が今日のイベントを取得（24時用）
def get_events_for_today_payment():
    today = get_today_date()
    url = f"https://api.notion.com/v1/databases/{config.NOTION_EVENT_DATABASE_ID}/query"
    payload = {
        "filter": {
            "property": "募集終了日",
            "date": {"equals": today}
        }
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        print("❌ Failed to fetch today's payment events:", response.text)
        return []
    return response.json().get("results", [])

# ✅ 今日が募集終了日のイベントに対し、「参加する」と回答した参加者とStripe決済URLを取得
# [{event_id, event_title, stripe_url, participants: [{user_id, user_name}]}]
def get_today_payment_participants_with_stripe_url():
    today = datetime.datetime.now().strftime("%Y-%m-%d")

    # Step 1: 本日が募集終了日のイベントを取得
    url = f"https://api.notion.com/v1/databases/{config.NOTION_EVENT_DATABASE_ID}/query"
    payload = {
        "filter": {
            "property": "募集終了日",
            "date": {
                "equals": today
            }
        }
    }

    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        print("❌ Failed to fetch today's payment events:", response.text)
        return []

    events = response.json().get("results", [])
    result = []

    for event in events:
        event_id = event["id"]
        event_title = event["properties"].get("イベント名", {}).get("title", [{}])[0].get("plain_text", "")
        stripe_url = event["properties"].get("Stripe決済リンク", {}).get("url", "")

        if not stripe_url:
            print(f"⚠️ Stripe URL not found for event: {event_title}")
            continue

        # Step 2: 該当イベントに紐づく「参加する」回答者を取得
        answer_query_url = f"https://api.notion.com/v1/databases/{config.NOTION_ANSWER_DATABASE_ID}/query"
        answer_payload = {
            "filter": {
                "and": [
                    {
                        "property": "イベント",
                        "relation": {
                            "contains": event_id
                        }
                    },
                    {
                        "property": "回答",
                        "select": {
                            "equals": "参加する"
                        }
                    }
                ]
            }
        }

        answer_res = requests.post(answer_query_url, headers=headers, json=answer_payload)
        if answer_res.status_code != 200:
            print(f"❌ Failed to fetch answers for event {event_title}: {answer_res.text}")
            continue

        answers = answer_res.json().get("results", [])
        participants = []

        for answer in answers:
            # Discord User ID を取得
            user_id_array = answer["properties"].get("Discord User ID", {}).get("rich_text", [])
            if not user_id_array:
                print("⚠️ Skipped invalid participant record: 'Discord User ID'")
                continue
            user_id = user_id_array[0].get("plain_text", "")

            # User Name を取得（title プロパティ）
            display_name_array = answer["properties"].get("User Name", {}).get("title", [])
            if not display_name_array:
                print("⚠️ Skipped invalid participant record: 'User Name'")
                continue
            display_name = display_name_array[0].get("plain_text", "")

            participants.append({
                "user_id": user_id,
                "display_name": display_name
            })

        result.append({
            "event_id": event_id,
            "event_title": event_title,
            "stripe_url": stripe_url,
            "participants": participants
        })

    return result

def get_participants_by_event(event_id):
    url = f"https://api.notion.com/v1/databases/{config.NOTION_ANSWER_DATABASE_ID}/query"
    payload = {
        "filter": {
            "and": [
                {
                    "property": "イベント",
                    "relation": {
                        "contains": event_id
                    }
                },
                {
                    "property": "回答",
                    "select": {
                        "equals": "参加する"
                    }
                }
            ]
        }
    }

    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        print("❌ Failed to fetch participants for event:", response.text)
        return []

    results = response.json().get("results", [])
    participants = []

    for page in results:
        try:
            user_id = page["properties"]["Discord User ID"]["title"][0]["plain_text"]
            display_name = page["properties"]["User Name"]["rich_text"][0]["plain_text"] \
                if page["properties"].get("User Name", {}).get("rich_text") else "Unknown"
            participants.append({
                "user_id": user_id,
                "display_name": display_name
            })
        except Exception as e:
            print("⚠️ Skipped invalid participant record:", e)
            continue

    return participants

# DMでStripeのリンクを送信後に決済状況を更新する（nullだったら"未払い"に設定する）
def update_payment_status(discord_user_id, event_id, status="未払い"):
    url = f"https://api.notion.com/v1/databases/{config.NOTION_ANSWER_DATABASE_ID}/query"
    payload = {
        "filter": {
            "and": [
                {
                    "property": "Discord User ID",
                    "title": {
                        "equals": str(discord_user_id)
                    }
                },
                {
                    "property": "イベント",
                    "relation": {
                        "contains": event_id
                    }
                }
            ]
        }
    }
    response = requests.post(url, headers=headers, json=payload)
    results = response.json().get("results", [])

    if not results:
        print(f"⚠️ No record found for user {discord_user_id} and event {event_id}")
        return

    page_id = results[0]["id"]

    update_payload = {
        "properties": {
            "決済状況": {
                "select": {
                    "name": status
                }
            }
        }
    }
    update_url = f"https://api.notion.com/v1/pages/{page_id}"
    update_response = requests.patch(update_url, headers=headers, json=update_payload)

    if update_response.status_code != 200:
        print(f"❌ Failed to update payment status for user {discord_user_id}")
    else:
        print(f"✅ Payment status updated for user {discord_user_id}")

# リアクション（スタンプ）の結果をNotionに記載する
def add_reaction_to_notion(data):
    emoji_to_answer = {
        "✅": "参加する",
        "❓": "興味あり",
        "❌": "参加しない"
    }

    events = get_today_poll_events()
    event_id = None

    for ev in events:
        # NotionのイベントページID（ハイフン無しで送られてくる可能性を考慮）
        notion_id = ev["id"].replace("-", "")
        if notion_id == data["event_id"].replace("-", ""):
            event_id = ev["id"]  # 正しい形式で保持（Notion APIに渡す）
            break

    if event_id is None:
        print("❌ Event ID not found in Notion:", data["event_id"])
        return False

    payload = {
        "parent": {"database_id": config.NOTION_ANSWER_DATABASE_ID},
        "properties": {
            "Discord User ID": {
                "title": [
                    {
                        "text": {
                            "content": data["user_id"]
                        }
                    }
                ]
            },
            "回答": {
                "select": {
                    "name": emoji_to_answer.get(data["emoji"], "未定義")
                }
            },
            "イベント": {
                "relation": [
                    {"id": event_id}
                ]
            }
        }
    }

    url = "https://api.notion.com/v1/pages"
    response = requests.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        print("❌ Failed to update Notion:", response.text)
        return False

    print("✅ Notion updated successfully.")
    return True