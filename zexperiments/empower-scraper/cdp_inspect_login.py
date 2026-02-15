"""Inspect the Empower login page structure via CDP."""
import websocket
import json
import urllib.request
import time

tabs = json.loads(urllib.request.urlopen("http://localhost:9222/json/list").read())
page_tabs = [t for t in tabs if t["type"] == "page"]

if not page_tabs:
    print("No tabs, creating one...")
    import http.client
    conn = http.client.HTTPConnection("localhost", 9222)
    conn.request("PUT", "/json/new?https://participant.empower-retirement.com/participant/#/login")
    resp = conn.getresponse()
    data = json.loads(resp.read())
    tab = data
    time.sleep(5)
    tabs = json.loads(urllib.request.urlopen("http://localhost:9222/json/list").read())
    page_tabs = [t for t in tabs if t["type"] == "page"]

tab = page_tabs[0]
print(f"Tab: {tab['title'][:50]} - {tab['url'][:80]}")

ws = websocket.create_connection(tab["webSocketDebuggerUrl"])
msg_id = 0

def send(method, params=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    return json.loads(ws.recv())

# Navigate to login
send("Page.navigate", {"url": "https://participant.empower-retirement.com/participant/#/login"})
print("Navigating to login page...")
time.sleep(8)

# Get full page structure - all visible buttons, modals, overlays
r = send("Runtime.evaluate", {"expression": """
(() => {
    const result = {
        url: window.location.href,
        title: document.title,
        buttons: [],
        modals: [],
        overlays: [],
        inputs: [],
    };

    // All buttons
    document.querySelectorAll('button, [role="button"], a.btn').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            result.buttons.push({
                text: el.textContent.trim().substring(0, 60),
                tag: el.tagName,
                visible: rect.width > 0,
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                zIndex: window.getComputedStyle(el).zIndex,
            });
        }
    });

    // All inputs
    document.querySelectorAll('input').forEach(el => {
        const rect = el.getBoundingClientRect();
        result.inputs.push({
            name: el.name,
            type: el.type,
            value: el.value ? '(has value)' : '(empty)',
            placeholder: el.placeholder,
            visible: rect.width > 0 && rect.height > 0,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
        });
    });

    // Check for modal/overlay elements
    document.querySelectorAll('[class*="modal"], [class*="overlay"], [class*="dialog"], [class*="popup"], [role="dialog"], [role="alertdialog"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
            result.modals.push({
                tag: el.tagName,
                class: el.className.substring(0, 80),
                text: el.textContent.trim().substring(0, 200),
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                zIndex: style.zIndex,
            });
        }
    });

    // Check for any fixed/absolute positioned elements that might be overlays
    document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if ((style.position === 'fixed' || style.position === 'absolute') &&
            parseInt(style.zIndex) > 100) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 100 && rect.height > 100) {
                result.overlays.push({
                    tag: el.tagName,
                    class: el.className.toString().substring(0, 80),
                    text: el.textContent.trim().substring(0, 150),
                    zIndex: style.zIndex,
                    position: style.position,
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    w: Math.round(rect.width),
                    h: Math.round(rect.height),
                });
            }
        }
    });

    return JSON.stringify(result, null, 2);
})()
"""})

data = json.loads(r["result"]["result"]["value"])
print(f"\nURL: {data['url']}")
print(f"Title: {data['title']}")

print(f"\n--- INPUTS ({len(data['inputs'])}) ---")
for inp in data["inputs"]:
    if inp["visible"]:
        print(f"  [{inp['type']}] name={inp['name']} placeholder={inp['placeholder']} value={inp['value']} @ ({inp['x']},{inp['y']})")

print(f"\n--- BUTTONS ({len(data['buttons'])}) ---")
for btn in data["buttons"]:
    print(f"  [{btn['tag']}] \"{btn['text'][:40]}\" @ ({btn['x']},{btn['y']}) {btn['w']}x{btn['h']} z={btn['zIndex']}")

print(f"\n--- MODALS ({len(data['modals'])}) ---")
for m in data["modals"]:
    print(f"  [{m['tag']}] class={m['class'][:50]} z={m['zIndex']}")
    print(f"    text: {m['text'][:150]}")

print(f"\n--- OVERLAYS (zIndex>100) ({len(data['overlays'])}) ---")
for o in data["overlays"]:
    print(f"  [{o['tag']}] class={o['class'][:50]} z={o['zIndex']} pos={o['position']} {o['w']}x{o['h']}")
    print(f"    text: {o['text'][:100]}")

ws.close()
