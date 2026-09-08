const { Sequelize } = require("sequelize");
const env = require("./env");
console.log(env.db);
console.log("Password:", JSON.stringify(env.db.password));
console.log("Length:", env.db.password.length);
const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: "mysql",
  logging: false
});
console.log(env.db);

module.exports = sequelize;
