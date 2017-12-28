/**
 * Created by k33g_org on 24/10/14.
 */
import mongodb  from 'mongodb';
import uuid from 'uuid';

/*
 http://mongodb.github.io/node-mongodb-native/2.0/tutorials/crud_operations/
 */

export default class MongoDbHelper {

  constructor (url) {
    this.url = url;
    this.mongoClient = mongodb.MongoClient;
    this.db = null;
  }

  start (callback) {
    this.mongoClient.connect(this.url, (err, db) => {
      this.db = db;
      callback(db)
    });
  }

  collection (collectionName) {
    let mongoDbCollection = this.db.collection(collectionName)
    let collection = {
      insert : (model) => {
        return new Promise((resolve, reject) => {
          if (!model._id) {
            model._id = uuid.v1();
          }
          mongoDbCollection.insertOne(model, (err, result) => {
            if (err) { reject(err); }
            resolve(model);
          });
        });
      },

      update : ( find_param,  upd_param, options ) => { //TODO: update many
        return new Promise((resolve, reject) => {

          if (!options) {
            mongoDbCollection.updateOne( find_param, upd_param, (err, result) => {
              if (err) { reject(err); }
              resolve(result);
            });
          } else {
            mongoDbCollection.updateOne( find_param, upd_param, options, (err, result) => {
              if (err) { reject(err); }
              resolve(result);
            });
          }
        });
      },

      find : (find_param, sort_param, skip, limit) => { //TODO: search
        return new Promise((resolve, reject) => {

          if (sort_param && skip && limit) {

            mongoDbCollection.find(find_param).sort(sort_param).skip(skip).limit(limit).toArray( (err, docs) => {
              if (err) { reject(err); }
              resolve(docs);
            });

          } else if (sort_param, limit) {

            mongoDbCollection.find(find_param).sort(sort_param).limit(limit).toArray( (err, docs) => {
              if (err) { reject(err); }
              resolve(docs);
            });

          } else if (sort_param) {

            mongoDbCollection.find(find_param).sort(sort_param).toArray( (err, docs) => {
              if (err) { reject(err); }
              resolve(docs);
            });

          } else {

            mongoDbCollection.find(find_param).toArray( (err, docs) => {
              if (err) { reject(err); }
              resolve(docs);
            });

          }
        });
      },

      findById : (id) => {
        return new Promise((resolve, reject) => {
          mongoDbCollection.findOne({_id: id}, (err, doc) => {
            if (err) { reject(err); }
            resolve(doc);
          });
        });
      },

      delete : (id) => { //TODO: delete many
        return new Promise((resolve, reject) => {
          mongoDbCollection.removeOne({_id: id}, (err, result) => {
            if (err) { reject(err); }
            resolve(result);
          });
        });
      },

      findOne : (param) => {
        return new Promise((resolve, reject) => {
          mongoDbCollection.findOne(param, (err, doc) => {
            if (err) { reject(err); }
            resolve(doc);
          });
        });
      },

      count : (param) => {
        return new Promise((resolve, reject) => {
          mongoDbCollection.count(param, (err, doc) => {
            if (err) { reject(err); }
            resolve(doc);
          });
        });
      },

    }

    return collection;
  }

}
