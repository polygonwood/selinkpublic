import { Meteor } from 'meteor/meteor';
import { EJSON } from 'meteor/ejson';
import { ZBInstance } from './workers.mjs';
const { ZBClient, Duration } = require('zeebe-node');
import { v4 as uuidv4 } from 'uuid';
import KeycloakAuthClient from '../imports/mik/AuthClient.mjs';
import { serverDomain, secretPassword } from '../imports/mik/settings.js';

var MRCC;
var zbc = {};
var hosts = {
  'mikdevhost': '192.168.21.50:26500',
  'mikdemohost': '10.10.20.41:26500',
  'localhost': 'localhost:26500',
  'mikacchost': 'localhost:26500' // via SSH tunnel !
}
// var mikdevhost = '192.168.21.50:26500';
// var mikdemohost = '10.10.20.41:26500';
// var localhost = 'localhost:26500';
// pick the right server !
// var zeebehostMRCC = 'mikdevhost';
var zeebehostMRCC = 'mikdevhost';

import '../imports/api/collections.js';
import { Sops } from '../imports/api/collections.js';
import { Forms } from '../imports/api/collections.js';

Meteor.startup(async () => {
  // connect to MRCC instance
  let mikAuthClient;
  if (zeebehostMRCC != 'localhost') {
    mikAuthClient = new KeycloakAuthClient({
      domain: serverDomain,
      realm: 'MIK',
      clientId: 'mik-ui-react',
      authorizationClientId: 'mik-ui',
      username: 'mik',
      // password: '1BrugseZot!',
      password: secretPassword,
    });
    try {
      console.log('Starting auth for', serverDomain);
      await mikAuthClient.start();
      // console.log('auth success',`***${mikAuthClient.accessToken}***`);
      console.log('auth success');
    } catch (error) {
      console.log('Could not auth');
      throw error;
    }
  }
  MRCC = new ZBInstance('MRCC', hosts[zeebehostMRCC], mikAuthClient);
  zbc['MRCC'] = MRCC.getZBC();
});

Meteor.methods({
  'get.token'() {
    if (MRCC) {
      let token = MRCC.getToken();
      // console.log('server token',new Date());
      return token;
    }
    return 'DO NOT USE - TOKEN UNDEFINED';
  },
  'send.message'({ zeebe, name, correlationKey, variables }) {
    if (correlationKey) {
      console.log('send event message', zeebe, name, correlationKey, variables);
      zbc[zeebe].publishMessage({
        correlationKey: correlationKey,
        messageId: uuidv4(),
        name: name,
        variables: EJSON.toJSONValue(variables),
        timeToLive: Duration.seconds.of(10), // seconds
      });
    }
    else {
      console.log('send start message', zeebe, name, variables);
      zbc[zeebe].publishMessage({
        correlationKey: undefined,
        messageId: uuidv4(),
        name: name,
        variables: EJSON.toJSONValue(variables),
        timeToLive: Duration.seconds.of(10), // seconds
      });
    }
  },
  'reset.poc'() {
    Sops.remove({});
    Forms.remove({});
  },
  'release.form'({ zeebe, formId }) {
    let form = Forms.findOne({ _id: formId });
    zbc[zeebe].completeJob({
      jobKey: form.jobKey,
      variables: form.outputVariables
    });
    if (form.leaveMessage)
      Meteor.call('send.message', {
        zeebe: zeebe, name: form.leaveMessage.message, correlationKey: form.leaveMessage.correlationKey, variables: form.leaveMessage.variables
      });
    Forms.update({ _id: formId }, { $set: { hold: false } });
  }
})
