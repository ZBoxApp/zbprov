#!/usr/bin/env node
'use strict';

var command = require('commander');
var fs = require('fs');
var prompt = require ('prompt');
var zimbraAdminApi = require('zimbra-admin-api-js');
var json = require('json-file');
var zimbraAttrs = {};

// Constantes del programa
const ZimbraAdminURL = "https://mail.zboxapp.com:9071/service/admin/soap";
const AuthDataFile = 'Acceso.json';

// Objeto base de autenticacion
var authObject = {
	url: ZimbraAdminURL,
	user: null,
	password: null
};

//para evitar el prompt como '$prompt'
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

//Crea y retorna cliente para trabajar contra Zimbra
function makeClient() {
	const client = new zimbraAdminApi(authObject);
	return client;
};

//Pregunta por los datos para acceder a Zimbra, retorna las credenciales
function askForLoginInfo(callback) {
	prompt.get(login, function(err, data) {
		if (err) return callback(err.body);
		authObject.user = data.user;
		authObject.password = data.password;
		return callback(null, authObject);
	});
};

//Escribe el archivo con las credenciales para zimbra
function writeLoginFile(authDataAsString, callback) {
	fs.writeFile(AuthDataFile, authDataAsString, function(err, data) {
		if (err) return callback(err);
		return callback(data);
	});
};

//función para iniciar todos los parámetros para la conexión
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
};

//inicializador para verificar conexion al server
const client = initialize();

const callback = function(err, data) {
  if (err) return console.error(err);
  return console.log(data);
};

//Traer info de una casilla.
function getAccount(account) {
	client.getAccount(account, callback);
};

//Agregar alias a una casilla
function addAccountAlias(account) {
	var alias = command.rawArgs.pop();
	//creo el usuario y asigno el alias
	makeUser(account, function(err, data){
		data.addAccountAlias(alias, callback);
	});
};

//retorna el usuario consultado
function makeUser(account, callback){
	client.getAccount(account, function(err, data) {
		if (err) return callback(err);
		return callback(null, data);
	});
};

//Recibe la casilla y el alías a remover
function removeAccountAlias(account) {
	var alias = command.rawArgs.pop();
//creo la casilla y ejecuto el removeAlias
	makeUser(account, function(err, data){
		data.removeAccountAlias(alias, callback);
	});
};

//recibe casilla y elimina.
function deleteAccount(account){
	//crea al usuario para obtener el id
	makeUser(account, function(err, data){
		client.removeAccount(data.attrs.zimbraId, callback);
	});
};

//Recibe argumentos y retorna los n atributos en una variable;
function assignZimbraAttrs(args){
	var index = command.rawArgs.indexOf("ca");
	args.splice(0, index + 3);
	args.forEach(function(arg, i){
		if(i % 2 === 0){
			zimbraAttrs[arg] = args[i + 1];
		}
	});
	return zimbraAttrs;
};

//Recibe account y pass para crear casilla.
function createAccount(account){
	var index = command.rawArgs.indexOf(account);
	var pass = command.rawArgs[index + 1];
	//Recibe los atributos para la casilla
	var attrs = assignZimbraAttrs(command.rawArgs);
	client.createAccount(account, pass, attrs, callback); //REVISAR ERROR CON PATO
};

//Renombra una casilla
function renameAccount(account){
	var rename = command.rawArgs.pop();
	//se crea el usuario y se renombra
	makeUser(account, function(err, data){
		data.rename(rename, callback);
	});
};

//Cambia el password de una casilla
function setPassword(account){
	var pass = command.rawArgs.pop();
	//se crea el usuario y se asigna nueva contraseña
	makeUser(account, function(err, data){
		data.setPassword(pass, callback);
	});
};

command
.option('ga, --getAccount <account>','Get account information',getAccount)
.option('aaa <account> <accountAlias>','Add account alias',addAccountAlias)
.option('raa <account> <accountAlias>','Remove account alias', removeAccountAlias)
.option('da <account>','Delete account', deleteAccount)
.option('ra <account> <newname>','Rename account ', renameAccount)
.option('sp <account> <password>','Set password account ', setPassword)
.parse(process.argv);
