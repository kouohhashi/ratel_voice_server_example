import {
  DATABASE_URI,
  CORPUS_DIR,
} from '../server/routes/settings';
import MongoDbHelper from '../server/routes/MongoDbHelper';
const mongoDbHelper = new MongoDbHelper(DATABASE_URI);
const wavFileInfo = require('wav-file-info');
const fs = require('fs');

// list of English characters
const char_list = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'G', 'K', 'L', 'M', 'N',
  'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'W', 'V', 'X', 'Y', 'Z', ' ', '\'',
]

// helper function
String.prototype.replaceAll = function(org, dest){
  return this.split(org).join(dest);
}

let create_desc_json = () => {

  let train_total_sec = 0
  let train_total_cnt = 0
  let valid_total_sec = 0
  let valid_total_cnt = 0

  let train_corpus = ""
  let valid_corpus = ""

  Promise.resolve()
  .then(() => {
    return new Promise((resolve, reject) => {

      // start connection
      mongoDbHelper.start(() => {
        console.log("mongodb ready... ")
        resolve()
      });
    })
  })
  .then(() => {
    const find_param = {
      deleted: false
    }
    return mongoDbHelper.collection("voice_contribution_log").find(find_param)
  })
  .then((results) => {
    // sequence by sequence

    return new Promise((resolve, reject) => {

      let sequence = Promise.resolve()
      results.forEach((item, idx) => {

        sequence = sequence.then(() => {
          // step 1: check audio duration

          let index_name = ''
          if ( item.sentence_idx.toString().length === 1) {
            index_name = "000"+item.sentence_idx.toString() + ".wav"
          } else if (item.sentence_idx.toString().length === 2) {
            index_name = "00"+item.sentence_idx.toString() + ".wav"
          } else if (item.sentence_idx.toString().length === 3) {
            index_name = "0"+item.sentence_idx.toString() + ".wav"
          } else {
            index_name = item.sentence_idx.toString() + ".wav"
          }
          let wav_name = item.reader_id+'-'+item.chapter_id+'-'+index_name
          let wav_dir = './samples/'+item.reader_id+'/'+item.chapter_id+"/"
          let wav_path = wav_dir+wav_name
          let wav_path_from_jupyter = '.'+wav_dir+wav_name

          wavFileInfo.infoByFilename( wav_path, (err, info) => {

            if (err){
              // console.log("err:", err)
              return Promise.reject(err)
            } else {
              //
              let phonetic = item.phonetic

              // check char_map
              let flg = false

              // check phonetic
              let new_phonetic = ""
              for (let i=0; i<phonetic.length; i++){
                let word = phonetic[i]
                if (char_list.indexOf(word) == -1){
                  console.log("word not found: ", word)
                  flg = true

                  new_phonetic = new_phonetic + ""

                } else {
                  new_phonetic = new_phonetic + word
                }
              }

              new_phonetic = new_phonetic.trim()

              if (flg == true){
                console.log("item _id:", item._id)
                console.log("phonetic:", phonetic)
                console.log("new_phonetic:", new_phonetic)
                console.log("")
              }

              const duration = info.duration

              const json_1 = {
                key: wav_path_from_jupyter,
                text: new_phonetic,
                duration: duration
              }

              let rand_val = Math.floor((Math.random() * 11) + 1);
              if (rand_val > 2){
                train_corpus = train_corpus + JSON.stringify(json_1)
                train_total_sec = train_total_sec + duration
                train_total_cnt++
              } else {
                valid_corpus = valid_corpus + JSON.stringify(json_1)
                valid_total_sec = valid_total_sec + duration
                valid_total_cnt++
              }

              if ( idx === (results.length - 1) ){
                resolve()
              } else {
                if (rand_val > 2){
                  train_corpus = train_corpus+"\n"
                } else {
                  valid_corpus = valid_corpus+"\n"
                }

                return "OK"
              }
            }
          });
        })
        .catch((err) => {
          console.log("err", err)
          if ( idx === (results.length - 1) ){
            resolve()
          } else {
            return "NG"
          }
        })
      })
    })
  })
  .then(() => {
    // save train_corpus
    return new Promise((resolve, reject) => {

      let file_name = CORPUS_DIR+"train_corpus.json"

      fs.writeFile(file_name, train_corpus, (err) => {
        if (err){
          reject(err)
        }
        resolve()
      });
    })
  })
  .then(() => {
    // save valid_corpus
    return new Promise((resolve, reject) => {

      let file_name = CORPUS_DIR+"valid_corpus.json"

      fs.writeFile(file_name, valid_corpus, (err) => {
        if (err){
          reject(err)
        }
        resolve()
      });
    })
  })
  .then(() => {
    console.log("train_corpus: train_total_sec: "+train_total_sec+', train_total_cnt: '+train_total_cnt)
    console.log("valid_corpus: valid_total_sec: "+valid_total_sec+', valid_total_cnt: '+valid_total_cnt)
    process.exit(0)
  })
  .catch((err) => {
    console.log("err: ",err)
    process.exit(1)
  })
}

create_desc_json();
