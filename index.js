require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

const ADMIN_ID = String(process.env.ADMIN_ID);

const pendingOrders = {};

// LOAD ORDERS
let userOrders = {};

if (fs.existsSync('orders.json')) {
  userOrders = JSON.parse(
    fs.readFileSync('orders.json')
  );
}

bot.onText(/\/start/, (msg) => {

  bot.sendMessage(
    msg.chat.id,
`🎟 Welcome to CodeBasketBot

💰 Price per coupon = ₹6

📦 Enter quantity (1-50):`,
{
  reply_markup: {
    keyboard: [
      ["🛒 Buy Coupons", "📊 Available Stock"],
      ["📦 My Orders"],
      ["📞 Support", "👤 Owner"]
    ],
    resize_keyboard: true
  }
}
  );

});

bot.on('message', async (msg) => {

  const chatId = String(msg.chat.id);

  if (msg.text === '/start') return;

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

  // BUY BUTTON
  if (msg.text === "🛒 Buy Coupons") {

    return bot.sendMessage(
      chatId,
      "📦 Enter quantity (1-50):"
    );

  }

  // STOCK BUTTON
  if (msg.text === "📊 Available Stock") {

    const file = fs.readFileSync(
      'coupons.txt',
      'utf-8'
    );

    const codes = file
      .split('\n')
      .filter(code => code.trim() !== '');

    return bot.sendMessage(
      chatId,
`📊 Available Coupons: ${codes.length}`
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
📦 Quantity: ${order.qty}
💰 Amount: ₹${order.total}

`;

    });

    return bot.sendMessage(chatId, text);

  }

  // QUANTITY
  const qty = parseInt(msg.text);

  if (isNaN(qty) || qty < 1 || qty > 50) {

    return bot.sendMessage(
      chatId,
      "❌ Enter quantity between 1 and 50"
    );

  }

  const file = fs.readFileSync(
    'coupons.txt',
    'utf-8'
  );

  const availableCodes = file
    .split('\n')
    .filter(code => code.trim() !== '');

  if (qty > availableCodes.length) {

    return bot.sendMessage(
      chatId,
`❌ Only ${availableCodes.length} coupons available.`
    );

  }

  const total = qty * 6;

  pendingOrders[chatId] = {
    qty,
    total
  };

  bot.sendPhoto(
    chatId,
    './qr.jpg',
    {
      caption:
`✅ ${qty} Coupons Selected

💰 Total Amount = ₹${total}

Scan QR and complete payment.

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

bot.on('callback_query', async (query) => {

  const chatId = String(query.message.chat.id);

  // USER CLICKED PAID
  if (query.data === "paid") {

    const order = pendingOrders[chatId];

    if (!order) return;

    bot.sendMessage(
      ADMIN_ID,
`🛒 New Payment Request

👤 User ID: ${chatId}

📦 Quantity: ${order.qty}
💰 Amount: ₹${order.total}`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "✅ YES",
          callback_data: `approve_${chatId}`
        },
        {
          text: "❌ NO",
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

    if (String(query.from.id) !== ADMIN_ID) return;

    const userId = String(query.data.split("_")[1]);

    const order = pendingOrders[userId];

    if (!order) return;

    const file = fs.readFileSync(
      'coupons.txt',
      'utf-8'
    );

    let codes = file
      .split('\n')
      .filter(code => code.trim() !== '');

    const selected = codes.slice(0, order.qty);

    const remaining = codes.slice(order.qty);

    fs.writeFileSync(
      'coupons.txt',
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

    // SAVE TO FILE
    fs.writeFileSync(
      'orders.json',
      JSON.stringify(userOrders, null, 2)
    );

    let text =
`✅ Payment Confirmed

🎟 Your Coupons:

`;

    selected.forEach(code => {
      text += `${code}\n`;
    });

    bot.sendMessage(userId, text);

    delete pendingOrders[userId];

  }

  // REJECT
  if (query.data.startsWith("reject_")) {

    if (String(query.from.id) !== ADMIN_ID) return;

    const userId = String(query.data.split("_")[1]);

    bot.sendMessage(
      userId,
      "❌ Payment not approved."
    );

    delete pendingOrders[userId];

  }

});