import MongoDbHelper from '../server/routes/MongoDbHelper';
import { DATABASE_URI } from '../server/routes/settings'
const mongoDbHelper = new MongoDbHelper(DATABASE_URI);

// start connection
Promise.resolve()
.then(() => {
  return new Promise((resolve, reject) => {
    mongoDbHelper.start(() => {
      console.log("mongodb ready:")
      resolve()
    });
  })
})
.then(() => {
  const insert_param = {
    _id: 'ratel_voice',
    max_chapter_id: 1,
    max_reader_id: 1,
    issue_token_flg: true,
    createdAt: new Date()
  }
  return mongoDbHelper.collection("app_status").insert(insert_param)
})
.then(() => {
  console.log("Done")
  process.exit(0);
})
.catch((err) => {
  console.log("err: ",err)
  process.exit(0);
})
