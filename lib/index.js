#!/usr/bin/env node --harmony

var command = require('commander');
fs = require('fs');
var prompt = require ('prompt');
prompt.message="";
var login = {
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

var json = require('json-file');
var access;


function initialize(){
	if(fs.existsSync('Acceso.json')){
		access = json.read('Acceso.json');
		const zimbraAdminApi = require('zimbra-admin-api-js');
		const client = new zimbraAdminApi(access.data);
	}
	else
		verifyAuth();

}

initialize();

'use strict';

function verifyAuth(){
	console.log("Not exist info for login");
	prompt.get(login, function(err,result){
		if(err) console.log(err.body);
		access = JSON.parse('{"url":"https://mail.zboxapp.com:9071/service/admin/soap", "user":"' + result.user + '", "password":"'+result.password+'"}');
		fs.writeFile('Acceso.json',JSON.stringify(access), function(err,res){
			if(err) console.log(err);
		});
		console.log("File login created!");
	});
}



//const zimbraAdminApi = require('zimbra-admin-api-js');
//const client = new zimbraAdminApi(access.data);

const callback = function(err, data) {
  if (err) return console.error(err);
  console.log(data);
};

function getAccount(account){
	client.getAccount(account, callback);
}


command
.option('ga, --getAccount <account>','Get account information',getAccount)
.parse(process.argv);
