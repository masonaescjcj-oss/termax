import urllib.request
import json
import os

def test_model(model_name):
    print(f"Testing model: {model_name}...")
    req_body = {
        "model": model_name,
        "messages": [{"role": "user", "content": "Ping"}]
    }
    
    req = urllib.request.Request(
        'https://router.bynara.id/v1/chat/completions',
        data=json.dumps(req_body).encode('utf-8'),
        headers={
            'Authorization': f"Bearer {os.environ['AI_API_KEY']}",
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            res_data = json.loads(html)
            print(f"Success! Model {model_name} responded:")
            print(res_data['choices'][0]['message']['content'])
            return True
    except Exception as e:
        print(f"Error testing model {model_name}: {e}")
        if hasattr(e, 'read'):
            print("Response:", e.read().decode('utf-8'))
        return False

# Test both models
test_model('mimo-v2.5-pro-free')
print("-" * 40)
test_model('mimo-v2.5-free')
