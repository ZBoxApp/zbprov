#!/usr/bin/env node
'use strict';

var command = require('commander');
var fs = require('fs');
var prompt = require ('prompt');
var zimbraAdminApi = require('zimbra-admin-api-js');
var json = require('json-file');
var bytes = require ('bytes');
var entries = require ('object.entries');
var zimbraAttrs = {};

//parametros para solicitar información de acceso
  const infoForLogin = {
	properties: {
		user: {
			pattern: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
			message: 'Name must be only letters, spaces, or dashes',
			required: true
		},
		password: {
			hidden: true
		},
    url: {
      pattern: /^(http|https):\/\/[^ "]+$/,
      message: 'URL error'
    }
	}
};

// Constantes del programa
const PATHAUTHDATAFILE = 'Acceso.json';
const ERROR_ZIMBRA_AUTH_EXPIRED = "service.AUTH_EXPIRED";

// Hack Para que Object tenga entries
if (!Object.entries) {
    entries.shim();
}

// Objeto base de autenticacion
var authObject = {};

//para evitar el prompt como '$prompt'
prompt.message = '';

//Pregunta por los datos para acceder a Zimbra, retorna las credenciales
function askForLoginInfo(callback) {
	prompt.get(infoForLogin, function(err, data) {
		if(err) return callback(err, null);
    authObject.url = data.url;
		authObject.user = data.user;
		authObject.password = data.password;
		return callback(null, authObject);
	});
};

//Guarda token y usuario. Llama a función que escribe el archivo acceso.json
function saveTokenUserAndURL(data){
  var userToken = {};
  userToken.url = authObject.url;
  userToken.user = authObject.user;
  userToken.token = data;
  //Auth con los datos como json y no como object
  const auth = JSON.stringify(userToken)
  //se guarda user y token en Acceso.json
  return writeLoginFile(auth);
};

//recibe Cliente y genera token
function getTokenFromClient(client){
  //hace login con instancia cliente para obtener token
  client.login(function(err, data){
    //preparo objeto para escribir el archivo
    var token = client.client.token;
    return saveTokenUserAndURL(token);
  });
};


//crea cliente
function makeClient(callback){
  if (!fs.existsSync(PATHAUTHDATAFILE)){
    const client = new zimbraAdminApi(authObject);
    getTokenFromClient(client);
  } else {
    const authDataObject = json.read(PATHAUTHDATAFILE).data;
    authObject.url = authDataObject.url;
    authObject.user = authDataObject.user;
    const client = new zimbraAdminApi(authObject);
    client.client.token = authDataObject.token;
    return client;
  }
};

//Escribe el archivo Acceso.json
function writeLoginFile(authDataAsString) {
	fs.writeFile(PATHAUTHDATAFILE, authDataAsString, function(err, data) {
		if(err) return callback(err);
		return ;
	});
};

//función para iniciar todos los parámetros para la conexión
function initialize(){
	if (!fs.existsSync(PATHAUTHDATAFILE)) {
    //si no existe el archivo Acceso.json con los datos los pregunta
		askForLoginInfo(function(err, data) {
      //crea la instancia cliente para poder ser usado
      return makeClient();
    });
  } else {
    return makeClient();
    }
};

//inicializador para verificar conexion al server
const client = initialize();

const callback = function(err, data) {
  if(err){
    try {
      if(err.extra.code === ERROR_ZIMBRA_AUTH_EXPIRED) throw "token expirado";
    }
    catch(err){
      client.client.debug = true;
      //Según el proceso que muestra se sigue enviando el token antiguo
      //Sending request to Zimbra:
      // {"Header":{"context":
      //    {"authToken":
      //      {"_content":"0_9cf55161c31362bbfca489e83091f77d89f487d8_69643d33363a66363237386637632d386366642d346463632d613230642d3866613730343333326165353b6578703d31333a313436383632313133333033333b61646d696e3d313a313b76763d313a323b747970653d363a7a696d6272613b7469643d393a3136303239393930393b76657273696f6e3d31333a382e362e305f47415f313135333b"},
      //       "session":{},
      //       "_jsns":"urn:zimbra",
      //       "format":{"type":"js"}}},
      //"Body":{"AuthRequest":{"account":{"by":"name","_content":"david@zboxapp.com"},"password":"160794david","_jsns":"urn:zimbraAdmin"}}}
      client.client.token = null;
      client.password = '160794david';
      //console.log(client.client);
      //const nueva = new zimbraAdminApi({'url':'user':'david@zboxapp.com','password':'160794david'});
      console.log(client);
      client.login(function(err, data){
        if(err) return console.log(err);
        return console.log(data);
      });

      // nueva.login(callback);
      //fs.unlink(PATHAUTHDATAFILE, (err) => {return console.log(err)});
      //console.log(client);
      return ;
    }
    return console.error(err);
  } else {
    return console.log(data);
  }
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
		if(err) return callback(err);
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

//Recibe argumentos y retorna los n atributos en un objeto;
function assignZimbraAttrs(args){
  var comando = command.rawArgs[2];
  switch (comando) {
    case "ca":
  		args.splice(0, 5);
  		args.forEach(function(arg, i){
  			if(i % 2 === 0){
  				zimbraAttrs[arg] = args[i + 1];
  			}
  		});
    break;
    case "cd":
    case "ma":
    case "csl":
    case "mdl":
		args.splice(0, 4);
		args.forEach(function(arg, i){
			if(i % 2 === 0){
				zimbraAttrs[arg] = args[i + 1];
			}
		});
    break;
    default:
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
		if(err) return console.log(err);
		client.modifyAccount(data.attrs.zimbraId, attrs, callback);
	});
};

//Para obtener tamaños de las casillas.
function getSizeAccount(account){
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
  client.getAllAccounts(query, (err, data) => {
    if(err) return callback(err, null);
    data.account.forEach(function(account){
      return console.log(account.name);
    });
  });
};

//Ajustar COS de una casilla
function setAccountCos(account){
  var index = command.rawArgs.indexOf(account);
	var cosId = {};
  cosId.zimbraCOSId = command.rawArgs[index + 1];
  makeUser(account, function(err, data){
    if(err) console.error(err);
    client.modifyAccount(data.attrs.zimbraId, cosId, callback);
  });
};

function getAllCos(){
  client.getAllCos(callback);
};

function getAllDistributionLists(){
  client.getAllDistributionLists(callback);
};

function getAccountMembership(account){
  client.getAccountMembership(account, function(err, data){
    if(err) callback(err);
    const result = [];
    data.forEach((list) => {
      result.push(list.name);
    })
    return callback(null, result.join("\n"));
  });
};

function getDomain(domain){
  client.getDomain(domain, callback);
};

// flushData parameter example would be like this {type: 'domain', allServers: 1, entry: 'zboxapp.dev'}
function flushCache(domain){
  var flushData = {type: 'domain', allServer: 1, entry: domain};
  client.flushCache(flushData, (err, cleared) => {
    if(err) { return callback(err);}
    return console.log(cleared);
  });
};

function countAccount(domain){
  client.getDomain(domain, (err, data) => {
    if(err) callback(err);
    return data.countAccounts(callback);
  });
};

function createDomain(domain){
  var attrs = assignZimbraAttrs(command.rawArgs);
  client.createDomain(domain, attrs, callback);
};

function deleteDomain(domain){
  makeDomain(domain, (err, data) => {
    if(err) callback(err);
    client.removeDomain(data.id, callback);
  });
};

function getAllDomains(){
  client.getAllDomains(callback);
};

function makeDomain(domain){
  client.getDomain(domain, (err, data) => {
    if(err) callback(err);
    return callback(null, data);
  });
}

function modifyDomain(domain){
  var attrs = assignZimbraAttrs(command.rawArgs);
	console.log(attrs);
	makeDomain(domain, (err, data) => {
		if(err) return callback(err);
		client.modifyDomain(data.id, attrs, callback);
  });
};

function createDistributionList(distributionList){
  attrs = assignZimbraAttrs(command.rawArgs);
  client.createDistributionList(distributionList, attrs, callback);
};

function makeDistributionList(distributionList){
  client.getDistributionList(distributionList, (err, data) => {
    if(err) callback(err);
    return data;
  });
};

function getDistributionList(distributionList){
  client.getDistributionList(distributionList, callback);
};

function makeArrayOfMembers(distributionList){
  var tope = command.rawArgs.indexOf(distributionList);
  var members = command.rawArgs.splice(0, tope);
  var arrayMembers =  command.rawArgs;
  return arrayMembers;
};

function addDistributionListMember(distributionList){
  var members = makeArrayOfMembers(distributionList);
  makeDistributionList(distributionList, (err, data) => {
    if(err) callback(err);
    data.addMembers(members, callback);
  });
};

function removeDistributionListMember(distributionList){
  var members = makeArrayOfMembers(distributionList);
  makeDistributionList(distributionList, (err, data) => {
    if(err) callback(err);
    data.removeMembers(members, callback);
  });
};

function getDistributionListmembership(distributionList){//PENDIENTE REVISAR CON PATO
  makeDistributionList(distributionList, (err, data) => {
    if(err) callback(err);
    data.getDistributionListmembership(callback);
  });
};

function modifyDistributionList(distributionList){
  attr = assignZimbraAttrs(command.rawArgs);
  makeDistributionList(distributionList, (err, data) => {
    if(err) callback(err);
    client.modifyDistributionList(data.id, attrs, callback);
  });
};

function deleteDistributionList(distributionList){
  makeDistributionList(distributionList, (err, data) => {
    if(err) callback(err);
    client.removeDistributionLis(data.id, callback);
  });
};

function renameDistributionList(distributionList){
  var rename = command.rawArgs.pop();
  makeDistributionList(distributionList, (err, data) => {
    if(err) callback(err);
    data.rename(rename,callback);
  });
};

command
.option('')
.option('ACCOUNTS')
.option('')
.option('ga, --getAccount <account>','Get account information',getAccount)
.option('aaa, --addAccountAlias <account> <accountAlias>','Add account alias',addAccountAlias)
.option('raa, --removeAccountAlias <account> <accountAlias>','Remove account alias', removeAccountAlias)
.option('da, --deleteAccount <account>','Delete account', deleteAccount)
.option('ra, --renameAccount <account> <newname>','Rename account ', renameAccount)
.option('sp, --setPassword <account> <password>','Set password account ', setPassword)
.option('ca, --createAccount <account> <password> [attr1 val1 attr2 val2 etc]','Create account ', createAccount)
.option('ma, --modifyAccount <account> [attr1 val1 attr2 val2 etc]','Modify account ', modifyAccount)
.option('gsa, --getSizeAccount <account>','Get size of an account ', getSizeAccount)
.option('sac, --setAccountCos <account> <cosId>','Set account COS ', setAccountCos)
.option('')
.option('COS')
.option('')
.option('gac, --getAllCos','Get all COS ', getAllCos)
.option('')
.option('DISTRIBUTION LIST')
.option('')
.option('cdl, --createDistributionList <distributionList> [attr1 val1 attr2 val2 etc] ','Create distribution list ', createDistributionList)
.option('gdl, --getDistributionList <distributionList>','Get distributionList information',getDistributionList)
.option('gdlm, --getDistributionListmembership <distributionList>','Get Get all DL of an distribution list ',getDistributionListmembership)
.option('adlm, --addDistributionListMember <distributionList> <account> ','Add member at distribution list ', addDistributionListMember)
.option('rdlm, --removeDistributionListMember <distributionList> <account> ','Remove member of distribution list', removeDistributionListMember)
.option('rdl, --renameDistributionList <distributionList> <newname>','Rename distributionList ', renameDistributionList)
.option('mdl, --modifyDistributionList <distributionList> [attr1 val1 attr2 val2 etc]','Modify distribution List ', modifyDistributionList)
.option('ddl, --deleteDistributionList <distributionList>','Delete distribution List', deleteDistributionList)
.option('gadl, --getAllDistributionList','Get all DL ', getAllDistributionLists)
.option('gam, --getAccountMembership <account>','Get all DL of an account ', getAccountMembership)
.option('')
.option('DOMAINS')
.option('')
.option('gd, --getDomain <domain>','Get domain ', getDomain)
.option('cd, --createDomain <domain> [attr1 val1 attr2 val2 etc]','Create domain ', createDomain)
.option('md, --modifyDomain <domain> [attr1 val1 attr2 val2 etc]','Modify domain ', modifyDomain)
.option('dd, --deleteDomain <domain>','Delete domain', deleteDomain)
.option('gad, --getAllDomains','Get all domains', getAllDomains)
.option('cta, --countAccount <domain>', 'List each COS, the COS ID and the number of account assigned to each COS', countAccount)
.option('gaad, --getAllAccountDomain <domain>','Get all account of domain ', getAllAccountDomain)
.option('fc, --flushCache <domain>','Flush cache domain ', flushCache)
.parse(process.argv);
