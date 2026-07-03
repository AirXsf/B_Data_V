'''
Date: 2026-06-23 10:46:27
LastEditors: wangbiao
Description: 
LastEditTime: 2026-07-03 16:03:47
'''
import json
with open('response.json') as f:
    data = json.load(f)
analytics = data['analyticsResult']
for d in analytics['trendData']:
    print(d)
