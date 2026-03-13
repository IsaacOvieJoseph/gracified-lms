import os

file_path = r'c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\backend\routes\auth.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the login route response
old_login = '''        bankDetails: user.bankDetails,
        payoutPreference: user.payoutPreference        
      },'''
new_login = '''        bankDetails: user.bankDetails,
        payoutPreference: user.payoutPreference,
        subscriptionPlan: user.subscriptionPlan
      },'''

# The trailing spaces might be tricky, so let's use a regex or just match what cat showed
import re

# Use a regex that ignores trailing whitespace on those specific lines
# Inside the user object
pattern = r'(payoutPreference: user\.payoutPreference)\s*(\n\s*\})'
replacement = r'\1,\n        subscriptionPlan: user.subscriptionPlan\2'

new_content = re.sub(pattern, replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
