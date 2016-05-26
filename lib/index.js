// Copyright (c) 2016 ZBox, Spa. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const zimbraAdminApi = require('zimbra-admin-api-js');

const client = new zimbraAdminApi({
  'url': 'https://mail.zboxapp.com:9071/service/admin/soap',
  'user': 'petete@itlinux.cl',
  'password':'nadadad'
});

const callback = function(err, data) {
  if (err) return console.error(err);
  console.log(data);
};

client.getAllAccounts(callback, {maxResults: 7000, attrs: 'cn'});
