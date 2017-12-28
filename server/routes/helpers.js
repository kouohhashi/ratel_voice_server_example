// helper functions

import avconv from 'avconv'
const crypto = require('crypto');
import mkdirp from 'mkdirp'
import EthUtil from 'ethereumjs-util'
import {
  RatelExampleToken_Address,
  ORACLE_ADDRESS,
  ORACLE_PASSWORD,
} from './settings'
import RatelExampleToken from './RatelExampleToken.json'

// token contract instance
let tokenInstance = null

// generate random string
export const makeid = (count) => {
  if (!count){
    count = 5;
  }

  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for( var i=0; i < count; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

export const sigmoid = (t) => {
  return 1/(1+Math.pow(Math.E, -t));
}

// helper function to create directory
export const  checkDirectory = (dir) => {
  return new Promise((resolve, reject) => {
    mkdirp(dir, function (err) {
      if (err){
        reject(err)
      }
      resolve()
    });
  })
}

// helper function to conver webm to wav
export const conv_webm_to_wav = (webm_path, wav_path, mimeType) => {

  return new Promise((resolve, reject) => {

    let params = [
      '-y',
      // '-f', 'webm',
      '-f', mimeType,
      '-loglevel', 'info',
      '-i', webm_path,
      // '-ab', '64k',
      '-ab', 44100,
      '-ac', 1,
      '-ar', 16000,
      wav_path
    ];

    // Returns a duplex stream
    let stream = avconv(params);

    stream.on('message', function(data) {
      // process.stdout.write(data);
    });

    stream.on('error', function(data) {
      reject(data)
    });

    stream.once('exit', function(exitCode, signal, metadata) {
      resolve(exitCode)
    });
  })
}

// strip quotations to create phonetic
// for different language like Japanese, we need to setup different phonetic
export const generate_phonetic = ( { text } ) => {

  const phonetic_chars = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'G', 'K', 'L', 'M', 'N',
    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'W', 'V', 'X', 'Y', 'Z', ' ', '\'',
  ]

  const upperText = text.toUpperCase()
  const array = upperText.split("").filter((char) => phonetic_chars.indexOf(char) !== -1)
  return array.join("");
}

// encrypt seed text
export const generate_ciphered_seeds = ({ seed_text, password }) => {

  return new Promise((resolve, reject) => {
    const cipher = crypto.createCipher('aes192', password);

    let encrypted = '';
    cipher.on('readable', () => {
      const data = cipher.read();
      if (data)
        encrypted += data.toString('hex');
    });
    cipher.on('end', () => {
      resolve(encrypted)
    });

    cipher.write(seed_text);
    cipher.end();
  })
}

// decrypt seed text
export const decipher_seeds = ({ encrypted, password }) => {

  return new Promise((resolve, reject) => {

    const decipher = crypto.createDecipher('aes192', password);

    let decrypted = '';
    decipher.on('readable', () => {
      const data = decipher.read();
      if (data)
        decrypted += data.toString('utf8');
    });
    decipher.on('end', () => {
      resolve(decrypted)
    });

    // const encrypted =
    //     'ca981be48e90867604588e75d04feabb63cc007a8f8ad89b10616ed84d815504';
    decipher.write(encrypted, 'hex');
    decipher.end();
  })
}

// recover user address
export const recoverAddress = ({ web3, signedHash, message }) => {

  // create message hash
  const messageHash = web3.utils.sha3(message)
  const messageHashx = new Buffer(messageHash.substr(2), 'hex');

  // sever-side
  const sigDecoded = EthUtil.fromRpcSig(signedHash)
  const recoveredPub = EthUtil.ecrecover(messageHashx, sigDecoded.v, sigDecoded.r, sigDecoded.s)
  let recoveredAddress = EthUtil.pubToAddress(recoveredPub).toString('hex')
  return "0x"+recoveredAddress;
}


// prepare contarct instance
const prepareTokenContract =  ({ web3 }) => {
  return Promise.resolve()
  .then(() => {
    // get instance if needed
    if (tokenInstance !== null){
      return Promise.resolve()
    }
    return new web3.eth.Contract(RatelExampleToken.abi, RatelExampleToken_Address)
  })
  .then((results) => {
    // set instance if needed
    if (tokenInstance !== null){
      return Promise.resolve()
    }
    tokenInstance = results
    return Promise.resolve()
  })
}

export const issueTokenWithTaskId = ({ web3, _to, _value, _taskId }) => {

  return Promise.resolve()
  .then(() => {
    return prepareTokenContract({ web3: web3 })
  })
  .then(() => {
    // unlock oracle address
    return web3.eth.personal.unlockAccount(ORACLE_ADDRESS, ORACLE_PASSWORD)
  })
  .then((results) => {
    // and get collateral estimate
    return tokenInstance.methods.transfer(_to, _value, _taskId).estimateGas({
      from : ORACLE_ADDRESS
    })
  })
  .then((results) => {
    // and get collateral send transaction
    const estimateGas = parseInt(results, 10) + 100
    return tokenInstance.methods.transfer(_to, _value, _taskId).send({
      from : ORACLE_ADDRESS,
      gasPrice: 100000000000,
      gas: estimateGas,
    })
  })
}
