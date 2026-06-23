import json
with open('response.json') as f:
    data = json.load(f)
analytics = data['analyticsResult']
for d in analytics['trendData']:
    print(d)
