import os
import glob
import re

scripts_dir = "scripts"
password_pattern = r'pTT!CT01'

for root, _, files in os.walk(scripts_dir):
    for file in files:
        if file.endswith(".py"):
            filepath = os.path.join(root, file)
            with open(filepath, "r") as f:
                content = f.read()
            
            if password_pattern in content:
                # Add import os if not there
                if "import os" not in content:
                    content = "import os\n" + content
                
                # Replace assignment if it exists
                content = content.replace('PASSWORD = os.getenv("CAMTECH_PASS")
if not PASSWORD:
    raise ValueError("Set CAMTECH_PASS environment variable")', 'PASSWORD = os.getenv("CAMTECH_PASS")\nif not PASSWORD:\n    raise ValueError("Set CAMTECH_PASS environment variable")')
                content = content.replace('password=os.getenv("CAMTECH_PASS")', 'password=os.getenv("CAMTECH_PASS")')
                content = content.replace('password = os.environ.get("CAMTECH_PASS")', 'password = os.environ.get("CAMTECH_PASS")')
                content = content.replace('password = env.get("CAMTECH_PASS")', 'password = env.get("CAMTECH_PASS")')
                content = content.replace('echo \'pTT!CT01\'', 'echo \'$CAMTECH_PASS\'')

                with open(filepath, "w") as f:
                    f.write(content)
                print(f"Fixed {filepath}")

# Docs replacement
doc_path = "docs/deployment/direct-sync-guide.md"
if os.path.exists(doc_path):
    with open(doc_path, "r") as f:
        doc_content = f.read()
    if password_pattern in doc_content:
        doc_content = doc_content.replace('`pTT!CT01`', '`$CAMTECH_PASS`')
        with open(doc_path, "w") as f:
            f.write(doc_content)
        print(f"Fixed {doc_path}")
