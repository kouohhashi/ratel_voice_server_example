// check
// https://medium.com/of-all-things-tech-progress/starting-with-authentication-a-tutorial-with-node-js-and-mongodb-25d524ca0359

const port = 5024

import express from 'express'
const app = express()

import bodyParser from 'body-parser'
app.use(bodyParser.urlencoded({ extended: true }));
app.use( bodyParser.json() );       // to support JSON-encoded bodies

import session from 'express-session'
app.use(session({
  secret: 'work hard',
  resave: true,
  saveUninitialized: false
}));

var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();

import multer from 'multer';

const api = require('./routes/api');
// const admin_api = require('./routes/admin_api');

app.use(express.static('public'))

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

// get for test
app.get('/api/echo', api.echo);
// app.get('/create_user', api.create_user);
// app.get('/find_user', api.find_user);
// app.get('/login_with_email_password', api.login_with_email_password);

// download voice
app.get ('/api/voice_with_id', api.voice_with_id);


app.post('/api/echo', api.echo);
app.post('/api/create_user', api.create_user);
app.post('/api/login_with_email_password', api.login_with_email_password);
app.post('/api/login_with_token', api.login_with_token);
app.post('/api/logout', api.logout);
app.post('/api/get_voice_task', api.get_voice_task);
app.post('/api/get_completed_tasks', api.get_completed_tasks);
app.post('/api/report_failed_task', api.report_failed_task);
app.post('/api/skip_sentence', api.skip_sentence);
app.post('/api/get_reading_materials', api.get_reading_materials);
app.post('/api/select_reading_material', api.select_reading_material);
app.post('/api/get_random_example_script', api.get_random_example_script);
app.post('/api/retrieve_seed_text', api.retrieve_seed_text);

// admin
app.post('/api/get_app_status', api.get_app_status);
app.post('/api/update_app_status', api.update_app_status);


// import data test
// app.get('/api/admin/import_test', admin_api.admin_import_test);

let upload_audio = multer({ dest: './files' });
let upload_audio_type = upload_audio.single('upl');
app.post('/api/files', upload_audio_type, api.upload);

// let upload2 = multer({ dest: './files' });
// var type2 = upload2.single('upl2');
app.post('/api/voice_to_text', upload_audio_type, api.voice_to_text);

// epub upload test
app.post('/api/epub_upload', upload_audio_type, api.epub_upload);

// app.use(redirectUnmatched);
// function redirectUnmatched(req, res) {
//   res.redirect("https://projectinit.grabit.co/");
// }

app.listen(port);
console.log('Listening on port '+port+'...');
