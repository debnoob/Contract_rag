import requests
files = {'file': ('test.pdf', b'fake pdf content', 'application/pdf')}
data = {'insurer': 'General', 'category': 'Policy'}
r = requests.post('http://127.0.0.1:8000/api/upload', files=files, data=data)
print(r.status_code, r.text)
