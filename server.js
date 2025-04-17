const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const fs = require('fs');
const path = require('path');

const { User } = require('./models');

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

    res.redirect(session.url);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error during Discord OAuth');
  }
});

// Success and Cancel routes
app.get('/success', (req, res) => {
  res.send('Payment successful! You can close this page.');
});

app.get('/cancel', (req, res) => {
  res.send('Payment failed. Please try again.');
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

    try {
      // Store user data in PostgreSQL using Sequelize
      await User.findOrCreate({
        where: { discord_id: discordId },
        defaults: {
          stripe_customer_id: customerId,
          subscription_id: subscriptionId,
          subscription_status: 'active',
        },
      });

      console.log(`Saved subscription for Discord user: ${discordId}`);
    } catch (err) {
      console.error('DB error:', err);
    }
  }

  res.status(200).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
