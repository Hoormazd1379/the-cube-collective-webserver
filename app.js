const express = require('express');
const path = require('path');
const logger = require('morgan');
const methodOverride = require('method-override');
const favicon = require('serve-favicon')

// const mineflayer = require('mineflayer');
// const standaloneViewer = require('prismarine-viewer').standalone
const { Vec3 } = require('vec3')

const fs = require('fs-extra');
const app = express();



app.use(logger('dev'));
app.use(express.urlencoded({ extended: false }));    // parse application/x-www-form-urlencoded
app.use(express.json({limit: '4MB'}));    // parse application/json

app.use(favicon(path.join(__dirname, 'public','favicon.ico'))); 
app.use(express.static(path.join(__dirname, 'public'), {index: "index.html"}));

app.use(methodOverride('_method'));

app.set('view engine', 'ejs');


//controllers
const routers = require('./routes');

app.use(routers.home);

//default fallback handlers
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // error handlers

  // development error handler
  // will print stacktrace
  if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      res.json({
        message: err.message,
        error: err
      });
    });
}

//MINEFLAYER
// const bot = mineflayer.createBot({
//     host: 'play.thecubecollective.net', // minecraft server ip
//     username: 'hoormazd.p@gmail.com', // minecraft username
//     auth: 'microsoft', // for offline mode servers, you can set this to 'offline'
//     // port: 25565,                // only set if you need a port that isn't 25565
//     version: '1.19.3',             // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
//     // password: '12345678'        // set if you want to use password-based auth (may be unreliable)
//   })

// const { mineflayer: mineflayerViewer } = require('prismarine-viewer');

// bot.once('spawn', () => {
//     mineflayerViewer(bot, { port: 3000, firstPerson: true }) // port is the minecraft server port, if first person is false, you get a bird's-eye view
//   })




//start server
app.set('port', process.env.PORT || 8080);

var server = require('http').createServer(app);

server.on('listening', function() {
  console.log('Express server listening on port ' + server.address().port);
});

server.listen(app.get('port'));


