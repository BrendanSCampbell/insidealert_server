const { Sequelize, DataTypes } = require('sequelize');

// Create a new Sequelize instance connected to PostgreSQL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false, // Disable logging for production (optional)
});

// Define a User model (example)
const User = sequelize.define('User', {
  discord_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  stripe_customer_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subscription_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subscription_status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Sync the models with the database
sequelize.sync()
  .then(() => console.log('Database synced'))
  .catch((err) => console.error('Error syncing database:', err));

module.exports = { sequelize, User };
