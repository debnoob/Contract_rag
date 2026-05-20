import urllib.request
import urllib.error
import json
req = urllib.request.Request("http://localhost:11434/api/chat", method="POST", data=b"invalid")
try:
    with urllib.request.urlopen(req) as r:
        pass
except Exception as e:
    print(type(e))
    print(e)
