// server.js
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Redirect root URL to /login
app.get('/', (req, res) => {
  res.redirect('/login');
});


// Redirect user to Discord OAuth
app.get('/login', (req, res) => {
  const redirectUri = encodeURIComponent('https://insidealert-backendserver-9ef87c4b222a.herokuapp.com/callback');
  const clientId = process.env.DISCORD_CLIENT_ID;
  const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
  res.redirect(oauthUrl);
});

// Handle Discord OAuth callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://insidealert-backendserver-9ef87c4b222a.herokuapp.com/callback',
      scope: 'identify',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const discordUser = userResponse.data;

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: 'https://insidealert-backendserver-9ef87c4b222a.herokuapp.com/success',
      cancel_url: 'https://insidealert-backendserver-9ef87c4b222a.herokuapp.com/cancel',
      metadata: {
        discord_id: discordUser.id,
      },
    });

app.get('/success', (req, res) => {
  res.send('Payment successful! You Can Close This Page');
});

    app.get('/cancel', (req, res) => {
  res.send('Payment Failed. Please Try Again');
});
    
    res.redirect(session.url);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error during Discord OAuth');
  }
});

// Stripe webhook
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const discordId = session.metadata.discord_id;
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    console.log(`Subscription complete for Discord user: ${discordId}`);
  }

  res.status(200).send();
});

const fs = require('fs');
const path = require('path');

// Function to update users.json when an order is completed
function updateUserOrder(discordId, orderData) {
  const filePath = path.join(__dirname, 'users.json');

  // Read the existing users.json file
//   fs.readFile(filePath, 'utf8', (readErr, data) => {
//     if (readErr) {
//       console.error('Error reading users.json:', readErr);
//       return;
//     }

//     let users;
//     try {
//       users = JSON.parse(data);
//     } catch (parseErr) {
//       console.error('Error parsing users.json:', parseErr);
//       return;
//     }

//     // Check if the user exists; if not, initialize their data
//     if (!users[discordId]) {
//       users[discordId] = {
//         orders: []
//       };
//     }

//     // Add the new order to the user's order history
//     users[discordId].orders.push(orderData);

//     // Write the updated users object back to users.json
//     fs.writeFile(filePath, JSON.stringify(users, null, 2), 'utf8', (writeErr) => {
//       if (writeErr) {
//         console.error('Error writing to users.json:', writeErr);
//       } else {
//         console.log(`Order for user ${discordId} has been recorded.`);
//       }
//     });
//   });
// }

app.get('/users', async (req, res) => {
  const { User } = require('./models'); // Make sure this path matches where your model is
  try {
    const users = await User.findAll();
    // console.log(users);  // Logs users to the console
    res.json(users);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).send('Error fetching users');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
