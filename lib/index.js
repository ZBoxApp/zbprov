#!/usr/bin/env node
'use strict';

var command = require('commander');
var fs = require('fs');
var prompt = require ('prompt');
var zimbraAdminApi = require('zimbra-admin-api-js');
var json = require('json-file');
var zimbraAttrs = {};
var bytes = require ('bytes');
var entries = require ('object.entries');

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

// Constantes del programa
const ZimbraAdminURL = "https://mail.zboxapp.com:9071/service/admin/soap";
const pathAuthDataFile = 'Acceso.json';

// Hack Para que Object tenga entries
if (!Object.entries) {
    entries.shim();
}

// Objeto base de autenticacion
var authObject = {
	url: ZimbraAdminURL,
};

//para evitar el prompt como '$prompt'
prompt.message = '';

//Pregunta por los datos para acceder a Zimbra, retorna las credenciales
function askForLoginInfo(callback) {
	prompt.get(login, function(err, data) {
		if (err) return callback(err.body);
		authObject.user = data.user;
		authObject.password = data.password;
		return callback(null, authObject);
	});
};


//obtiene Token
function getToken(client){
  //hace login con instancia cliente para obtener tocken
  client.login(function(err, data){
    //preparo objeto para escribir el archivo
    var userToken = {};
    userToken.user = authObject.user;
    userToken.token = client.client.token;
    //Auth con los datos como json y no como object
    const auth = JSON.stringify(userToken)
    //se guarda user y token en Acceso.json
    writeLoginFile(auth, function(err, data){
      if(err) return console.error(err);
      return client;
    });
  });
};

//crea cliente
function makeClient(callback){
  const client = new zimbraAdminApi(authObject);
  if (!fs.existsSync(pathAuthDataFile)) {
    getToken(client);
  }else{
    const authDataObject = json.read(pathAuthDataFile).data;
    authObject.user = authDataObject.user;
    authObject.token = authDataObject.token;
    const client = new zimbraAdminApi(authObject);
    client.client.token = authObject.token;
    console.log(client);
    return client;
  }
};

//Verifica que el token sea el mismo que existe en Acceso.json
function checkToken(){};


//Escribe el archivo con las credenciales para zimbra
function writeLoginFile(authDataAsString, callback) {
	fs.writeFile(pathAuthDataFile, authDataAsString, function(err, data) {
		if (err) return callback(err);
		return callback(data);
	});
};

//función para iniciar todos los parámetros para la conexión
function initialize(){
	if (!fs.existsSync(pathAuthDataFile)) {
    //si no existe el archivo Acceso.json con los datos los pregunta
		askForLoginInfo(function(err, data) {
      //crea la instancia cliente para poder ser usado
      makeClient();
    });
  } else {
    return makeClient();
    //checkToken();
    // const authDataObject = json.read(pathAuthDataFile).data;
		// authObject.user = authDataObject.user;
		// authObject.password = authDataObject.password;
    // authObject.token = authDataObject.token;
		// return makeClient();
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
	if(index != -1){
		args.splice(0, index + 3);
		args.forEach(function(arg, i){
			if(i % 2 === 0){
				zimbraAttrs[arg] = args[i + 1];
			}
		});
	} else {
		index = command.rawArgs.indexOf("ma");
		args.splice(0, index + 2);
		args.forEach(function(arg, i){
			if(i % 2 === 0){
				zimbraAttrs[arg] = args[i + 1];
			}
		});
	}
	return zimbraAttrs;
};

//Recibe account y pass para crear casilla.
function createAccount(account){
	var index = command.rawArgs.indexOf(account);
	var pass = command.rawArgs[index + 1];
	//Recibe los atributos para la casilla
	var attrs = assignZimbraAttrs(command.rawArgs);
	client.createAccount(account, pass, attrs, callback);
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

//Recibe la cuenta y los valores a modificar
function modifyAccount(account){
	var attrs = assignZimbraAttrs(command.rawArgs);
	console.log(attrs);
	makeUser(account, function(err, data){
		if (err) return console.log(err);
		client.modifyAccount(data.attrs.zimbraId, attrs, callback);
	});
};


function getContacts(account){

};

//Para obtener tamaños de las casillas.
function getSize(account){
	makeUser(account, function(err, data){
		data.getMailbox(function(err, data){
			if(err) return console.log(err);
			return console.log(account + " size: " + bytes(data.size));
		});
	});
};

//obtener todas las casillas
function getAllAccountDomain(domain){
  var query = {domain: domain};
  client.getAllAccounts(function(err, data){
    if(err) return console.log(err);
    data.account.forEach(function(account){
      return console.log(account.name);
    })
  },query)
};

//Ajustar COS de una casilla
// funcion setAccountCos(account){
//
// };

command
.option('ga, --getAccount <account>','Get account information',getAccount)
.option('aaa <account> <accountAlias>','Add account alias',addAccountAlias)
.option('raa <account> <accountAlias>','Remove account alias', removeAccountAlias)
.option('da <account>','Delete account', deleteAccount)
.option('ra <account> <newname>','Rename account ', renameAccount)
.option('sp <account> <password>','Set password account ', setPassword)
.option('ca <account> <password> [attr1 val1 attr2 val2 etc]','Create account ', createAccount)
.option('ma <account> [attr1 val1 attr2 val2 etc]','Modify account ', modifyAccount)
.option('gaad <domain>','Get all account of domain ', getAllAccountDomain)
.option('gs <account>','Get size of an account ', getSize)
// .option('sac <account> <cosIdOrName>','Set account COS ', setAccountCos)
.parse(process.argv);
