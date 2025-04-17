const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Heroku's Postgres uses self-signed certs
    },
  },
});

const User = require('./user')(sequelize, DataTypes);

sequelize.sync(); // Or sync({ alter: true }) to update tables safely

module.exports = {
  sequelize,
  User,
};
