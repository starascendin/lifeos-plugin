"""Use CDP to dismiss popup and click Sign In."""
import websocket
import json
import urllib.request
import time

tabs = json.loads(urllib.request.urlopen("http://localhost:9222/json/list").read())
tab = [t for t in tabs if t["type"] == "page"][0]
ws = websocket.create_connection(tab["webSocketDebuggerUrl"])
msg_id = 0

def send(method, params=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    return json.loads(ws.recv())

def click(x, y):
    send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
    send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})

# Step 1: Find and dismiss the maintenance popup (Next button)
r = send("Runtime.evaluate", {"expression": """
(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        const text = btn.textContent.trim();
        if (text === 'Next' || text === 'Close' || text === 'OK' || text === 'Dismiss' || text === 'Got it') {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                return JSON.stringify({text, x: rect.x + rect.width/2, y: rect.y + rect.height/2});
            }
        }
    }
    return 'none';
})()
"""})
val = r["result"]["result"]["value"]
print("Popup button:", val)

if val != "none":
    pos = json.loads(val)
    click(pos["x"], pos["y"])
    print(f"Clicked: {pos['text']}")
    time.sleep(1)

# Step 2: Click Sign In
r = send("Runtime.evaluate", {"expression": """
(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        const text = btn.textContent.trim();
        if (text === 'SIGN IN' || text === 'Sign In' || text === 'Sign in') {
            const rect = btn.getBoundingClientRect();
            return JSON.stringify({text, x: rect.x + rect.width/2, y: rect.y + rect.height/2});
        }
    }
    return 'none';
})()
"""})
val = r["result"]["result"]["value"]
print("Sign in button:", val)

if val != "none":
    pos = json.loads(val)
    click(pos["x"], pos["y"])
    print(f"Clicked: {pos['text']}")

# Wait for login to process
print("Waiting for login...")
time.sleep(8)

# Check result
r = send("Runtime.evaluate", {"expression": "window.location.href"})
print("URL:", r["result"]["result"]["value"])
r = send("Runtime.evaluate", {"expression": "document.title"})
print("Title:", r["result"]["result"]["value"])
r = send("Runtime.evaluate", {"expression": "document.body.innerText.substring(0, 300)"})
print("Content:", r["result"]["result"]["value"][:300])

ws.close()
