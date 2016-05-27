var json = require('json-file');
var access;
access = json.read('Acceso.json');
console.log(access.data.url);