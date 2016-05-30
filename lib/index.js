#!/usr/bin/env node 
'use strict';

var command = require('commander');
var fs = require('fs');
var prompt = require ('prompt');
var zimbraAdminApi = require('zimbra-admin-api-js');
var json = require('json-file');

// Constantes del programa
const ZimbraAdminURL = "https://mail.zboxapp.com:9071/service/admin/soap";
const AuthDataFile = 'Acceso.json';

// Objeto base de autenticacion
var authObject = {
	url: ZimbraAdminURL,
	user: null,
	password: null
};

//para evitar que el prompt aparezca como 'prompt'
prompt.message = '';

//parametros para solicitar información de acceso
const login = {
	properties: {
		user: {
			pattern: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
			message: 'Name must be only letters, spaces, or dashes',
			required: true
		},
		password: {
			hidden: true
		}
	}
};

function makeClient() {
	const client = new zimbraAdminApi(authObject);
	return client;
}

function askForLoginInfo(callback) {
	prompt.get(login, function(err, data) {
		if (err) return callback(err.body);
		authObject.user = data.user;
		authObject.password = data.password;
		return callback(null, authObject);
	});
}

function writeLoginFile(authDataAsString, callback) {
	fs.writeFile(AuthDataFile, authDataAsString, function(err, data) {
		if (err) return callback(err);
		return callback(data);
	});
}

function initialize(){

	if (!fs.existsSync(AuthDataFile)) {
		askForLoginInfo(function(err, data) {
			if (err) return console.log(err);
			
			const authDataAsString = JSON.stringify(data);
			
			writeLoginFile(authDataAsString, function(err, data) {
				if (err) return console.log(err);
				return makeClient();
			});
		});
	} else {
		const authDataObject = json.read(AuthDataFile).data;
		authObject.user = authDataObject.user;
		authObject.password = authDataObject.password;
		return makeClient();
	}
}

//inicializador para verificar conexion al server
const client = initialize();

const callback = function(err, data) {
  if (err) return console.error(err);
  return console.log(data);
};

//Traer info de una casilla.
function getAccount(account) {
	client.getAccount(account, callback);
}

//Agregar alias a una casilla|| 'set' para no tener problemas con el 'add'
function setAccountAlias(account, accountAlias) {
	var alias = command.rawArgs.pop();
	client.getAccount(account, function(err, data){
		if (err) return console.log(err);
		else {
			var user = data;
			user.addAccountAlias(alias, callback);
		}
	});
}



command
.option('ga, --getAccount <account>','Get account information',getAccount)
.option('aaa <account> <accountAlias>','Add account alias',setAccountAlias)
.parse(process.argv);
