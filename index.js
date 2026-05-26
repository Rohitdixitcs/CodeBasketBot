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

const ADMIN_ID = "8785399401";

const MAIN_CHANNEL = "@codebasketofficial";
const DISCUSSION_GROUP = "@codebasket";

// =======================
// MEMORY
// =======================

const pendingOrders = {};

let broadcastMode = false;

let orderCounter = 1000;

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

let deliveries =
  loadJSON('deliveries.json', []);

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

  price: 7.5,

  details:
`<b><u>🛒 BigBasket Offer</u></b>

<b>💰 ₹100 OFF on ₹100+</b>

<i>🍫 Valid on Chocolate / Ice Cream Orders</i>

<b>🆕 First Order Only</b>

⚠️ May not work on old accounts`

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
`<b>🚫 Please Join Both Channels First</b>`,
{
  parse_mode: "HTML",
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
    referrerId !== chatId &&
    !users.includes(chatId + "_referred")
  ) {

    if (!referrals[referrerId]) {

      referrals[referrerId] = [];

    }

    if (
      !referrals[referrerId].includes(chatId)
    ) {

      referrals[referrerId].push(chatId);

      users.push(chatId + "_referred");

      saveJSON(
        'users.json',
        users
      );

      saveJSON(
        'referrals.json',
        referrals
      );

    }

  }

  const referralCount =
    referrals[chatId]
      ? referrals[chatId].length
      : 0;

  bot.sendMessage(
    chatId,
`${product.details}

<b>💵 Price:</b> ₹${product.price}

<b>👥 Referrals:</b> ${referralCount}/5

<b>🔗 Your Referral Link:</b>

https://t.me/codebasketbot?start=${chatId}`,
{
  parse_mode: "HTML",
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
`<b><u>🔐 ADMIN PANEL</u></b>

<b>👥 Users:</b> ${
users.filter(
u => !u.includes("_referred")
).length}

<b>📦 Orders:</b> ${
stats.totalOrders}

<b>💰 Revenue:</b> ₹${
stats.totalRevenue}

<b>🎟 Stock:</b> ${
getStock(product.file)}

<b>👥 Referrals:</b> ${
Object.keys(referrals).length}`,
{
  parse_mode: "HTML",
  reply_markup: {
    keyboard: [
      ["📊 Stats", "📦 Orders"],
      ["🎟 Stock", "👥 Users"],
      ["📢 Broadcast", "🧹 Clear Pending"],
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

  const chatId =
    String(msg.chat.id);

  if (!msg.text) return;

  if (msg.text.startsWith('/start')) return;

  // =======================
  // LOW STOCK WARNING
  // =======================

  if (
    getStock(product.file) <= 10
  ) {

    bot.sendMessage(
      ADMIN_ID,
`⚠️ LOW STOCK WARNING

Only ${
getStock(product.file)
} coupons left.`
    ).catch(() => {});

  }

  // =======================
  // ADMIN BUTTONS
  // =======================

  if (msg.text === "📊 Stats") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`<b>📊 BOT STATS</b>

<b>👥 Users:</b>
${users.length}

<b>📦 Orders:</b>
${stats.totalOrders}

<b>💰 Revenue:</b>
₹${stats.totalRevenue}`,
{
  parse_mode: "HTML"
}
    );

  }

  if (msg.text === "📦 Orders") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`<b>📦 Total Orders:</b>

${stats.totalOrders}`,
{
  parse_mode: "HTML"
}
    );

  }

  if (msg.text === "🎟 Stock") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`<b>🎟 Current Stock:</b>

${getStock(product.file)}`,
{
  parse_mode: "HTML"
}
    );

  }

  if (msg.text === "👥 Users") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`<b>👥 Total Users:</b>

${users.length}`,
{
  parse_mode: "HTML"
}
    );

  }

  if (msg.text === "🧹 Clear Pending") {

    if (chatId !== ADMIN_ID) return;

    Object.keys(pendingOrders).forEach(id => {
      delete pendingOrders[id];
    });

    return bot.sendMessage(
      chatId,
      "✅ Pending Orders Cleared"
    );

  }

  // =======================
  // BROADCAST
  // =======================

  if (msg.text === "📢 Broadcast") {

    if (chatId !== ADMIN_ID) return;

    broadcastMode = true;

    return bot.sendMessage(
      chatId,
      "📢 Send Broadcast Message"
    );

  }

  if (
    broadcastMode &&
    chatId === ADMIN_ID
  ) {

    broadcastMode = false;

    let success = 0;

    for (const user of users) {

      if (
        user.includes("_referred")
      ) continue;

      try {

        await bot.sendMessage(
          user,
`📢 <b>Broadcast Message</b>

${msg.text}`,
{
  parse_mode: "HTML"
}
        );

        success++;

      } catch {}

    }

    return bot.sendMessage(
      chatId,
`✅ Broadcast Sent To ${success} Users`
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
`<b>📊 Available Coupons:</b>

${getStock(product.file)}`,
{
  parse_mode: "HTML"
}
    );

  }

  if (msg.text === "👥 Referrals") {

    const count =
      referrals[chatId]
        ? referrals[chatId].length
        : 0;

    return bot.sendMessage(
      chatId,
`<b>👥 Referrals:</b>

${count}/5

🎁 Get 1 FREE Coupon After 5 Referrals

🔗 Referral Link:

https://t.me/codebasketbot?start=${chatId}`,
{
  parse_mode: "HTML"
}
    );

  }

  if (msg.text === "📦 My Orders") {

    const orders =
      userOrders[chatId];

    if (
      !orders ||
      orders.length === 0
    ) {

      return bot.sendMessage(
        chatId,
        "❌ No Previous Orders Found"
      );

    }

    let text =
      "<b>📦 Your Orders:</b>\n\n";

    orders.forEach((order, index) => {

      text +=
`<b>#${index + 1}</b>

📦 Qty: ${order.qty}

💰 Amount: ₹${order.total}

🆔 Order ID: #${order.orderId}

`;

    });

    return bot.sendMessage(
      chatId,
      text,
{
  parse_mode: "HTML"
}
    );

  }

  // =======================
  // BUY COUPON
  // =======================

  if (msg.text === "🛒 Buy Coupon") {

    return bot.sendMessage(
      chatId,
`${product.details}

<b>💵 Price:</b> ₹${product.price}

<b>📊 Stock:</b>
${getStock(product.file)}

<b>📦 Enter Quantity (1-50)</b>`,
{
  parse_mode: "HTML"
}
    );

  }

  // =======================
  // QUANTITY
  // =======================

  const qty =
    parseInt(msg.text);

  if (isNaN(qty)) return;

  if (qty < 1 || qty > 50) {

    return bot.sendMessage(
      chatId,
      "❌ Enter Quantity Between 1-50"
    );

  }

  const codes =
    getCodes(product.file);

  if (qty > codes.length) {

    return bot.sendMessage(
      chatId,
`❌ Only ${codes.length} Coupons Available`
    );

  }

  const total =
    qty * product.price;

  orderCounter++;

  const orderId = orderCounter;

  pendingOrders[chatId] = {
    qty,
    total,
    orderId
  };

  // =======================
  // PAYMENT QR
  // =======================

  bot.sendPhoto(
    chatId,
    './qr.jpg',
    {
      caption:
`<b>🛒 Order #${orderId}</b>

📦 Quantity:
${qty}

💰 Total:
₹${total}

📲 Scan QR & Pay

⚠️ After Payment Send Screenshot`,
      parse_mode: "HTML"
    }
  );

});

// =======================
// PAYMENT SCREENSHOT
// =======================

bot.on('photo', async (msg) => {

  const chatId =
    String(msg.chat.id);

  const order =
    pendingOrders[chatId];

  if (!order) return;

  const photo =
    msg.photo[
      msg.photo.length - 1
    ].file_id;

  bot.sendPhoto(
    ADMIN_ID,
    photo,
{
  caption:
`<b>🛒 New Order</b>

🆔 Order ID:
#${order.orderId}

👤 User:
${chatId}

📦 Quantity:
${order.qty}

💰 Amount:
₹${order.total}`,
  parse_mode: "HTML",
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
    "⏳ Payment Screenshot Sent For Verification"
  );

});

// =======================
// CALLBACKS
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
        "✅ Verification Successful\nSend /start Again"
      );

    } else {

      bot.sendMessage(
        chatId,
        "❌ Please Join Both Channels First"
      );

    }

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

    // SAVE DELIVERY LOG

    deliveries.push({
      user: userId,
      orderId: order.orderId,
      codes: selectedCodes
    });

    saveJSON(
      'deliveries.json',
      deliveries
    );

    // SAVE ORDER

    if (!userOrders[userId]) {

      userOrders[userId] = [];

    }

    userOrders[userId].push({
      qty: order.qty,
      total: order.total,
      orderId: order.orderId
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
`<b>✅ Payment Approved</b>

🆔 Order ID:
#${order.orderId}

<b>🎟 Your Coupons:</b>

`;

    selectedCodes.forEach(code => {

      text += `<code>${code}</code>\n`;

    });

    text +=
`\n⚠️ Tap & Hold Coupon To Copy`;

    bot.sendMessage(
      userId,
      text,
{
  parse_mode: "HTML"
}
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