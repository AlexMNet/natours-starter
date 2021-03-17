const mongoose = require('mongoose');
const dotenv = require('dotenv');

//uncaughtException Errors
process.on('uncaughtException', err => {
  console.log('uncaughtException!!! 😅 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE_LOCAL;
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  })
  .then(() => console.log('DB Connection Successful!'));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

//Unhandeled Rejection Errors
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 😪 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
