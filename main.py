# main.py
import subprocess
import datetime

now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
print(f"[{now}] Running discord_bot_post.py")
subprocess.run(["python", "discord_bot_post.py"])