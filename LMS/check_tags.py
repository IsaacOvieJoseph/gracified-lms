
import re

file_path = 'c:/Users/user/Desktop/LMS/gracified-lms/LMS/frontend/src/components/Layout.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

content = "".join(lines)

# Tag counter with line info
tags = []
for i, line in enumerate(lines):
    # Find all open and close tags in this line
    matches = re.finditer(r'<([a-zA-Z0-9]+)|</([a-zA-Z0-9]+)>', line)
    for m in matches:
        open_tag = m.group(1)
        close_tag = m.group(2)
        if open_tag:
            tags.append({'type': 'open', 'tag': open_tag, 'line': i+1})
        else:
            tags.append({'type': 'close', 'tag': close_tag, 'line': i+1})

stack = []
tracked = ['div', 'header', 'nav', 'Link', 'span', 'h1', 'h2', 'p', 'button', 'form', 'section']
self_closing = ['img', 'br', 'hr', 'input', 'Bell', 'LogOut', 'Menu', 'X', 'SchoolSwitcher', 'FeedbackManager', 'SubscriptionBlockBanner', 'LogOut', 'Book', 'Users', 'DollarSign', 'FileText', 'LayoutDashboard', 'Landmark', 'MessageSquare', 'BarChart2', 'Loader2', 'GoogleMeetAuth', 'FeedbackPopup']

for item in tags:
    tag = item['tag']
    if item['type'] == 'open':
        if tag in self_closing:
            continue
        if tag in tracked:
            stack.append(item)
    else:
        if tag in tracked:
            if not stack:
                print(f"Error: Unexpected closing tag </{tag}> at line {item['line']}")
            else:
                last = stack.pop()
                if last['tag'] != tag:
                    print(f"Error: Mismatched tag at line {item['line']}. Expected </{last['tag']}> (opened at line {last['line']}) but got </{tag}>")

if stack:
    for item in stack:
        print(f"Error: Unclosed tag <{item['tag']}> opened at line {item['line']}")
else:
    print("Tags look balanced (for tracked tags)")
