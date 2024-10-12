const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const mysql = require('mysql2/promise');  // Используем promise-версию


// Настройки Chrome
let options = new chrome.Options();
options.addArguments('--headless');  // Запуск без интерфейса

// Функция подключения к базе данных
async function connectToDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',     // Укажите своего пользователя
    password: '',  // Укажите свой пароль
    database: 'dota'  // Название базы данных
  });
  return connection;
}

async function insertTeamName(teamName) {
  const connection = await connectToDatabase();
  try {
    await connection.execute('INSERT INTO name_teams (team_name) VALUES (?)', [teamName]);
    console.log(`Команда ${teamName} добавлена в базу данных.`);
  } catch (error) {
    console.error(`Ошибка при добавлении команды ${teamName} в БД:`, error);
  } finally {
    await connection.end();
  }
}

// Функция для получения id_team по названию команды
async function getTeamIdByName(teamUrl) {
  const connection = await connectToDatabase();
  console.log('Подключение к базе данных успешно');

  if (!connection) {
    console.error('Ошибка при подключении к базе данных.');
    return null;
  }

  try {
    const [rows] = await connection.execute('SELECT id FROM name_teams WHERE team_name = ?', [teamUrl]);
    console.log(`Результат запроса для ${teamUrl}:`, rows);  // Логируем результат запроса
    if (rows.length > 0) {
      console.log(`id команды: ${rows[0].id}`);
      return rows[0].id;
    } else {
      console.warn(`Команда ${teamUrl} не найдена в базе данных.`);
      return null;
    }
  } catch (error) {
    console.error(`Ошибка при получении id_team для команды ${teamUrl}:`, error);
    return null;
  } finally {
    await connection.end();
    console.log('Соединение с базой данных закрыто');
  }
}



// Функция для записи результатов турнира команды в таблицу
async function insertTournamentResult(id_team, teamName, tournamentName, place) {
  const connection = await connectToDatabase();
  try {
    await connection.execute('INSERT INTO result_tournaments_team (id_team, name_team, name_tournaments, place) VALUES (?, ?, ?, ?)', [id_team, teamName, tournamentName, place]);
    console.log(`Результаты турнира для команды ${teamName} успешно добавлены.`);
  } catch (error) {
    console.error(`Ошибка при добавлении результатов турнира для команды ${teamName}:`, error);
  } finally {
    await connection.end();
  }
}

async function insertPlayersResult(id_team, teamUrl, playerUrl, validPosition) {
  const connection = await connectToDatabase();
  try {
    await connection.execute('INSERT INTO team_composition (id_team, name_team, name_player, position) VALUES (?, ?, ?, ?)', [id_team, teamUrl, playerUrl, validPosition]);
    console.log(`Результаты игрока ${playerUrl} команды ${teamUrl} успешно добавлены.`);
  } catch (error) {
    console.error(`Ошибка при добавлении результатов игрока ${playerUrl} для команды ${teamName}:`, error);
  } finally {
    await connection.end();
    
  }
}

async function getAllTeamNames() {
  const connection = await connectToDatabase();
  try {
    // Извлекаем все названия команд из базы данных
    const [rows] = await connection.execute('SELECT team_name FROM name_teams');
    if (rows.length > 0) {
      return rows.map(row => row.team_name);  // Возвращаем массив с названиями команд
    } else {
      console.error('Названия команд не найдены в базе данных.');
      return [];
    }
  } catch (error) {
    console.error('Ошибка при получении названий команд из БД:', error);
    return [];
  } finally {
    await connection.end();
  }
}

// Функция для извлечения результатов команды и записи в базу данных
async function getTeamResults(teamUrl) {
  let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    // Переходим на страницу результатов команды
    await driver.get(`https://liquipedia.net/dota2/${teamUrl}/Results`);
    await driver.sleep(3000);  // Задержка для полной загрузки страницы

    // Извлекаем результаты (например, последние несколько матчей)
    let results = await driver.findElements(By.css('.wikitable tbody tr'));
    let teamName = teamUrl.split('/').pop();  // Извлекаем название команды

    // Получаем id_team из таблицы name_teams
    const id_team = await getTeamIdByName(teamName);
    if (!id_team) return;

    for (let result of results.slice(0, 5)) {  // Парсим только последние 5 матчей
      let resultText = await result.getText();
      console.log(resultText);  // Выводим результат
      
      // Пример: парсинг текста результата
      // Ожидается что формат результата: "2024-09-15 1st Tier 1 The International 2024 3:0 $1,170,965"
      let parts = resultText.split(' ');
      let tournamentName = parts.slice(3, 6).join(' ');  // Извлекаем название турнира
      let place = parts[1];  // Извлекаем место (например, 1st)

      // Записываем результат в таблицу result_tournaments_team
   
      await insertTournamentResult(id_team, teamName, tournamentName, place);
    }
  } catch (error) {
    console.error(`Ошибка при парсинге результатов команды ${teamUrl}:`, error);
  } finally {
    await driver.quit();
  }
}

async function scrapeTeam() {
  try {
    const teamNames = await getAllTeamNames();  // Получаем все названия команд из БД
    console.log(`Всего команд${teamNames.length}`)
    if (teamNames.length > 0) {
      for (let teamName of teamNames) {
        console.log(`Обрабатываем команду: ${teamName}`);
        await scrapeTeamComposition(teamName);  // Передаём название команды в scrapeTeamComposition
      }
    } else {
      console.error('Не удалось получить названия команд.');
    }
  } catch (error) {
    console.error('Ошибка при выполнении scrapeAllTeams:', error);
  }
}


async function scrapeTeamComposition(teamName) {
  let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    // Переходим на страницу команды
    await driver.get(`https://liquipedia.net/dota2/${teamName}`);
    await driver.sleep(3000);  // Ждем, пока загрузится страница

    // Находим всех игроков из таблицы с классом roster-card
    let playerLinks = await driver.findElements(By.css('.wikitable.wikitable-striped.roster-card a'));  // Селектор для ссылок на игроков

    for (let i = 0; i < playerLinks.length; i++) {
      // Обновляем список элементов, чтобы избежать stale element reference
      playerLinks = await driver.findElements(By.css('.wikitable.wikitable-striped.roster-card a'));
      
      let playerLink = playerLinks[i];
      let playerUrl = await playerLink.getAttribute('href');
      playerUrl = playerUrl.split('/').pop();  // Извлекаем имя игрока из URL

      console.log(`Переход на страницу игрока: ${playerUrl}, команды ${teamName}`);


      // Переходим на страницу игрока и получаем данные
      await getPlayerInfo(playerUrl, teamName, driver);

      // Возвращаемся обратно на страницу команды
      await driver.navigate().back();
      await driver.sleep(3000);  // Ждем, пока загрузится страница команды
    }

  } catch (error) {
    console.error('Произошла ошибка при парсинге состава команды:', error);
  } finally {
    await driver.quit();  // Закрываем браузер после завершения работы
  }
}

async function getPlayerInfo(playerUrl, teamName, driver) {
  try {
    // Переходим на страницу игрока
    await driver.get(`https://liquipedia.net/dota2/${playerUrl}`);
    await driver.sleep(3000);  // Ждем, пока загрузится страница

    // Извлекаем все позиции игрока
    let positionElements = await driver.findElements(By.css('.fo-nttax-infobox div[style="width:50%"] a'));  // Селектор для всех ссылок с позициями

    // Список допустимых позиций
    const validPositions = ['Support', 'Offlaner', 'Carry', 'Solo Middle'];
    let validPosition = null;

    // Ищем первую валидную позицию
    for (let positionElement of positionElements) {
      let position = await positionElement.getText();
      if (validPositions.includes(position)) {
        validPosition = position;  // Найдена валидная позиция
        break;  // Останавливаем цикл
      }
    }

    if (!validPosition) {
      console.log(`Валидная позиция для игрока ${playerUrl} не найдена`);
      return;  // Если валидная позиция не найдена, прекращаем выполнение
    }

    console.log(`Игрок: ${playerUrl}, Позиция: ${validPosition}`);
    console.log(`Значение переменной teamName ${teamName}`);
    let teamUrl = teamName;

    // Получаем id_team и teamName для сохранения в БД
    const id_team = await getTeamIdByName(teamUrl);  // Пример получения id_team
    console.log(`Получен id_team: ${id_team}`);
    if (!id_team) return;

    // Записываем состав команды в таблицу team_composition
    console.log("Записываем данные в таблицу");
    await insertPlayersResult(id_team, teamUrl, playerUrl, validPosition);

  } catch (error) {
    console.error(`Ошибка при парсинге данных игрока ${playerUrl}:`, error);  }
}



// Функция для парсинга участников турнира
async function scrapeParticipants() {
  let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    // Переходим на страницу турнира
    await driver.get('https://liquipedia.net/dota2/PGL/Wallachia/2');
    await driver.sleep(3000);  // Ждем, пока загрузятся данные

    // Находим участников (селектор для таблицы с командами)
    let teams = await driver.findElements(By.css('.teamcard center a'));  // Селектор для ссылок на команды

    for (let team of teams) {
      let teamUrl = await team.getAttribute('href');

      if (teamUrl.includes('/Category')) {
        console.log('Пропущена категория:', teamUrl);
        continue;  // Пропустить ссылки на категории
      }

      teamUrl = teamUrl.split('/').pop();  // Извлекаем название команды (например, Team_Liquid)

      console.log(`Получение результатов для команды: ${teamUrl}`);

      await insertTeamName(teamUrl); // добавление команды в бд
      await getTeamResults(teamUrl);  // Получаем результаты для каждой команды
      
    }

  } catch (error) {
    console.error('Произошла ошибка при парсинге участников:', error);
  } finally {
    await driver.quit();
  }
}

// scrapeParticipants();
scrapeTeam();




