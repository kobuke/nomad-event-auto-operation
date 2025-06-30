import requests
import config

headers = {
    "Authorization": f"Bearer {config.NOTION_API_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def get_today_poll_events():
    url = f"https://api.notion.com/v1/databases/{config.NOTION_EVENT_DATABASE_ID}/query"
    response = requests.post(url, headers=headers)
    if response.status_code != 200:
        print("❌ Failed to fetch events")
        return []
    return response.json().get("results", [])

def add_reaction_to_notion(data):
    # Discord絵文字 → Notionの選択肢に変換
    emoji_to_answer = {
        "✅": "参加する",
        "❓": "興味あり",
        "❌": "参加しない"
    }

    # イベントを取得（タイトル一致）
    events = get_today_poll_events()
    event_id = None
    for ev in events:
        title = ev["properties"]["イベント名"]["title"][0]["plain_text"]
        if title == data["event_title"]:
            event_id = ev["id"]
            break

    if event_id is None:
        print("❌ Event not found in Notion:", data["event_title"])
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