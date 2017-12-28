import uuid from 'uuid';
import sha256 from 'sha256'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import fs from 'fs'
import EPub from 'epub';
import html2plaintext from 'html2plaintext'
import MongoDbHelper from './MongoDbHelper';
import {
  DATABASE_URI,
  API_KEY,
  RatelExampleToken_Address,
  Custodian_Address,
  ORACLE_ADDRESS,
  ORACLE_PASSWORD,
  RPC_SERVER,
} from './settings'
import {
  makeid,
  sigmoid,
  checkDirectory,
  conv_webm_to_wav,
  generate_phonetic,
  generate_ciphered_seeds,
  recoverAddress,
  issueTokenWithTaskId,
  decipher_seeds,
} from './helpers'
const exec = require('child_process').exec;
const PythonShell = require('python-shell');
const mongoDbHelper = new MongoDbHelper(DATABASE_URI);
import Web3 from 'web3'
const web3 = new Web3(new Web3.providers.HttpProvider(RPC_SERVER));

// start connection
mongoDbHelper.start(() => {
  console.log("mongodb ready:")
});

// helper function
String.prototype.replaceAll = function(org, dest){
  return this.split(org).join(dest);
}

// index
exports.echo = (req, res) => {

  res.json({
    status: 'OK',
    login_token: req.session.login_token
  });
}

// create a new account
exports.create_user = (req, res) => {

  let password =  req.body.password;
  let email =  req.body.email;
  let seed_text =  req.body.seed_text;
  let signedHash =  req.body.signedHash;
  let api_key =  req.headers.authorization

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  const address = recoverAddress({
    web3: web3,
    signedHash: signedHash,
    message: 'ratel network is going to democratize AI ICO startup'
  })

  let user_info = {}
  let login_token
  let max_reader_id = 0

  let app_info = {}

  // check count
  let find_app_status = { _id: 'ratel_voice' }
  mongoDbHelper.collection("app_status").findOne(find_app_status)
  .then((results) => {
    // check if email exist

    if (!results) {
      return Promise.reject(Error('no such app'))
    }

    app_info = results

    max_reader_id = results.max_reader_id
    max_reader_id = max_reader_id + 1

    const upd_param = {
      '$set':{
        max_reader_id: max_reader_id,
        updatedAt: new Date(),
      }
    }
    return mongoDbHelper.collection("app_status").update(find_app_status, upd_param, {upsert: true})
  })
  .then((results) => {
    let find_param = {
      'emails.address':email
    }
    return mongoDbHelper.collection("users").count(find_param)
  })
  .then((results) => {
    return new Promise((resolve, reject) => {
      if (results != 0){
        reject("user already exist")
      }
      resolve()
    })
  })
  .then(() => {
    // get encrypted seeds
    const params = {
      seed_text,seed_text,
      password: password,
    }
    return generate_ciphered_seeds(params)
  })
  .then((results) => {
    // create an account on mongodb

    const encrypted_seed_text = results

    // bcrypt of password
    let password2 = sha256(password)
    var bcrypt_hash = bcrypt.hashSync(password2, 10);

    // token to access
    // login token
    login_token = makeid('4') + parseInt(new Date().getTime()).toString(36);
    const hashed_token = crypto.createHash('sha256').update(login_token).digest('base64');

    const token_object = {
      'when':new Date(),
      'hashedToken':hashed_token,
    };

    let insert_param = {
      createdAt: new Date(),
      services:{
        password : {
          bcrypt : bcrypt_hash
        },
        resume : {
          loginTokens : [token_object]
        },
        email : {
          verificationTokens : [
            {
              // nameHash : nameHash,
              address : email,
              when : new Date(),
            }
          ]
        },
      },
      emails : [
        {
          "address" : email,
          "verified" : false
        }
      ],
      profile : {},
      reader_id: max_reader_id,
      blockchain:{
        address: address,
        encrypted_seed_text: encrypted_seed_text,
      }
    }

    // insert
    return mongoDbHelper.collection("users").insert(insert_param)
  })
  .then((results) => {

    if ( results === null ) {
      return Promise.reject("no such user")
    }

    user_info._id = results._id;
    user_info.profile = results.profile;
  })
  .then((results) => {

    req.session.login_token = login_token

    res.json({
      status: 'success',
      user: user_info,
      login_token: login_token,
      app_info: app_info,
    })

  })
  .catch((err) => {
    console.log("err: ", err)
    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// login with email and password
exports.login_with_email_password = (req, res) => {

  let password =  req.body.password;
  let email =  req.body.email;
  let api_key =  req.headers.authorization

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  let user_info = {};
  let login_token

  // find user with email
  let find_param = {
    'emails.address':email
  }
  mongoDbHelper.collection("users").findOne(find_param)
  .then((results) => {
    // check password

    return new Promise( (resolve, reject) => {

      if (!results){
        reject("no such user")
      }
      if (!results.services || !results.services.password || !results.services.password.bcrypt){
        reject("something must be wrong")
      }

      // set user info
      user_info._id = results._id;
      user_info.profile = results.profile;

      let password2 = sha256(password)

      const saved_hash = results.services.password.bcrypt

      bcrypt.compare(password2, saved_hash, (err, res) => {
        if (err){
          reject(err)
        }

        if (res === true){
          resolve()
        } else {
          reject("password is not valid")
        }
      });
    } )
  })
  .then(() => {
    // issue new token

    let find_param = {
      _id: user_info._id
    }

    // token to access
    // login token
    login_token = makeid('4') + parseInt(new Date().getTime()).toString(36);
    const hashed_token = crypto.createHash('sha256').update(login_token).digest('base64');

    const token_object = {
      'when':new Date(),
      'hashedToken':hashed_token,
    };

    let upd_param = {
      '$push':{
        'services.resume.loginTokens':token_object
      }
    };

    // update
    return mongoDbHelper.collection("users").update(find_param, upd_param)
  })
  .then((results) => {

    // check reading material
    const find_param = {
      'chapter_id':user_info.profile.chapter_id
    }
    return mongoDbHelper.collection("reading_materials").findOne(find_param)
  })
  .then((results) => {

    if (results){
      user_info.profile.reading = {
        'chapter_id': user_info.profile.chapter_id,
        'reading_material_title':results.reading_material_title,
        'chapter_title':results.chapter_title,
        'reading_material_chapter_id':results.reading_material_chapter_id,
      }
    }

    // req.session.login_token = login_token
    // res.json({
    //   status: 'success',
    //   user: user_info,
    //   login_token: login_token,
    // })

    // check app status
    let find_param = { _id: 'ratel_voice' }
    return  mongoDbHelper.collection("app_status").findOne(find_param)

  })
  .then((results) => {

    const app_info = results

    req.session.login_token = login_token
    res.json({
      status: 'success',
      user: user_info,
      login_token: login_token,
      app_info: app_info,
    })
  })
  .catch((err) => {
    console.log("err:", err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// find user: try to login with token
const find_user_with_token = ({ login_token }) => {

  const hashed_token = crypto.createHash('sha256').update(login_token).digest('base64');
  let find_param = {
    'services.resume.loginTokens':{
      '$elemMatch':{
        'hashedToken':hashed_token
      }
    }
  }
  return mongoDbHelper.collection("users").findOne(find_param)
}

// logout
exports.logout = (req, res) => {

  let login_token = req.body.login_token;
  let api_key =  req.headers.authorization

  if (login_token === undefined){
    res.json({ status: 'error', message: 'token is not valid 1' });
    return;
  }

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {
    // if exists, delete token
    if (results === null){
      return Promise.reject("no such token")
    }

    let find_param = {
      '_id':results._id
    };
    var upd_param = {
      '$pull':{
        'services.resume.loginTokens':{
          'hashedToken':hashed_token
        }
      }
    };
    return mongoDbHelper.collection("users").update(find_param, upd_param)
  })
  .then(() => {
    res.json({status: 'success'})
  })
  .catch((err) => {
    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// upload voice and convert it to wav
exports.upload = (req, res) => {

  if (!req.file) {
    res.json({ status: 'error', message: 'audio file not found' });
    return;
  }

  let login_token = req.body.login_token;
  let api_key =  req.headers.authorization
  let user_id = req.body.user_id;
  let sentence_info_id = req.body.sentence_info_id;
  let phonetic = req.body.phonetic;

  if (login_token === undefined){
    res.json({ status: 'error', message: 'token is not valid 1' });
    return;
  }

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  const file = req.file; // file passed from client
  let reader_id
  let chapter_id
  let voice_directory
  let sentence_idx
  let sentence_info
  let user_info
  let wav_path
  let wav_name
  let mimeType

  // this is mac value
  let COINS_PER_VOICE = 300
  let mongo_log_id = null
  let app_info = {}

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {

    if (results === null) {
      return Promise.reject("no such user")
    }
    user_info = results
    return Promise.resolve()

  })
  .then(() => {
    // check sentence_info
    const find_param = {
      _id: sentence_info_id
    }
    return mongoDbHelper.collection("reading_sentences").findOne(find_param)
  })
  .then((results) => {
    // create directory if needed
    sentence_info = results

    let phonetic_len = sentence_info.phonetic.length

    // set reward > should be more complex...
    COINS_PER_VOICE = 300 * sigmoid( (phonetic_len - 10) / 4 )

    reader_id = user_info.reader_id
    chapter_id = results.chapter_id
    sentence_idx = results.idx

    // let chapter_id = req.body
    voice_directory = './samples/'+reader_id+'/'+chapter_id+'/';

    checkDirectory(voice_directory)
  })
  .then(() => {
    // check voice_contribution_log
    const find_param = {
      user_id: user_id,
      sentence_info_id: sentence_info_id,
    }
    return mongoDbHelper.collection("voice_contribution_log").findOne(find_param)
  })
  .then((results) => {

    if (results){
      return Promise.reject("already contributed to the sentence")
    }

    // check file type
    return new Promise((resolve, reject) => {
      exec('file '+req.file.path, (err, results) => {
        if (err){
          reject(err)
        }

        if ( results.indexOf("CoreAudio Format") != -1 ){
          resolve("caf")
        } else if ( results.indexOf("WebM") != -1 ) {
          resolve("webm")
        }
      })
    })
  })
  .then((_mimeType) => {
    // create wav file
    if (_mimeType != 'caf' && _mimeType != 'webm') {
      return Promise.reject("invalid mimeType")
    }

    mimeType = _mimeType

    // convert webm to wav

    let webm_path = file.path

    let fine_name
    if ( sentence_idx.toString().length === 1) {
      fine_name = "000"+sentence_idx.toString() + ".wav"
    } else if (sentence_idx.toString().length === 2) {
      fine_name = "00"+sentence_idx.toString() + ".wav"
    } else if (sentence_idx.toString().length === 3) {
      fine_name = "0"+sentence_idx.toString() + ".wav"
    } else {
      fine_name = sentence_idx.toString() + ".wav"
    }

    wav_name = reader_id+'-'+chapter_id+'-'+fine_name
    wav_path = voice_directory+wav_name
    return conv_webm_to_wav(webm_path, wav_path, _mimeType)
  })
  .then(() => {
    // insert into voice_contribution_log
    let contribute_type = 'voice'
    if (phonetic !== sentence_info.phonetic){
      contribute_type = 'voice_text'
    }

    // insert log
    const insert_param = {
      user_id: user_id,
      reader_id: reader_id,
      chapter_id: chapter_id,
      sentence_idx: sentence_idx,
      phonetic: phonetic,
      ideogram: sentence_info.ideogram,
      sentence_info_id: sentence_info_id,
      createdAt: new Date(),
      contribute_type: contribute_type,
      deleted: false,
      wav_path:wav_path,
      wav_name: wav_name,
      token_issued: COINS_PER_VOICE,
      transactionHash: null,
    }
    return mongoDbHelper.collection("voice_contribution_log").insert(insert_param)
  })
  .then((results) => {

    mongo_log_id = results._id

    // update sentence table
    const find_param = {
      _id: sentence_info_id
    }
    const upd_param = {
      '$set':{
        dataContributedAt: new Date()
      },
      '$inc':{
        dataContributedCount: 1
      },
      '$push':{
        contributors: user_id
      }
    }
    return mongoDbHelper.collection("reading_sentences").update(find_param, upd_param)
  })
  .then(() => {

    const find_param = {
      _id: user_id
    }
    const upd_param = {
      '$set':{
        contributedAt: new Date()
      }
    }
    return mongoDbHelper.collection("users").update(find_param, upd_param)
  })
  .then(() => {
    // convert to mp3 for users to play from mobile and web
    let webm_path = file.path

    let fine_name
    if ( sentence_idx.toString().length === 1) {
      fine_name = "000"+sentence_idx.toString() + ".mp3"
    } else if (sentence_idx.toString().length === 2) {
      fine_name = "00"+sentence_idx.toString() + ".mp3"
    } else if (sentence_idx.toString().length === 3) {
      fine_name = "0"+sentence_idx.toString() + ".mp3"
    } else {
      fine_name = sentence_idx.toString() + ".mp3"
    }

    let audio_name = reader_id+'-'+chapter_id+'-'+fine_name
    let audio_path = voice_directory+audio_name
    return conv_webm_to_wav(file.path, audio_path, mimeType)
  })

  .then(() => {
    // delete original file

    return new Promise((resolve, reject) => {
      fs.unlink(file.path, (err) => {
        if (err){
          reject(err)
        }
        resolve()
      })
    })
  })
  .then(() => {
    // check app status
    let find_param = { _id: 'ratel_voice' }
    return  mongoDbHelper.collection("app_status").findOne(find_param)
  })
  .then((results) => {
    // send transaction to blockchain

    if (results){
      app_info = results
    }

    if (app_info.issue_token_flg === false){
      // skip issuing token process
      return Promise.resolve()
    }

    if (!user_info.blockchain || !user_info.blockchain.address)  {
      return Promise.reject(Error("no address found"))
    }

    const _taskId = web3.utils.asciiToHex(mongo_log_id)

    const params = {
      web3: web3,
      _to: user_info.blockchain.address,
      _value: COINS_PER_VOICE,
      _taskId: _taskId,
    }
    return issueTokenWithTaskId(params)
  })
  .then((results) => {
    // update transaction id on mongo

    if (app_info.issue_token_flg === false){
      // skip issuing token process
      return Promise.resolve()
    }

    const find_param = {
      _id: mongo_log_id
    }
    const upd_param = {
      '$set':{
        transactionHash: results.transactionHash
      }
    }
    return mongoDbHelper.collection("voice_contribution_log").update(find_param, upd_param)
  })
  .then(() => {
    res.json({status: 'success', coins: COINS_PER_VOICE})
  })
  .catch((err) => {
    console.log("err:", err)
    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// login_with_token
exports.login_with_token = (req, res) => {

  let login_token =  req.body.login_token;
  let api_key =  req.headers.authorization

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  let user_info = {};

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {
    // set user info

    if ( results === null ) {
      return Promise.reject("no such user")
    }

    user_info._id = results._id;
    user_info.profile = results.profile;
    user_info.reader_id = results.reader_id;

  })
  .then((results) => {

    if (user_info.profile && user_info.profile.chapter_id) {
      // check rading material
      const find_param = {
        'chapter_id':user_info.profile.chapter_id
      }
      return mongoDbHelper.collection("reading_materials").findOne(find_param)
    } else {
      return Promise.resolve()
    }

  })
  .then((results) => {

    if (results){
      user_info.profile.reading = {
        'chapter_id': user_info.profile.chapter_id,
        'reading_material_title':results.reading_material_title,
        'chapter_title':results.chapter_title,
        'reading_material_chapter_id':results.reading_material_chapter_id,
      }
    }

    // check app status
    let find_param = { _id: 'ratel_voice' }
    return  mongoDbHelper.collection("app_status").findOne(find_param)


    // // session
    // req.session.login_token = login_token
    //
    // // return success
    // res.json({
    //   status: 'success',
    //   user: user_info,
    //   login_token: login_token,
    // })
  })
  .then((results) => {

    const app_info = results

    // session
    req.session.login_token = login_token

    // return success
    res.json({
      status: 'success',
      user: user_info,
      login_token: login_token,
      app_info: app_info,
    })

  })
  .catch((err) => {
    console.log("err:",err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// get_voice_task
exports.get_voice_task = (req, res) => {

  let login_token =  req.body.login_token;
  let api_key =  req.headers.authorization;
  // let user_id = req.body.user_id;

  if (!login_token){
    res.json({ status: 'error', message: 'token is not valid' });
    return;
  }

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  let user_info = {};

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {
    // set user info

    if ( results === null ) {
      res.json({ status: 'error', message: 'no such user' });
      return;
    }
    user_info = results

    // check if chapter_id is set
    if (!user_info.profile) {
      // something must be wrong
      return Promise.reject(Error("user do not have profile"));
    }

    if (!user_info.profile.chapter_id) {
      // chapter_id have to be assigned

      // const _id = sha256(url)
      const find_param = {
        deleted: {
          '$ne': true
        },
        assignedUsers:{
          '$nin':[user_info._id]
        },
      }

      const sort_param = {
        assignedAt: 1
      }
      const skip = 0
      const limit = 10000
      return mongoDbHelper.collection("reading_materials").find(find_param, sort_param, skip, limit)

    } else {

      // chapter_id = user_info.profile.chapter_id
      return Promise.resolve()
    }
  })
  .then((results) => {
    // update user

    if (results){

      // chapter_id = results.chapter_id
      user_info.profile.chapter_id = results[0].chapter_id

      const find_param = {
        _id: user_info._id
      }
      const upd_param = {
        '$set':{
          'profile.chapter_id': results[0].chapter_id
        }
      }
      return mongoDbHelper.collection("users").update(find_param, upd_param)
    } else {
      return Promise.resolve()
    }

  })
  .then((results) => {
    // update reading_materials if needed

    if (results) {
      const find_param = {
        _id: user_info._id
      }
      const upd_param = {
        '$set':{
          assignedAt: new Date()
        },
        '$push':{
          assignedUsers: user_info._id
        }
      }
      return mongoDbHelper.collection("reading_materials").update(find_param, upd_param)
    } else {
      return Promise.resolve()
    }
  })
  .then(() => {
    // get data

    const find_param = {
      deleted: false,
      contributors:{
        '$nin':[user_info._id]
      },
      skippedBy:{
        '$nin':[user_info._id]
      },
      chapter_id: user_info.profile.chapter_id,
    }

    const sort_param = {
      dataContributedAt: 1
    }

    const skip = 0
    const limit = 1
    return mongoDbHelper.collection("reading_sentences").find(find_param, sort_param, skip, limit)
  })
  .then((results) => {
    res.json({status: 'success', list: results})
  })
  .catch((err) => {
    console.log("err", err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// get_completed_tasks
exports.get_completed_tasks = (req, res) => {

  let login_token =  req.body.login_token;
  let api_key =  req.headers.authorization;
  // let user_id = req.body.user_id;

  if (!login_token){
    res.json({ status: 'error', message: 'token is not valid' });
    return;
  }

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  let user_info = {};

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {
    // set user info

    if ( results === null ) {
      res.json({ status: 'error', message: 'no such user' });
      return;
    }
    user_info = results

    // get data
    const find_param = {
      user_id: user_info._id,
    }

    const sort_param = {
      createdAt: -1
    }

    const skip = 0
    const limit = 100
    return mongoDbHelper.collection("voice_contribution_log").find(find_param, sort_param, skip, limit)
  })
  .then((results) => {
    res.json({status: 'success', list: results})
  })
  .catch((err) => {
    console.log("err", err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// voice_with_taskid
exports.voice_with_id = (req, res) => {

  let login_token = req.session.login_token
  let voice_id =  req.query.voice_id;
  let audioType = 'mp3';
  if (req.query.audioType) {
    audioType = req.query.audioType
  }

  console.log("req.headers.origin:",req.headers.origin)

  // debug/test
  // if (req.headers.origin !== 'http://localhost:3000'){
  // }
  //
  // let api_key =  req.query.api_key;
  // if (api_key !== API_KEY){
  //   res.json({ status: 'error', message: 'api key is invalid' });
  //   return;
  // }

  let user_info = {};

  Promise.resolve()
  .then(() => {
    // // find user
    // const hashed_token = crypto.createHash('sha256').update(login_token).digest('base64');
    // let find_param = {
    //   'services.resume.loginTokens':{
    //     '$elemMatch':{
    //       'hashedToken':hashed_token
    //     }
    //   }
    // }
    // return mongoDbHelper.collection("users").findOne(find_param)
  })
  .then((results) => {
    // check whether log already exist

    // find voice
    const find_param = {
      _id: voice_id,
    }
    return mongoDbHelper.collection("voice_contribution_log").findOne(find_param)
  })
  .then((results) => {

    return new Promise((resolve, reject) => {

      if ( results === null ) {
        reject("no such voice")
      }

      const voice_directory = './samples/'+results.reader_id+'/'+results.chapter_id+'/';

      let index_name
      if ( results.sentence_idx.toString().length === 1) {
        index_name = "000"+results.sentence_idx.toString()
      } else if (results.sentence_idx.toString().length === 2) {
        index_name = "00"+results.sentence_idx.toString()
      } else if (results.sentence_idx.toString().length === 3) {
        index_name = "0"+results.sentence_idx.toString()
      } else {
        index_name = results.sentence_idx.toString()
      }

      let audio_name = results.reader_id+'-'+results.chapter_id+'-'+index_name
      if ( audioType == 'wav' ) {
        audio_name = audio_name+".wav"
      } else {
        audio_name = audio_name+".mp3"
      }
      const audio_path = voice_directory+audio_name

      fs.readFile(audio_path, (err, data) => {
        if (err){
          reject(err)
        }
        resolve(data)
      })
    })
  })
  .then((results) => {
    if ( audioType == 'wav' ) {
      res.set('Content-Type', 'audio/wav');
    } else {
      res.set('Content-Type', 'audio/mp3');
    }
    res.send(results);
  })
  .catch((err) => {
    console.log("err", err)
    res.status(404);
  })
}

// report_failed_task
exports.report_failed_task = (req, res) => {

  let login_token =  req.body.login_token;
  let api_key =  req.headers.authorization;
  let voice_id = req.body.voice_id;

  if (!login_token){
    res.json({ status: 'error', message: 'token is not valid' });
    return;
  }

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  if (!voice_id){
    res.json({ status: 'error', message: 'voice task id is not valid' });
    return;
  }

  let user_info = {};

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {
    // get user

    if ( results === null ){
      return Promise.reject("no such user")
    }

    user_info = results

    // get voice task data
    const find_param = {
      _id: voice_id,
      user_id: user_info._id,

    }
    return mongoDbHelper.collection("voice_contribution_log").findOne(find_param)
  })
  .then((results) => {
    if ( results === null ){
      return Promise.reject("no such voice")
    }

    // update task

    // get voice task data
    const find_param = {
      _id: voice_id,
      user_id: user_info._id,
    }
    const upd_param = {
      '$set':{
        deleted: true,
        deletedAt: new Date()
      }
    }
    return mongoDbHelper.collection("voice_contribution_log").update(find_param, upd_param)
  })
  .then((results) => {
    res.json({status: 'success'})
  })
  .catch((err) => {

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// skip_sentence
exports.skip_sentence = (req, res) => {

  let login_token =  req.body.login_token;
  let api_key =  req.headers.authorization;
  let sentence_info_id = req.body.sentence_info_id;

  if (!login_token){
    res.json({ status: 'error', message: 'token is not valid' });
    return;
  }

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  if (!sentence_info_id){
    res.json({ status: 'error', message: 'sentence id is not valid' });
    return;
  }

  let user_info = {};
  let sentence_info = {}

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {
    // get user

    if ( results === null ){
      return Promise.reject("no such user")
    }

    user_info = results

    // get voice task data
    const find_param = {
      _id: sentence_info_id,
    }
    return mongoDbHelper.collection("reading_sentences").findOne(find_param)
  })
  .then((results) => {
    if ( results === null ){
      return Promise.reject("no such sentence")
    }

    sentence_info = results

    // get voice task data
    const find_param = {
      user_id: user_info._id,
      // chapter_id: sentence_info.chapter_id,
      // sentence_idx: sentence_info.idx,
      sentence_info_id: sentence_info_id
    }
    return mongoDbHelper.collection("voice_contribution_log").findOne(find_param)
  })
  .then((results) => {

    if (results){
      return Promise.reject("already completed")
    }

    // insert
    const insert_param = {
      user_id: user_info._id,
      reader_id: user_info.reader_id,
      chapter_id: sentence_info.chapter_id,
      sentence_idx: sentence_info.idx,
      sentence_info_id: sentence_info_id,
      createdAt: new Date(),
      deleted: true,
      deletedAt: new Date(),
      memo: 'skipped'
    }
    return mongoDbHelper.collection("voice_contribution_log").insert(insert_param)
  })
  .then(() => {

    // update sentence table
    const find_param = {
      _id: sentence_info_id
    }
    // not actually a contribute but skipped
    const upd_param = {
      '$inc':{
        skippedCount: 1
      },
      '$push':{
        skippedBy: user_info._id
      }
    }
    return mongoDbHelper.collection("reading_sentences").update(find_param, upd_param)

  })
  .then((results) => {
    res.json({status: 'success'})
  })
  .catch((err) => {

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// get_reading_materials
exports.get_reading_materials = (req, res) => {

  let login_token =  req.body.login_token;
  let api_key =  req.headers.authorization;
  // let user_id = req.body.user_id;

  if (!login_token){
    res.json({ status: 'error', message: 'token is not valid' });
    return;
  }

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  let user_info = {};
  let rtn_list2 = []

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {
    // set user info

    if ( results === null ) {
      res.json({ status: 'error', message: 'no such user' });
      return;
    }
    user_info = results

    // get data
    const find_param = {
      deleted: {
        '$ne': true
      },
    }

    const sort_param = {
      reading_material_title: 1,
      reading_material_chapter_id: 1,
    }

    const skip = 0
    const limit = 1000
    return mongoDbHelper.collection("reading_materials").find(find_param, sort_param, skip, limit)
  })
  .then((results) => {
    // check each reading_sentences

    const reading_materials_list = results

    return new Promise((resolve, reject) => {

      let sequence = Promise.resolve()
      reading_materials_list.forEach((item, idx) => {

        let contributd_count = 0
        let sentence_count = 0

        sequence = sequence.then(() => {
          // count of contribution fot this chapter_id
          const find_param = {
            chapter_id: item.chapter_id,
            user_id: user_info._id
          }
          return mongoDbHelper.collection("voice_contribution_log").count(find_param)
        })
        .then((results) => {
          // check sentence count
          contributd_count = results

          const find_param = {
            chapter_id: item.chapter_id,
          }
          return mongoDbHelper.collection("reading_sentences").count(find_param)

        })
        .then((results) => {


          // is currently selected?
          sentence_count = results

          item.contributd_count = contributd_count
          item.sentence_count = sentence_count
          if ( user_info.profile.chapter_id === item.chapter_id ){
            item.selected = true
          }
          item.foo = 'bar'
          rtn_list2.push(item)

          if ( idx === (reading_materials_list.length - 1) ){
            resolve()
          } else {
            return "NG"
          }
        })
        .catch((err) =>{
          console.log("err: ", err)
          if ( idx === (reading_materials_list.length - 1) ){
            resolve()
          } else {
            return "NG"
          }
        })
      })
    })
  })
  .then(() => {
    res.json({status: 'success', list: rtn_list2})
  })
  .catch((err) => {
    console.log("err: ", err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// select reading material
exports.select_reading_material = (req, res) => {

  let login_token =  req.body.login_token;
  let api_key =  req.headers.authorization;
  let reading_material_id = req.body.reading_material_id;

  if (!login_token){
    res.json({ status: 'error', message: 'token is not valid' });
    return;
  }

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  if (!reading_material_id){
    res.json({ status: 'error', message: 'reading material id is not valid' });
    return;
  }

  let user_info = {};

  // find user
  find_user_with_token({login_token: login_token})
  .then((results) => {
    // get user

    if ( results === null ){
      return Promise.reject("no such user")
    }

    user_info = results

    // get voice task data
    const find_param = {
      _id: reading_material_id,
      deleted: {
        '$ne': true
      },
    }
    return mongoDbHelper.collection("reading_materials").findOne(find_param)
  })
  .then((results) => {
    if ( results === null ){
      return Promise.reject("no such reading material")
    }

    const reading_materials_item = results

    // update users

    // get voice task data
    const find_param = {
      _id: user_info._id
    }
    const upd_param = {
      '$set':{
        'profile.chapter_id':reading_materials_item.chapter_id,
        'updatedAt': new Date(),
      }
    }
    return mongoDbHelper.collection("users").update(find_param, upd_param)
  })
  .then((results) => {
    // update reading_materials

    // get voice task data
    const find_param = {
      _id: reading_material_id,
    }
    const upd_param = {
      '$set':{
        assignedAt: new Date()
      },
      '$push':{
        assignedUsers: user_info._id
      }
    }
    return mongoDbHelper.collection("reading_materials").update(find_param, upd_param)
  })
  .then((results) => {
    res.json({status: 'success'})
  })
  .catch((err) => {

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// INFERENCE
//
// Voice to Text
exports.voice_to_text = (req, res) => {

  if (!req.file) {
    res.json({ status: 'error', message: 'audio file not found' });
    return;
  }

  let api_key =  req.headers.authorization
  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  const file = req.file; // file passed from client
  // const file_path = base_dir+file.path
  let wav_path = "/tmp/"+file.filename+".wav"
  let recognized_text

  Promise.resolve()
  .then(() => {
    // check file type

    return new Promise((resolve, reject) => {
      exec('file '+req.file.path, (err, results) => {
        if (err){
          reject(err)
        }

        if ( results.indexOf("CoreAudio Format") != -1 ){
          resolve("caf")
        } else if ( results.indexOf("WebM") != -1 ) {
          resolve("webm")
        }
      })
    })
  })
  .then((_mimeType) => {

    if (_mimeType != 'caf' && _mimeType != 'webm') {
      return Promise.reject("invalid mimeType")
    }

    // convert webm to wav
    // wav_path = "/tmp/"+file.name
    return conv_webm_to_wav(file.path, wav_path, _mimeType)
  })
  .then(() => {
    // do something ...

    const jupyter_dir = __dirname.replace("server/routes", "")+"jupyter"
    const model_name = 'model_end.h5'

    let options = {
      mode: 'text',
      pythonPath: '/home/kouohhashi/anaconda3/bin/python',
      pythonOptions: ['-u'],
      scriptPath: jupyter_dir,
      args: [wav_path, model_name]
    };

    return new Promise((resolve, reject) => {
      PythonShell.run('prediction.py', options, (err, tf_results) => {
        if (err) {
          reject(err)
        }

        if (!tf_results){
          reject("some python error")
        }
        if (typeof tf_results !== 'undefined' && tf_results !== null){
           // do stuff
           let last_value = tf_results[(tf_results.length - 1)]
           recognized_text = last_value
           resolve()
        } else {
          reject("some error")
        }
      });
    })
  })
  .then(() => {
    // delete files
    return new Promise((resolve, reject) => {
      fs.unlink(file.path, (err) => {
        if (err){
          reject(err)
        }
        resolve()
      })
    })
  })
  .then((results) => {
    // delete files
    return new Promise((resolve, reject) => {
      fs.unlink(wav_path, (err) => {
        if (err){
          reject(err)
        }
        resolve()
      })
    })
  })
  .then(() => {
    res.json({
      status: 'success',
      recognized_text: recognized_text
    })
  })
  .catch((err) => {
    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

// get_random_example_script
exports.get_random_example_script = (req, res) => {

  let api_key =  req.headers.authorization;
  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  Promise.resolve()
  .then((results) => {
    // count
    let find_param = {
      deleted: false
    }
    return mongoDbHelper.collection("reading_sentences").count(find_param)
  })
  .then((results) => {
    //

    let rand_val = Math.floor(Math.random() * (results-1));
    const find_param = {
      deleted: false,
    }

    const sort_param = {}
    const skip = rand_val
    const limit = 1
    return mongoDbHelper.collection("reading_sentences").find(find_param, sort_param, skip, limit)
  })
  .then((results) => {

    res.json({
      status: 'success',
      reading_sentence: {
        ideogram: results[0].ideogram,
        phonetic: results[0].phonetic,
      }
    })
  })
  .catch((err) => {
    console.log("err: ", err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}

/**
 * epub_upload
 */
exports.epub_upload = (req, res) => {

  if (!req.file) {
    res.json({ status: 'error', message: 'epub file not found' });
    return;
  }

  let api_key =  req.headers.authorization
  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  const file = req.file; // file passed from client

  let epub_info = null;

  read_epub( { epub_file: file.path } )
  .then((results) => {
    // check if the material already exists

    if (!results){
      return Promise.reject(Error("no content found"))
    }
    epub_info =results
    return import_materials_from_epubtext({ epub_info: epub_info })
  })
  .then((results) => {
    res.json({
      status: 'success',
    })
  })
  .catch((err) => {
    console.log("err:", err)
  })
}


// import_materials_from_epubtext
const import_materials_from_epubtext = ( { epub_info } ) => {

  return new Promise((resolve, reject) => {

    let max_chapter_id = 0

    // sequential process
    let sequence = Promise.resolve()
    epub_info.contents_array.forEach((content, idx) => {

      sequence = sequence
      .then(() => {
        // check app status
        let find_param = { _id: 'ratel_voice' }
        return  mongoDbHelper.collection("app_status").findOne(find_param)
      })
      .then((results) => {
        // update max_chapter_id

        if (results) {
          // max_reader_id = results.max_reader_id
          max_chapter_id = results.max_chapter_id
        }
        max_chapter_id = max_chapter_id + 1

        const find_param = { _id: 'ratel_voice' }
        const upd_param = {
          '$set':{
            max_chapter_id: max_chapter_id,
            updatedAt: new Date(),
          }
        }
        return mongoDbHelper.collection("app_status").update(find_param, upd_param, {upsert: true})
      })
      .then(() => {
        // check if content exist

        const material_id = sha256(epub_info.metadata.creator+'-'+epub_info.metadata.title+'-'+idx)
        const find_param = {
          '_id':material_id
        }
        return mongoDbHelper.collection("reading_materials").findOne(find_param)
      })
      .then((results) => {
        //

        const material_id = sha256(epub_info.metadata.creator+'-'+epub_info.metadata.title+'-'+idx)

        if (!results) {
          // insert
          const insert_param = {
            '_id': material_id,
            'metadata': epub_info.metadata,
            'reading_material_chapter_id': idx,
            'reading_material_title': epub_info.metadata.title+' '+idx,
            'chapter_id': max_chapter_id,
            createdAt: new Date(),
          }
          return mongoDbHelper.collection("reading_materials").insert(insert_param)
        } else {
          // update ... or skip
          // return Promise.reject(Error("already imported"))
          return ""
        }
      })
      .then((results) => {
        // import reading_sentences
        return import_sentenses_from_epubtext({ epub_info: epub_info, content_idx: idx, chapter_id: max_chapter_id })
      })
      .then((results) => {

        if ( idx === (epub_info.contents_array.length - 1) ){
          resolve()
        } else {
          return "OK"
        }

      })
      .catch((err) =>{
        console.log("err: ", err)
        if ( idx === (epub_info.contents_array.length - 1) ){
          resolve()
        } else {
          return "NG"
        }
      })
    })
  })
}


const import_sentenses_from_epubtext = ({epub_info, content_idx, chapter_id}) => {

  return new Promise((resolve, reject) => {
    const content = epub_info.contents_array[content_idx]

    // split by "\n"
    const sentence_array1 = content.split("\n")

    // split by ". "
    let sentence_array2 = []
    sentence_array1.map((item) => {
      const tmp_arr = item.split(". ")
      tmp_arr.map((item2) => {
        if ( item2.trim() ) {
          sentence_array2.push(item2.trim())
        }
      })
    })

    // sequential process
    let sequence = Promise.resolve()
    sentence_array2.forEach((sentence, idx) => {

      sequence = sequence
      .then(() => {
        // check if content exist

        const sentence_id = sha256(epub_info.metadata.creator+'-'+epub_info.metadata.title+'-'+content_idx+'-'+idx)
        const find_param = {
          '_id':sentence_id
        }
        return mongoDbHelper.collection("reading_sentences").findOne(find_param)
      })
      .then((results) => {
        // insert

        if (results){
          // skip...
          return ""
        }
        const phonetic = generate_phonetic({text: sentence}).trim()
        if (!phonetic){
          return ""
        }

        const sentence_id = sha256(epub_info.metadata.creator+'-'+epub_info.metadata.title+'-'+content_idx+'-'+idx)

        // insert
        const insert_param = {
          '_id': sentence_id,
          'chapter_id': chapter_id,
          'idx': idx,
          'ideogram': sentence.trim(),
          'phonetic': phonetic,
          'createdAt': new Date(),
          'dataContributedCount': 0,
          'deleted': false,
          'contributors': [],
        }
        return mongoDbHelper.collection("reading_sentences").insert(insert_param)
      })
      .then((results) => {

        if ( idx === (sentence_array2.length - 1) ){
          resolve()
        } else {
          return "OK"
        }

      })
      .catch((err) =>{
        console.log("err: ", err)
        if ( idx === (sentence_array2.length - 1) ){
          resolve()
        } else {
          return "NG"
        }
      })
    })
  })
}

// read epub file and convert it into text
const read_epub = ( { epub_file } ) => {

  return new Promise((resolve, reject) => {

    let rtn_obj = {}

    // read epub
    var epub = new EPub(epub_file)

    epub.on("error", (err) => {
      reject(err);
    });

    epub.on("end", (err) => {

      if (!epub || !epub.spine || !epub.spine.contents || epub.spine.contents === 0) {
        reject(Error("no contents found"))
      }

      rtn_obj.metadata = epub.metadata
      rtn_obj.contents_array = []

      // sequential process
      let sequence = Promise.resolve()
      epub.spine.contents.forEach((content, idx) => {

        sequence = sequence
        .then(() => {
          // get text

          return new Promise((resolve1, reject1) => {
            epub.getChapter(content.id, (err, data) => {
              if (err) {
                reject1(err)
              }

              let text_data = html2plaintext(data)
              if ( text_data.length > 100 ) {
                rtn_obj.contents_array.push(text_data)
              }

              resolve1();
            })
          })
        })
        .then((results) => {

          if ( idx === (epub.spine.contents.length - 1) ){
            resolve(rtn_obj)
          } else {
            return "OK"
          }

        })
        .catch((err) =>{
          console.log("err: ", err)
          if ( idx === (epub.spine.contents.length - 1) ){
            resolve(rtn_obj)
          } else {
            return "NG"
          }
        })
      })

    });

    epub.parse();
  })
}


//
// get decrypted seed
exports.retrieve_seed_text = (req, res) => {

  let password =  req.body.password;
  let email =  req.body.email;
  let api_key =  req.headers.authorization

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  let user_info = {};

  let seed_text

  // find user with email
  let find_param = {
    'emails.address':email
  }
  mongoDbHelper.collection("users").findOne(find_param)
  .then((results) => {
    // check password

    return new Promise( (resolve, reject) => {

      if (!results){
        reject("no such user")
      }
      if (!results.services || !results.services.password || !results.services.password.bcrypt){
        reject("something must be wrong")
      }

      // set user info
      // user_info._id = results._id;
      // user_info.profile = results.profile;
      user_info = results

      let password2 = sha256(password)

      const saved_hash = results.services.password.bcrypt

      bcrypt.compare(password2, saved_hash, (err, res) => {
        if (err){
          reject(err)
        }

        if (res === true){
          resolve()
        } else {
          reject("password is not valid")
        }
      });
    } )
  })
  .then(() => {
    // passwrod is valid

    // export const deciphere_seeds = ({ encrypted, password }) => {

    const params = {
      encrypted: user_info.blockchain.encrypted_seed_text,
      password: password,
    }
    return decipher_seeds(params)

  })
  .then((results) => {
    // seed is decrypted

    seed_text = results

    res.json({
      status: 'success',
      seed_text: seed_text,
    })
  })
  .catch((err) => {
    console.log("err:", err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}



//
// get app status
exports.get_app_status = (req, res) => {

  let app_id =  req.body.app_id;
  let api_key =  req.headers.authorization

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  // find user with email
  let find_param = {
    '_id':app_id
  }
  mongoDbHelper.collection("app_status").findOne(find_param)
  .then((results) => {
    //
    if (!results) {
      return Promise.reject(Error("no such app"))
    }

    res.json({
      status: 'success',
      app: results,
    })

  })
  .catch((err) => {
    console.log("err:", err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}


//
// update app status
exports.update_app_status = (req, res) => {

  let app_id =  req.body.app_id;
  let max_chapter_id =  req.body.max_chapter_id;
  let max_reader_id =  req.body.max_reader_id;
  let issue_token_flg =  req.body.issue_token_flg;
  if (issue_token_flg !== false) {
    issue_token_flg = true
  }

  let api_key =  req.headers.authorization;

  if (api_key !== API_KEY){
    res.json({ status: 'error', message: 'api key is invalid' });
    return;
  }

  let app_info = {}

  // find user with email
  let find_param = {
    '_id':app_id
  }
  mongoDbHelper.collection("app_status").findOne(find_param)
  .then((results) => {
    //
    if (!results) {
      return Promise.reject(Error("no such app"))
    }
    app_info = results
    
    if ( app_info.max_chapter_id > parseInt(max_chapter_id) ) {
      return Promise.reject(Error("max_chapter_id has to be bigger than "+app_info.max_chapter_id))
    }
    if ( app_info.max_reader_id > parseInt(max_reader_id) ) {
      return Promise.reject(Error("max_reader_id has to be bigger than "+app_info.max_reader_id))
    }
  })
  .then(() => {
    // update

     const find_param = {
       '_id':app_id
     }

    const upd_param = {
      '$set':{
        max_chapter_id: parseInt(max_chapter_id),
        max_reader_id: parseInt(max_reader_id),
        issue_token_flg: issue_token_flg,
        updatedAt: new Date(),
      }
    }
    return mongoDbHelper.collection("app_status").update(find_param, upd_param)
  })
  .then(() => {
    res.json({
      status: 'success',
    })
  })
  .catch((err) => {
    console.log("err:", err)

    let err_message = 'unknown_error'
    if (err.message) {
      err_message = err.message
    } else if (err){
      err_message = err
    }
    res.json({status: 'error', message: err_message})
  })
}
