require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

const ADMIN_ID = String(process.env.ADMIN_ID);

const CHANNEL_USERNAME = "@codebasketofficial";

const pendingOrders = {};

// =======================
// LOAD FILES
// =======================

let userOrders = {};
let referrals = {};
let users = [];

let stats = {
  totalOrders: 0,
  totalRevenue: 0
};

if (fs.existsSync('orders.json')) {

  userOrders = JSON.parse(
    fs.readFileSync('orders.json')
  );

}

if (fs.existsSync('referrals.json')) {

  referrals = JSON.parse(
    fs.readFileSync('referrals.json')
  );

}

if (fs.existsSync('users.json')) {

  users = JSON.parse(
    fs.readFileSync('users.json')
  );

}

if (fs.existsSync('stats.json')) {

  stats = JSON.parse(
    fs.readFileSync('stats.json')
  );

}

// =======================
// PRODUCT DETAILS
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
// START COMMAND
// =======================

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {

  const chatId = String(msg.chat.id);

  const referrerId = match[1];

  // SAVE USERS
  if (!users.includes(chatId)) {

    users.push(chatId);

    fs.writeFileSync(
      'users.json',
      JSON.stringify(users, null, 2)
    );

  }

  // CHECK CHANNEL JOIN
  try {

    const member =
      await bot.getChatMember(
        CHANNEL_USERNAME,
        chatId
      );

    if (
      member.status === 'left' ||
      member.status === 'kicked'
    ) {

      return bot.sendMessage(
        chatId,
`🚫 You must join our channel first.`,
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
          text: "✅ Verify Join",
          callback_data: "verify_join"
        }
      ]
    ]
  }
}
      );

    }

  } catch {

    return bot.sendMessage(
      chatId,
      "❌ Bot must be admin in channel."
    );

  }

  // REFERRALS
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

      fs.writeFileSync(
        'referrals.json',
        JSON.stringify(referrals, null, 2)
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

You completed 5 referrals.

🎁 FREE Coupon:

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

💵 Price: ₹${product.price} per code

👥 Referrals: ${referralCount}/5

🔗 Your Referral Link:
https://t.me/codebasket?start=${chatId}

🛍 Choose Option Below`,
{
  reply_markup: {
    keyboard: [
      ["🛒 Buy Coupon", "📊 Available Stock"],
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

👥 Total Users:
${users.length}

📦 Total Orders:
${stats.totalOrders}

💰 Total Revenue:
₹${stats.totalRevenue}

🎟 Current Stock:
${getStock(product.file)}

👥 Total Referrals:
${Object.keys(referrals).length}`,
{
  reply_markup: {
    keyboard: [
      ["📊 Stats", "📦 Stock"],
      ["📋 Orders"],
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

  // STATS
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

  // STOCK
  if (msg.text === "📦 Stock") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`🎟 Current Stock:
${getStock(product.file)}`
    );

  }

  // ORDERS
  if (msg.text === "📋 Orders") {

    if (chatId !== ADMIN_ID) return;

    return bot.sendMessage(
      chatId,
`📦 Total Orders:
${stats.totalOrders}`
    );

  }

  // SUPPORT
  if (msg.text === "📞 Support") {

    return bot.sendMessage(
      chatId,
      "📞 Support: @Coderboyxx"
    );

  }

  // OWNER
  if (msg.text === "👤 Owner") {

    return bot.sendMessage(
      chatId,
      "👤 Owner: @Coderboyxx"
    );

  }

  // REFERRALS
  if (msg.text === "👥 Referrals") {

    const count =
      referrals[chatId]
        ? referrals[chatId].length
        : 0;

    return bot.sendMessage(
      chatId,
`👥 Your Referrals: ${count}/5

🎁 Get 1 FREE coupon after 5 referrals.

🔗 Your Link:
https://t.me/codebasket?start=${chatId}`
    );

  }

  // STOCK
  if (msg.text === "📊 Available Stock") {

    return bot.sendMessage(
      chatId,
`📊 Available Coupons:
${getStock(product.file)}`
    );

  }

  // MY ORDERS
  if (msg.text === "📦 My Orders") {

    const orders = userOrders[chatId];

    if (!orders || orders.length === 0) {

      return bot.sendMessage(
        chatId,
        "❌ No previous orders found."
      );

    }

    let text = "📦 Your Orders:\n\n";

    orders.forEach((order, index) => {

      text +=
`#${index + 1}

📦 Quantity:
${order.qty}

💰 Amount:
₹${order.total}

`;

    });

    return bot.sendMessage(chatId, text);

  }

  // BUY COUPON
  if (msg.text === "🛒 Buy Coupon") {

    return bot.sendMessage(
      chatId,
`${product.details}

💵 Price:
₹${product.price}

📊 Stock Available:
${getStock(product.file)}

📦 Enter quantity (1-50):`
    );

  }

  // QUANTITY
  const qty = parseInt(msg.text);

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

  // PAYMENT QR
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

📲 Scan QR and complete payment.

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

    try {

      const member =
        await bot.getChatMember(
          CHANNEL_USERNAME,
          chatId
        );

      if (
        member.status === 'member' ||
        member.status === 'administrator' ||
        member.status === 'creator'
      ) {

        bot.sendMessage(
          chatId,
`✅ Verification Successful!

Send /start again.`
        );

      } else {

        bot.sendMessage(
          chatId,
          "❌ You still have not joined channel."
        );

      }

    } catch {

      bot.sendMessage(
        chatId,
        "❌ Verification Failed."
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
          callback_data: `approve_${chatId}`
        },
        {
          text: "❌ REJECT",
          callback_data: `reject_${chatId}`
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
  if (query.data.startsWith("approve_")) {

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

    // SAVE ORDER
    if (!userOrders[userId]) {

      userOrders[userId] = [];

    }

    userOrders[userId].push({
      qty: order.qty,
      total: order.total
    });

    fs.writeFileSync(
      'orders.json',
      JSON.stringify(userOrders, null, 2)
    );

    // UPDATE STATS
    stats.totalOrders += 1;

    stats.totalRevenue += order.total;

    fs.writeFileSync(
      'stats.json',
      JSON.stringify(stats, null, 2)
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

    delete pendingOrders[userId];

  }

  // REJECT
  if (query.data.startsWith("reject_")) {

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

    delete pendingOrders[userId];

  }

});

// =======================
// FUNCTIONS
// =======================

function getCodes(file) {

  if (!fs.existsSync(file))
    return [];

  return fs.readFileSync(
    file,
    'utf-8'
  )
  .split('\n')
  .filter(
    code => code.trim() !== ''
  );

}

function getStock(file) {

  return getCodes(file).length;

}