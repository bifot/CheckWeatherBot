var urlDb = "mongodb://localhost:27017/weather";

var token = "TOKEN_TELEGRAM_BOT"; // @BotFather
var tokenWeather = "TOKEN_WEATHER_API"; // http://openweathermap.org/api
var tokenTranslate = "TOKEN_TRANSLATE_YANDEX_API"; // https://tech.yandex.ru/keys/get/

var TelegramBot = require("node-telegram-bot-api");
var req = require("sync-request");
var petrovich = require("petrovich");
var MongoClient = require('mongodb').MongoClient;
var assert = require("assert");

var bot = new TelegramBot(token, { polling: true });

console.log("Бот запущен...\n");

// Слово с большой буквы

var toUpperChar = word => {
  var wordUpperChar = word.substr(0, 1).toUpperCase() + word.substr(1);

  return wordUpperChar;
};

// Переводчик

var translate = (text, lang) => {
  var url = "https://translate.yandex.net/api/v1.5/tr.json/translate?key=" + tokenTranslate
            + "&text=" + encodeURIComponent(text.replace(" ", "-")) + "&lang=" + lang + "&format=plain";

  // Ссылка на запрос
  // console.log(url);

  var res = req("GET", url);
  var body = JSON.parse(res.getBody());
  
  // Выводим перевод
  // console.log(text + " => " + body.text[0]);

  return body.text[0];
};

// Склоняем слово в нужный падеж

var declension = (word, falling) => {
  var cityDeclension = {
    gender: "male",
    first: word
  };

  var cityHuman = toUpperChar(petrovich(cityDeclension, falling).first);

  return cityHuman;
};

// Парсим погоду

var getWeather = city => {
  var url = "http://api.openweathermap.org/data/2.5/weather?q=" + city + "&units=metric&appid=" + tokenWeather;

  // Ссылка на запрос
  // console.log(url);

  var res = req("GET", url);

  if (res.statusCode == 200) {
    var body = JSON.parse(res.getBody());
    
    var results = {
      "temp": body.main.temp,
      "tempMin": body.main.temp_min,
      "tempMax": body.main.temp_max, 
      "windSpeed": body.wind.speed,
      "weatherMain": body.weather[0].main,
      "country": body.sys.country,
      "city": body.name
    };

    // Склоняем город в предложный падеж, возвращаем с большой буквы

    var city = toUpperChar(results.city);
    var cityHuman = declension(translate(city, "en-ru").replace("-", " "), "prepositional");

    // Добавляем эмодзи в зависимости от описания погоды

    switch (results.weatherMain) {
      case "Clear":
        results.weatherMainEmoji = "🌌";
        results.weatherMainRu = "Чистое небо";
        break;

      case "Rain":
        results.weatherMainEmoji = "☔";
        results.weatherMainRu = "Дождь";
        break;

      case "Mist":
      case "Haze":
      case "Fog":
        results.weatherMainEmoji = "🌫";
        results.weatherMainRu = "Туман";
        break;

      case "Snow":
        results.weatherMainEmoji = "❄";
        results.weatherMainRu = "Снег";
        break;

      case "Clouds":
        results.weatherMainEmoji = "☁";
        results.weatherMainRu = "Облачно";
        break;

      case "Drizzle":
        results.weatherMainEmoji = "🌧";
        results.weatherMainRu = "Небольшой дождь";
        break;

      default:
        results.weatherMainEmoji = "?";
        results.weatherMainRu = results.weatherMain;

        console.log(`Неизвестное описание погоды ${results.weatherMain}`);
    }

    // Возвращаем сообщение

    var msg = "*Погода в " + cityHuman + " (" + results.country + ") на сегодняшний день.*\n\n"
              + results.weatherMainEmoji + " Температура: *" + results.temp+ " °C (" + results.weatherMainRu + ")*\n"
              + results.weatherMainEmoji + " Мин. температура: *" + results.tempMin + " °C*\n"
              + results.weatherMainEmoji + " Макс. температура: *" + results.tempMax + " °C*\n\n"
              + "🌪 Ветер: *" + results.windSpeed + " м/с*";

    return msg;
  }

  return "Город не найден.";
};

bot.on("message", msg => {
  // Мониторинг сообщений
  console.log(`Пользователь ${msg.from.first_name} ${msg.from.last_name} (@${msg.from.username}) написал «${msg.text}»`);

  switch (msg.text) {
    case "/start":
      var settings = {
        parse_mode: "markdown"
      };

      var username = msg.from.first_name + " " + msg.from.last_name;

      bot.sendMessage(msg.from.id, "*Здравствуйте, " + username + "!*\n\n" + "Это бот для просмотра погоды. "
        + "Чтобы узнать погоду в каком-либо городе, достаточно написать его название в именительном падеже.\n\n"
        + "Дополнительные команды: /help, /remember, /weather\n\n"
        + "*Внимание: все следующие сообщения будут приняты за название города.*", settings);
      break;

    case "/help":
      var settings = {
        parse_mode: "markdown"
      };

      bot.sendMessage(msg.from.id, "Бот предоставляется *«так как есть»*.\n\n"
        + "Написать разработчику по любым вопросам можно в личные сообщения (@bifot).", settings);
      break;

    case "/remember":
      var settings = {
        parse_mode: "markdown",
        reply_markup: JSON.stringify({
          force_reply: true
        })
      };

      bot.sendMessage(msg.from.id, "Вы можете записать свой город, чтобы не набирать его каждый раз.\n\n"
        + "Узнать погоду в вашем городе в дальнейшем можно по команде /weather.", settings)
        .then(send => {
          bot.onReplyToMessage(send.chat.id, send.message_id, message => {
            var settings = {
              parse_mode: "markdown"
            };

            var city = {};
            city[msg.from.id] = message.text;

            MongoClient.connect(urlDb, (err, db) => {
              assert.equal(null, err);

              console.log("Подключились к базе из /remember.");

              var users = db.collection("users");
           
              users.find().toArray((err, results) => {
                users.count((err, count) => {                  
                  
                  // Проверям наличие записей в базе

                  if (count) {
                    users.find().toArray((err, results) => {
                      for (userId in results) {
                        if (results[userId][msg.from.id]) {
                          console.log(`Город записан. Перезапишем ${message.text}.`);

                          users.update({}, { $set: city }, false, true);
                          return;
                        }
                      }

                      db.close();
                    });
                  } else {
                    console.log(`Город не записан. Записываем ${message.text}.`);

                    users.insert(city);
                    db.close();
                  }

                  console.log(`Записей в базе: ${count}`);
                });
              });
            });

            bot.sendMessage(msg.from.id, "Бот успешно записал, что вы живете в " + declension(message.text, "prepositional") + ".\n\n"
              + "Теперь вы можете посмотреть погоду в своем городе с помощью команды /weather.\n\n"
              + "Перезаписать город можно с помощью команды /remember.", settings);
          });
        });

      break;

    case "/weather":
      var getCity = new Promise((resolve, reject) => {
        MongoClient.connect(urlDb, (err, db) => {
          assert.equal(null, err);

          console.log("Подключились к базе из команды /weather.");

          var users = db.collection("users");

          users.find().toArray((err, results) => {
            for (var userId in results) {
              if (results[userId][msg.from.id]) {
                resolve(results[userId][msg.from.id]);
                return;
              }
            }

            if (!results.length) {
              reject("Город не записан. Воспользуйтесь командой /remember, чтобы записать город.");
            }
          });
        });
      });

      getCity
        .then(result => {
          var settings = {
            parse_mode: "markdown"
          };

          var message = getWeather(translate(result, "ru-en"), result);

          bot.sendMessage(msg.from.id, message, settings);
        })
        .catch(err => {
          var settings = {
            parse_mode: "markdown"
          };

          bot.sendMessage(msg.from.id, err, settings);
        });

      break;

    default:
      if (msg.reply_to_message) return; // Фиксим, чтобы бот не отвечал на сообщение к onReply
      
      var settings = {
        parse_mode: "markdown"
      };

      var message = getWeather(translate(msg.text, "ru-en"), msg.text);

      bot.sendMessage(msg.from.id, message, settings);
  }
});