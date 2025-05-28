const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');

const FILE_NAME = 'auto-generated.js';
const FILE_CONTENT = `
// 🔧 Сгенерировано автоматически
console.log("🧠 Ghostline Agent Activated");
`;

(async () => {
  const git = simpleGit();

  try {
    // Шаг 1: Создание нового файла
    const fullPath = path.join(__dirname, FILE_NAME);
    fs.writeFileSync(fullPath, FILE_CONTENT, 'utf-8');
    console.log(`✅ Создан файл: ${FILE_NAME}`);

    // Шаг 2: Добавление, коммит и пуш
    await git.add(FILE_NAME);
    await git.commit('🚀 auto: create new code file');
    await git.push();
    console.log('📡 Изменения отправлены в GitHub');

  } catch (err) {
    console.error('❌ Ошибка:', err);
  }
})();
