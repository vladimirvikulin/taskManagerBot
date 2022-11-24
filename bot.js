'use strict';

require('dotenv').config();
const {
  Telegraf,
  Markup,
} = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const { connectDatabase, users } = require('./db.js');
const myConsts = require('./consts');
connectDatabase();
let objDataBase;
const userTask = {
  list: [],
  text: '',
  id: 0,
};
let action = '';
bot.start(async (ctx) => {
  await ctx.reply(`Привет ${ctx.message.from.first_name}, этот бот создан для планировки задач.\nНапиши команду /help, чтобы узнать команды бота.`);
  const userExists = await users.findOne({ username: ctx.message.from.username });
  if (userExists === null) {
    users.insertOne({ username: `${ctx.message.from.username}`,
      chatId: `${ctx.chat.id}`,
      tasks: [] });
  }
});

bot.help((ctx) => ctx.reply(myConsts.commands));

bot.command('addTask', async (ctx) => {
  try {
    await addTask(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.command('myTasks', async (ctx) => {
  try {
    await myTasks(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.command('deleteTask', async (ctx) => {
  try {
    await deleteTask(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.command('updateTask', async (ctx) => {
  try {
    await isCompleted(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.on('text', async (ctx) => {
  userTask.text = ctx.message.text;
  userTask.id = Number(ctx.message.text) - 1;
  if (action === 'add') {
    await ctx.replyWithHTML(
      'Вы действительно хотите добавить задачу:\n\n' +
        `<i>${ctx.message.text}</i>`,
      yesNoKeyboard()
    );
  } else if (action === 'delete') {
    await ctx.replyWithHTML(
      'Вы действительно хотите удалить задачу №' +
      `<i>${userTask.id + 1}</i>`,
      yesNoKeyboard()
    );
  } else if (action === 'isCompleted') {
    await ctx.replyWithHTML(
      'Вы действительно хотите установить или убрать отметку готовности задачи №' +
      `<i>${userTask.id + 1}</i>`,
      yesNoKeyboard()
    );
  } else {
    await ctx.reply('Неизвестная команда, напишите /help, чтоб узнать список команд');
  }
});

async function updateLocalData(ctx) {
  objDataBase = await users.findOne({ chatId: String(ctx.chat.id) });
  userTask.list = objDataBase.tasks;
}

async function addTask(ctx) {
  updateLocalData(ctx);
  await ctx.reply('Напишите задачу');
  action = 'add';
}

async function myTasks(ctx) {
  updateLocalData(ctx);
  const tasks = await new Promise((resolve) => {
    setTimeout(() => {
      resolve(userTask.list);
    }, 300);
  });
  let result = '';
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].isCompleted)  result += `${i + 1}. ${tasks[i].taskName} ✅\n`;
    else result += `${i + 1}. ${tasks[i].taskName} 🔴\n`;
  }
  if (result === '') {
    ctx.replyWithHTML(
      '<b>Список ваших задач пуст</b>'
    );
  } else {
    ctx.replyWithHTML(
      '<b>Список ваших задач:</b>\n\n' +
      `${result}`
    );
  }
}

async function deleteTask(ctx) {
  updateLocalData(ctx);
  await ctx.replyWithHTML(
    'Введите порядковый номер задачи, например <b> "5" </b>,чтобы удалить задачу №5'
  );
  action = 'delete';
}

async function isCompleted(ctx) {
  updateLocalData(ctx);
  await ctx.replyWithHTML(
    'Введите порядковый номер задачи, например <b> "5" </b>,чтобы обновить статус задачи №5'
  );
  action = 'isCompleted';
}

function yesNoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Да', 'yes')],
    [Markup.button.callback('Нет', 'no')]
  ]);
}

bot.action(['yes', 'no'], async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.callbackQuery.data === 'yes' && action === 'add') {
    userTask.list.push({ taskName: userTask.text, isCompleted: false });
    await users.updateOne(
      { chatId: String(ctx.chat.id) },
      {
        $set: {
          tasks: userTask.list
        }
      }
    );
    action = '';
    await ctx.editMessageText('Ваша задача успешно добавлена');
  } else if (ctx.callbackQuery.data === 'yes' && action === 'delete') {
    userTask.list.splice(userTask.id, 1);
    users.updateOne(
      { chatId: String(ctx.chat.id) },
      {
        $set: {
          tasks: userTask.list
        }
      }
    );
    action = '';
    await ctx.editMessageText('Ваша задача успешно удалена');
  } else if (ctx.callbackQuery.data === 'yes' && action === 'isCompleted') {
    userTask.list[userTask.id].isCompleted = !userTask.list[userTask.id].isCompleted;
    users.updateOne(
      { chatId: String(ctx.chat.id) },
      {
        $set: {
          tasks: userTask.list
        }
      }
    );
    action = '';
    await ctx.editMessageText('Статус вашей задачи успешно обновлен');
  } else {
    await ctx.deleteMessage();
  }
});

bot.command('menu', async (ctx) => {
  await ctx.replyWithHTML('<b>Меню планировщика</b>', Markup.inlineKeyboard(
    [
      [Markup.button.callback('Мои задачи', 'myTasks')],
      [Markup.button.callback('Добавить задачу', 'addTask')],
      [Markup.button.callback('Удалить задачу', 'deleteTask')],
    ]
  ));
});

bot.action('myTasks', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await myTasks(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.action('addTask', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await addTask(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.action('deleteTask', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await deleteTask(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
