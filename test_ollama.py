import json
import urllib.request
import urllib.error

payload = {
    "model": "qwen2.5:1.5b",
    "messages": [
        {"role": "system", "content": "You are a contract analysis assistant. Return ONLY valid JSON."},
        {"role": "user", "content": "Extract features from this: The Purchase Price is $100."}
    ],
    "stream": False,
    "format": "json",
    "options": {
        "temperature": 0.3,
        "num_predict": 3000
    }
}
req = urllib.request.Request(
    "http://localhost:11434/api/chat",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        resp_json = json.loads(resp.read())
        print("Success:", resp_json.get("message", {}).get("content", ""))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode())
except Exception as e:
    print("Error:", e)
