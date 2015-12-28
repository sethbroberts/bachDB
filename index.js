var express = require('express');
var path = require('path');
var app = express();

var port = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, '/')));

app.listen(port);

console.log('listening on: ' + port);
