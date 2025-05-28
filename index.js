const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

// Путь к файлу, который агент будет обновлять
const FILE_PATH = path.join(__dirname, 'main.js');

// Пример нового содержимого
const GENERATED_CODE = `
console.log("🔧 AUTO-CODE: Updated by ghostline-agent-engineer");
`;

// Основной запуск
(async () => {
  const git = simpleGit();

  try {
    // Шаг 1: Генерация нового содержимого
    fs.writeFileSync(FILE_PATH, GENERATED_CODE, 'utf-8');
    console.log('✅ Файл main.js обновлён.');

    // Шаг 2: Git add, commit, push
    await git.add('./*');
    await git.commit('🔄 auto: update main.js');
    await git.push();
    console.log('🚀 Изменения запушены в GitHub.');

  } catch (err) {
    console.error('❌ Ошибка при обновлении и пуше:', err);
  }
})();
