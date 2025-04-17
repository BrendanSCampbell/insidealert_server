const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',  // Path to SQLite database file
});

// Define User model
const User = sequelize.define('User', {
  discord_id: { 
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  stripe_customer_id: DataTypes.STRING,
  subscription_id: DataTypes.STRING,
  subscription_status: DataTypes.STRING,
});

// Sync the model with the database
sequelize.sync({ alter: true }) // This will auto-create tables or update schema
  .then(() => console.log('SQLite database synced'))
  .catch((err) => console.error('SQLite sync error:', err));

module.exports = { sequelize, User };
