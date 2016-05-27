#!/usr/bin/env node

var command = require('commander');
var jsonFile = require('json-file');
//var access = jsonFile.read('login.json');
'use strict';

const zimbraAdminApi = require('zimbra-admin-api-js');

const client = new zimbraAdminApi({
  'url': 'https://mail.zboxapp.com:9071/service/admin/soap',
  'user': 'david@zboxapp.com',
  'password':'160794david'
});

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
