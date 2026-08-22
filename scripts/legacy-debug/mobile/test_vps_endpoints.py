import paramiko

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=username, password=password, timeout=30)

cmd = '''python3 -c "
import urllib.request, json
urls = [
    'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    'https://api1.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    'https://api2.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    'https://api3.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    'https://api.binance.us/api/v3/ticker/price?symbol=BTCUSDT',
    'https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT',
    'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=BTC-USDT',
    'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=5'
]
for u in urls:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req, timeout=5)
        print('SUCCESS:', u, '->', res.read().decode()[:80])
    except Exception as e:
        print('FAILED:', u, '->', e)
"'''

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))
ssh.close()
