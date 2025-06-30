import requests
import config
import datetime

headers = {
    "Authorization": f"Bearer {config.NOTION_API_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def get_today_poll_events():
    today = datetime.datetime.now().date().isoformat()  # 'YYYY-MM-DD'
    url = f"https://api.notion.com/v1/databases/{config.NOTION_EVENT_DATABASE_ID}/query"
    
    payload = {
        "filter": {
            "or": [
                {
                    "property": "募集開始日",
                    "date": {
                        "equals": today
                    }
                },
                {
                    "property": "募集終了日",
                    "date": {
                        "equals": today
                    }
                }
            ]
        }
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        print("❌ Failed to fetch events:", response.text)
        return []
    
    return response.json().get("results", [])

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