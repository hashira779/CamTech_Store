import re

with open('apps/web/app/telegram/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove resetBotForm
content = re.sub(r'const resetBotForm = \(\) => \{[\s\S]*?\};\n', '', content)

# 2. Remove calls to resetBotForm()
content = content.replace('resetBotForm();\n', '')
content = content.replace('resetBotForm();', '')

# 3. Remove editingBot block completely up to the BIND CHAT DESTINATION modal
edit_start = content.find('{editingBot && (')
if edit_start != -1:
    edit_end = content.find('{/* ─── MODAL: BIND CHAT DESTINATION', edit_start)
    if edit_end != -1:
        content = content[:edit_start] + '<EditBotModal bot={editingBot} onClose={() => setEditingBot(null)} />\n\n        ' + content[edit_end:]
    else:
        print("Could not find end marker for editingBot")
else:
    print("Could not find start marker for editingBot")

with open('apps/web/app/telegram/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("page.tsx fixed!")
