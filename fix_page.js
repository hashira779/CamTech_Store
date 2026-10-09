const fs = require('fs');

// Fix supportsInlineQueries in add-bot-modal and edit-bot-modal
const addModalPath = 'apps/web/app/telegram/components/add-bot-modal.tsx';
let addModal = fs.readFileSync(addModalPath, 'utf-8');
addModal = addModal.replace(/supportsInlineQueries: data\.result\.supports_inline_queries === true,\n/g, '');
fs.writeFileSync(addModalPath, addModal, 'utf-8');

const editModalPath = 'apps/web/app/telegram/components/edit-bot-modal.tsx';
let editModal = fs.readFileSync(editModalPath, 'utf-8');
editModal = editModal.replace(/supportsInlineQueries: data\.result\.supports_inline_queries === true,\n/g, '');
fs.writeFileSync(editModalPath, editModal, 'utf-8');

// Fix page.tsx inline modals
const pagePath = 'apps/web/app/telegram/page.tsx';
let page = fs.readFileSync(pagePath, 'utf-8');

const addStart = page.indexOf('{isAddBotModalOpen && (');
const addEndMarker = '{/* ─── MODAL: EDIT TELEGRAM BOT ─────────────────────────────────────── */}';
const addEnd = page.indexOf(addEndMarker);

if (addStart !== -1 && addEnd !== -1) {
    page = page.substring(0, addStart) + '{/* ADD MODAL REPLACED */}\n' + page.substring(addEnd);
}

const editStart = page.indexOf('{editingBot && (');
const editEndMarker = '{/* ─── MODAL: BIND DESTINATION ──────────────────────────────────────── */}';
const editEnd = page.indexOf(editEndMarker);

if (editStart !== -1 && editEnd !== -1) {
    page = page.substring(0, editStart) + '{/* EDIT MODAL REPLACED */}\n' + page.substring(editEnd);
}

fs.writeFileSync(pagePath, page, 'utf-8');
console.log("Fixed page.tsx and modals.");
