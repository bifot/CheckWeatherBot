var token = "TOKEN_TELEGRAM_BOT"; // @BotFather
var tokenWeather = "TOKEN_WEATHER_API"; // http://openweathermap.org/api
var tokenTranslate = "TOKEN_TRANSLATE_YANDEX_API"; // https://tech.yandex.ru/keys/get/

var TelegramBot = require("node-telegram-bot-api");
var req = require("sync-request");
var petrovich = require("petrovich");

var bot = new TelegramBot(token, { polling: true });

console.log("Бот запущен...\n");

// Слово с большой буквы

var toUpperChar = (word) => {
  var wordUpperChar = word.substr(0, 1).toUpperCase() + word.substr(1);

  return wordUpperChar;
}

// Парсим погоду

var getWeather = (city, cityHuman) => {
  var url = "http://api.openweathermap.org/data/2.5/weather?q=" + city + "&units=metric&appid=" + tokenWeather;

  // Для отладки выводим ссылку на запрос
  // console.log(url);

  var res = req("GET", url);
  var body = JSON.parse(res.getBody());

  var results = {
    "temp": body.main.temp,
    "tempMin": body.main.temp_min,
    "tempMax": body.main.temp_max, 
    "windSpeed": body.wind.speed,
    "weatherMain": body.weather[0].main,
    "country": body.sys.country
  };

  // Склоняем город в предложный падеж, возвращаем с большой буквы

  var cityDeclension = {
    gender: "male",
    first: cityHuman
  };

  var cityHuman = toUpperChar(petrovich(cityDeclension, "prepositional").first);

  // Добавляем эмодзи в зависимости от описания погоды

  if (results.weatherMain == "Clear") {
    results.weatherMainEmoji = "🌌";
    results.weatherMainRu = "Чистое небо";
  } else if (results.weatherMain == "Rain") {
    results.weatherMainEmoji = "☔";
    results.weatherMainRu = "Дождь";
  } else if (results.weatherMain == "Mist" || results.weatherMain == "Haze" || results.weatherMain == "Fog") {
    results.weatherMainEmoji = "🌫";
    results.weatherMainRu = "Туман";
  } else if (results.weatherMain == "Snow") {
    results.weatherMainEmoji = "❄";
    results.weatherMainRu = "Снег";
  } else if (results.weatherMain == "Clouds") {
    results.weatherMainEmoji = "☁";
    results.weatherMainRu = "Облачно";
  } else {
    console.log(`Неизвестное описание погоды ${results.weatherMain}`);
  }

  // Возвращаем сообщение

  var msg = "*Погода в " + cityHuman + " (" + results.country + ") на сегодняшний день.*\n\n"
            + results.weatherMainEmoji + " Температура: *" + results.temp+ " °C (" + results.weatherMainRu + ")*\n"
            + results.weatherMainEmoji + " Мин. температура: *" + results.tempMin + " °C*\n"
            + results.weatherMainEmoji + " Макс. температура: *" + results.tempMax + " °C*\n\n"
            + "🌪 Ветер: *" + results.windSpeed + " м/с*";

  return msg;
};

// Переводчик

var translate = (text) => {
  var url = "https://translate.yandex.net/api/v1.5/tr.json/translate?key=" + tokenTranslate
            + "&text=" + encodeURIComponent(text) + "&lang=ru-en&format=plain";
  var res = req("GET", url);
  var body = JSON.parse(res.getBody());

  // Для отладки выводим перевод в консоль
  // console.log(text + " => " + body.text[0]);

  return body.text[0];
}

bot.on("message", (msg) => {
  // Мониторинг сообщений
  console.log(`Пользователь ${msg.from.first_name} ${msg.from.last_name} (@${msg.from.username}) написал «${msg.text}»`);

  if (msg.text == "/start") {
    var settings = {
      parse_mode: "markdown"
    };

    var username = msg.from.first_name + " " + msg.from.last_name;

    bot.sendMessage(msg.from.id, "*Здравствуйте, " + username + "!*\n\n" + "Это бот для просмотра погоды. "
      + "Чтобы узнать погоду в каком-либо городе, достаточно написать его название в именительном падеже.\n\n"
      + "Дополнительная команды: /help\n\n"
      + "*Внимание: все следующие сообщения будут приняты за название города.*", settings);
  } else if (msg.text == "/help") {
    var settings = {
      parse_mode: "markdown"
    };

    bot.sendMessage(msg.from.id, "Бот предоставляется «так как есть».\n\n"
      + "Написать разработчику по любым вопросам можно в личные сообщения (*@bifot*).", settings);
  } else {
    var settings = {
      parse_mode: "markdown"
    };

    var city = translate(msg.text);
    var message = getWeather(city, msg.text);

    bot.sendMessage(msg.from.id, message, settings);
  }
});