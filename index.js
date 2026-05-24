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

// PRODUCT DETAILS
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

// START
bot.onText(/\/start/, (msg) => {

  bot.sendMessage(
    msg.chat.id,
`${product.details}

💵 Price: ₹${product.price} per code

🛍 Choose Option Below`,
{
  reply_markup: {
    keyboard: [
      ["🛒 Buy Coupon", "📊 Available Stock"],
      ["📦 My Orders"],
      ["📞 Support", "👤 Owner"]
    ],
    resize_keyboard: true
  }
}
  );

});

// MAIN MESSAGE HANDLER
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

  // AVAILABLE STOCK
  if (msg.text === "📊 Available Stock") {

    const stock = getStock(product.file);

    return bot.sendMessage(
      chatId,
`📊 Available Coupons: ${stock}`
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

  // BUY BUTTON
  if (msg.text === "🛒 Buy Coupon") {

    const stock = getStock(product.file);

    return bot.sendMessage(
      chatId,
`${product.details}

💵 Price: ₹${product.price} per code

📊 Stock Available: ${stock}

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

  const codes = getCodes(product.file);

  if (qty > codes.length) {

    return bot.sendMessage(
      chatId,
`❌ Only ${codes.length} coupons available`
    );

  }

  const total = qty * product.price;

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

📦 Quantity: ${qty}

💰 Total Amount: ₹${total}

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

// BUTTON HANDLER
bot.on('callback_query', async (query) => {

  const chatId = String(query.message.chat.id);

  // USER CLICKED PAID
  if (query.data === "paid") {

    const order = pendingOrders[chatId];

    if (!order) return;

    bot.sendMessage(
      ADMIN_ID,
`🛒 New Order Request

👤 User ID: ${chatId}

📦 Quantity: ${order.qty}

💰 Amount: ₹${order.total}`,
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

  // APPROVE PAYMENT
  if (query.data.startsWith("approve_")) {

    if (String(query.from.id) !== ADMIN_ID) return;

    const userId = String(
      query.data.split("_")[1]
    );

    const order = pendingOrders[userId];

    if (!order) return;

    const codes = getCodes(product.file);

    const selectedCodes = codes.slice(
      0,
      order.qty
    );

    const remaining = codes.slice(order.qty);

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

    let text =
`✅ Payment Approved

🎟 Your Coupons:

`;

    selectedCodes.forEach(code => {
      text += `${code}\n`;
    });

    bot.sendMessage(userId, text);

    delete pendingOrders[userId];

  }

  // REJECT PAYMENT
  if (query.data.startsWith("reject_")) {

    if (String(query.from.id) !== ADMIN_ID) return;

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

// FUNCTIONS

function getCodes(file) {

  if (!fs.existsSync(file)) return [];

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