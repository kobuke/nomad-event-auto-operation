from fastapi import FastAPI, Request
import uvicorn
import config
import requests

app = FastAPI()

NOTION_HEADERS = {
    "Authorization": f"Bearer {config.NOTION_API_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

DB_ID = config.NOTION_ANSWER_DATABASE_ID  # 回答DBのID


def find_existing_answer(user_id, event_id):
    url = f"https://api.notion.com/v1/databases/{DB_ID}/query"
    query = {
        "filter": {
            "and": [
                {
                    "property": "Discord User ID",
                    "title": {
                        "equals": user_id
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
    res = requests.post(url, headers=NOTION_HEADERS, json=query)
    if res.status_code != 200:
        print("❌ Failed to query Notion:", res.text)
        return None
    results = res.json().get("results", [])
    return results[0]["id"] if results else None


@app.post("/reaction")
async def handle_reaction(request: Request):
    data = await request.json()
    print("✅ Reaction received:", data)

    user_id = data["user_id"]
    emoji = data["emoji"]
    event_id = data["event_id"]

    emoji_to_answer = {
        "✅": "参加する",
        "❓": "興味あり",
        "❌": "参加しない"
    }

    notion_payload = {
        "properties": {
            "Discord User ID": {
                "rich_text": [{"text": {"content": user_id}}]
            },
            "User Name": {
                "title": [{"text": {"content": data["username"]}}]
            },
            "イベント": {
                "relation": [{"id": event_id}]
            },
            "回答": {
                "select": {"name": emoji_to_answer.get(emoji, "未定義")}
            }
        }
    }

    existing_id = find_existing_answer(user_id, event_id)
    if existing_id:
        # 更新
        url = f"https://api.notion.com/v1/pages/{existing_id}"
        response = requests.patch(url, headers=NOTION_HEADERS, json=notion_payload)
        action = "Updated"
    else:
        # 新規作成
        notion_payload["parent"] = {"database_id": DB_ID}
        url = "https://api.notion.com/v1/pages"
        response = requests.post(url, headers=NOTION_HEADERS, json=notion_payload)
        action = "Created"

    if response.status_code not in [200, 201]:
        print(f"❌ Failed to update Notion: {response.text}")
    else:
        print(f"✅ {action} answer for {user_id} in event {event_id}")

    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)