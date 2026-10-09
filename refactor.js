const fs = require('fs');
const path = require('path');

const filePath = 'apps/web/app/telegram/page.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(/\/\/ Add Bot Form[\s\S]*?const \[isTestingToken, setIsTestingToken\] = useState\(false\);/, '');
content = content.replace(/\/\/ Edit Bot Form[\s\S]*?const \[isTestingEditToken, setIsTestingEditToken\] = useState\(false\);/, '');

content = content.replace(/const createBotMutation = useMutation\(\{[\s\S]*?onError: \(err: any\) => \{[\s\S]*?\},[\s\S]*?\}\);/, '');
content = content.replace(/const updateBotMutation = useMutation\(\{[\s\S]*?onError: \(err: any\) => \{[\s\S]*?\},[\s\S]*?\}\);/, '');

content = content.replace(/const handleTestToken = async \(\) => \{[\s\S]*?setIsTestingToken\(false\);[\s\S]*?\}[\s\S]*?\};/, '');
content = content.replace(/const handleTestEditToken = async \(\) => \{[\s\S]*?setIsTestingEditToken\(false\);[\s\S]*?\}[\s\S]*?\};/, '');

const addModalRegex = /\{\/\* ─── MODAL: ADD TELEGRAM BOT ────────────────────────────────────── \*\/\}([\s\S]*?)\{\/\* ─── MODAL: EDIT TELEGRAM BOT ─────────────────────────────────────── \*\/\}/;
content = content.replace(addModalRegex, `<AddBotModal isOpen={isAddBotModalOpen} onClose={() => setIsAddBotModalOpen(false)} />\n\n        {/* ─── MODAL: EDIT TELEGRAM BOT ─────────────────────────────────────── */}`);

const editModalRegex = /\{\/\* ─── MODAL: EDIT TELEGRAM BOT ─────────────────────────────────────── \*\/\}([\s\S]*?)\{\/\* ─── MODAL: BIND DESTINATION ──────────────────────────────────────── \*\/\}/;
content = content.replace(editModalRegex, `<EditBotModal bot={editingBot} onClose={() => setEditingBot(null)} />\n\n        {/* ─── MODAL: BIND DESTINATION ──────────────────────────────────────── */}`);

if (!content.includes("import { AddBotModal }")) {
  content = content.replace("import { EnterpriseShell }", "import { AddBotModal } from './components/add-bot-modal';\nimport { EditBotModal } from './components/edit-bot-modal';\nimport { EnterpriseShell }");
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Refactoring applied");
