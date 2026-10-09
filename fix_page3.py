import re

with open('apps/web/app/telegram/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handleOpenEdit function
new_handle = '''  const handleOpenEdit = (bot: TelegramBotDto) => {
    setEditingBot(bot);
  };'''

content = re.sub(r'const handleOpenEdit = \(bot: TelegramBotDto\) => \{[\s\S]*?setEditTestTokenResult\(null\);\n  \};', new_handle, content)

with open('apps/web/app/telegram/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("page.tsx handleOpenEdit fixed!")
