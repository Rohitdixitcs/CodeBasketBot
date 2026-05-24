require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// =======================
// CRASH PROTECTION
// =======================

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// =======================
// BOT CONFIG
// =======================

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

const ADMIN_ID = String(process.env.ADMIN_ID);

const MAIN_CHANNEL = "@codebasketofficial";
const DISCUSSION_GROUP = "@codebasket";

// =======================
// MEMORY
// =======================

const pendingOrders = {};

// =======================
// LOAD JSON FILES
// =======================

function loadJSON(file, defaultData) {

  if (!fs.existsSync(file)) {

    fs.writeFileSync(
      file,
      JSON.stringify(defaultData, null, 2)
    );

    return defaultData;

  }

  return JSON.parse(
    fs.readFileSync(file)
  );

}

function saveJSON(file, data) {

  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );

}

let userOrders =
  loadJSON('orders.json', {});

let referrals =
  loadJSON('referrals.json', {});

let users =
  loadJSON('users.json', []);

let stats =
  loadJSON('stats.json', {
    totalOrders: 0,
    totalRevenue: 0
  });

// =======================
// PRODUCT
// =======================

const product = {

  name: "🛒 BigBasket ₹100 OFF",

  file: "bigbasket.txt",

  price: 6,

  details:
`🛒 BigBasket Offer

💰 ₹100 OFF on ₹100+

🍫 Valid on Chocolate / Ice Cream Orders

🆕 Valid only for users who never ordered from BigBasket before

⚠ Coupon may not work on old/existing accounts`

};

// =======================
// HELPER FUNCTIONS
// =======================

function getCodes(file) {

  if (!fs.existsSync(file)) {

    return [];

  }

  return fs.readFileSync(
    file,
    'utf-8'
  )
  .split('\n')
  .filter(code => code.trim() !== '');

}

function getStock(file) {

  return getCodes(file).length;

}

// =======================
// FORCE JOIN CHECK
// =======================

async function checkJoin(chatId) {

  try {

    const main =
      await bot.getChatMember(
        MAIN_CHANNEL,
        chatId
      );

    const group =
      await bot.getChatMember(
        DISCUSSION_GROUP,
        chatId
      );

    const mainJoined =
      ['member', 'administrator', 'creator']
      .includes(main.status);

    const groupJoined =
      ['member', 'administrator', 'creator']
      .includes(group.status);

    return (
      mainJoined &&
      groupJoined
    );

  } catch {

    return false;

  }

}

// =======================
// START COMMAND
// =======================

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {

  const chatId = String(msg.chat.id);

  const referrerId = match[1];

  // SAVE USER

  if (!users.includes(chatId)) {

    users.push(chatId);

    saveJSON(
      'users.json',
      users
    );

  }

  // FORCE JOIN

  const joined =
    await checkJoin(chatId);

  if (!joined) {

    return bot.sendMessage(
      chatId,
`🚫 Please join both channels first.`,
{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text: "📢 Join Channel",
          url: "https://t.me/codebasketofficial"
        }
      ],

      [
        {
          text: "💬 Join Discussion",
          url: "https://t.me/codebasket"
        }
      ],

      [
        {
          text: "✅ Verify Join",
          callback_data: "verify_join"
        }
      ]

    ]
  }
}
    );

  }

  // =======================
  // REFERRAL SYSTEM
  // =======================

  if (
    referrerId &&
    referrerId !== chatId
  ) {

    if (!referrals[referrerId]) {

      referrals[referrerId] = [];

    }

    if (
      !referrals[referrerId].includes(chatId)
    ) {

      referrals[referrerId].push(chatId);

      saveJSON(
        'referrals.json',
        referrals
      );

      // FREE COUPON AFTER 5 REFERRALS

      if (
        referrals[referrerId].length % 5 === 0
      ) {

        const codes =
          getCodes(product.file);

        if (codes.length > 0) {

          const freeCode = codes[0];

          const remaining =
            codes.slice(1);

          fs.writeFileSync(
            product.file,
            remaining.join('\n')
          );

          bot.sendMessage(
            referrerId,
`🎉 Congratulations!

🎁 You completed 5 referrals.

FREE Coupon:

${freeCode}`
          );

        }

      }

    }

  }

  const referralCount =
    referrals[chatId]
      ? referrals[chatId].length
      : 0;

  bot.sendMessage(
    chatId,
`${product.details}

💵 Price:
₹${product.price} per code

👥 Referrals:
${referralCount}/5

🔗 Your Referral Link:
https://t.me/codebasketbot?start=${chatId}

🛍 Choose Option Below`,
{
  reply_markup: {
    keyboard: [
      ["🛒 Buy Coupon", "📊 Stock"],
      ["👥 Referrals", "📦 My Orders"],
      ["📞 Support", "👤 Owner"]
    ],
    resize_keyboard: true
  }
}
  );

});

// =======================
// ADMIN PANEL
// =======================

bot.onText(/\/admin/, (msg) => {

  const chatId = String(msg.chat.id);

  if (chatId !== ADMIN_ID) {

    return bot.sendMessage(
      chatId,
      "❌ Access Denied"
    );

  }

  bot.sendMessage(
    chatId,
`🔐 ADMIN PANEL

👥 Users:
${users.length}

📦 Orders:
${stats.totalOrders}

💰 Revenue:
₹${stats.totalRevenue}

🎟 Stock:
${getStock(product.file)}

👥 Referrals:
${Object.keys(referrals).length}`,
{
  reply_markup: {
    keyboard: [
      ["📊 Stats", "📦 Orders"],
      ["🎟 Stock"],
      ["🛒 Buy Coupon"]
    ],
    resize_keyboard: true
  }
}
  );

});

// =======================
// MAIN MESSAGE HANDLER
// =======================

bot.on('message', async (msg) => {

  if (!msg.text) return;

  const chatId = String(msg.chat.id);

  if (msg.text.startsWith('/start')) return;

  // =======================
  // ADMIN BUTTONS
  // =======================

  if (msg.text === "📊 Stats") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`📊 BOT STATS

👥 Users:
${users.length}

📦 Orders:
${stats.totalOrders}

💰 Revenue:
₹${stats.totalRevenue}

🎟 Stock:
${getStock(product.file)}`
    );

  }

  if (msg.text === "📦 Orders") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`📦 Total Orders:
${stats.totalOrders}`
    );

  }

  if (msg.text === "🎟 Stock") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`🎟 Current Stock:
${getStock(product.file)}`
    );

  }

  // =======================
  // USER BUTTONS
  // =======================

  if (msg.text === "📞 Support") {

    return bot.sendMessage(
      chatId,
      "📞 Support: @Coderboyxx"
    );

  }

  if (msg.text === "👤 Owner") {

    return bot.sendMessage(
      chatId,
      "👤 Owner: @Coderboyxx"
    );

  }

  if (msg.text === "📊 Stock") {

    return bot.sendMessage(
      chatId,
`📊 Available Coupons:
${getStock(product.file)}`
    );

  }

  if (msg.text === "👥 Referrals") {

    const count =
      referrals[chatId]
        ? referrals[chatId].length
        : 0;

    return bot.sendMessage(
      chatId,
`👥 Referrals:
${count}/5

🎁 Get 1 FREE coupon after 5 referrals.

🔗 Your Link:
https://t.me/codebasketbot?start=${chatId}`
    );

  }

  if (msg.text === "📦 My Orders") {

    const orders =
      userOrders[chatId];

    if (!orders ||
        orders.length === 0) {

      return bot.sendMessage(
        chatId,
        "❌ No previous orders found."
      );

    }

    let text =
      "📦 Your Orders:\n\n";

    orders.forEach((order, index) => {

      text +=
`#${index + 1}

📦 Quantity:
${order.qty}

💰 Amount:
₹${order.total}

`;

    });

    return bot.sendMessage(
      chatId,
      text
    );

  }

  // =======================
  // BUY COUPON
  // =======================

  if (msg.text === "🛒 Buy Coupon") {

    return bot.sendMessage(
      chatId,
`${product.details}

💵 Price:
₹${product.price}

📊 Stock:
${getStock(product.file)}

📦 Enter quantity (1-50):`
    );

  }

  // =======================
  // QUANTITY INPUT
  // =======================

  const qty =
    parseInt(msg.text);

  if (isNaN(qty)) return;

  if (qty < 1 || qty > 50) {

    return bot.sendMessage(
      chatId,
      "❌ Enter quantity between 1-50"
    );

  }

  const codes =
    getCodes(product.file);

  if (qty > codes.length) {

    return bot.sendMessage(
      chatId,
`❌ Only ${codes.length} coupons available`
    );

  }

  const total =
    qty * product.price;

  pendingOrders[chatId] = {
    qty,
    total
  };

  // =======================
  // PAYMENT QR
  // =======================

  bot.sendPhoto(
    chatId,
    './qr.jpg',
    {
      caption:
`${product.name}

📦 Quantity:
${qty}

💰 Total:
₹${total}

📲 Scan QR and pay.

After payment click below.`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ I Have Paid",
              callback_data: "paid"
            }
          ]
        ]
      }
    }
  );

});

// =======================
// CALLBACK QUERIES
// =======================

bot.on('callback_query', async (query) => {

  const chatId =
    String(query.message.chat.id);

  // VERIFY JOIN

  if (query.data === "verify_join") {

    const joined =
      await checkJoin(chatId);

    if (joined) {

      bot.sendMessage(
        chatId,
`✅ Verification Successful!

Send /start again.`
      );

    } else {

      bot.sendMessage(
        chatId,
        "❌ Please join both channels first."
      );

    }

  }

  // USER PAID

  if (query.data === "paid") {

    const order =
      pendingOrders[chatId];

    if (!order) return;

    bot.sendMessage(
      ADMIN_ID,
`🛒 New Order

👤 User:
${chatId}

📦 Quantity:
${order.qty}

💰 Amount:
₹${order.total}`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "✅ APPROVE",
          callback_data:
            `approve_${chatId}`
        },
        {
          text: "❌ REJECT",
          callback_data:
            `reject_${chatId}`
        }
      ]
    ]
  }
}
    );

    bot.sendMessage(
      chatId,
      "⏳ Waiting for admin approval..."
    );

  }

  // APPROVE

  if (
    query.data.startsWith("approve_")
  ) {

    if (
      String(query.from.id)
      !== ADMIN_ID
    ) return;

    const userId = String(
      query.data.split("_")[1]
    );

    const order =
      pendingOrders[userId];

    if (!order) return;

    const codes =
      getCodes(product.file);

    const selectedCodes =
      codes.slice(0, order.qty);

    const remaining =
      codes.slice(order.qty);

    fs.writeFileSync(
      product.file,
      remaining.join('\n')
    );

    // SAVE ORDERS

    if (!userOrders[userId]) {

      userOrders[userId] = [];

    }

    userOrders[userId].push({
      qty: order.qty,
      total: order.total
    });

    saveJSON(
      'orders.json',
      userOrders
    );

    // UPDATE STATS

    stats.totalOrders += 1;

    stats.totalRevenue += order.total;

    saveJSON(
      'stats.json',
      stats
    );

    let text =
`✅ Payment Approved

🎟 Your Coupons:

`;

    selectedCodes.forEach(code => {

      text += `${code}\n`;

    });

    bot.sendMessage(
      userId,
      text
    );

    // DELETE ADMIN MESSAGE

    bot.deleteMessage(
      ADMIN_ID,
      query.message.message_id
    ).catch(() => {});

    delete pendingOrders[userId];

  }

  // REJECT

  if (
    query.data.startsWith("reject_")
  ) {

    if (
      String(query.from.id)
      !== ADMIN_ID
    ) return;

    const userId = String(
      query.data.split("_")[1]
    );

    bot.sendMessage(
      userId,
      "❌ Payment Rejected"
    );

    bot.deleteMessage(
      ADMIN_ID,
      query.message.message_id
    ).catch(() => {});

    delete pendingOrders[userId];

  }

});

console.log(
  "✅ CodeBasketBot Running..."
);