import json
import config

node_config = {
    "NODE_DISCORD_BOT_TOKEN": config.DISCORD_BOT_TOKEN,
    "NODE_CHANNEL_ID": config.DISCORD_CHANNEL_ID,
    "WEBHOOK_URL": config.WEBHOOK_URL    
}

with open("config_for_node.json", "w") as f:
    json.dump(node_config, f)