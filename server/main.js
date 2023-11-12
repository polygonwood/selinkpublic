import { Meteor } from 'meteor/meteor';
import { EJSON } from 'meteor/ejson';
import { ZBInstance } from './workers.mjs';
const { ZBClient, Duration } = require('zeebe-node');
import { v4 as uuidv4 } from 'uuid';
import KeycloakAuthClient from '../imports/mik/AuthClient.mjs';
import { serverDomain, secretPassword } from '../imports/mik/settings.js';
import { InitGraphDB,store } from './graphdb.js';
import { QueryGraph } from './sparql.js';

var SELINK;
var zbc = {};
var hosts = {
  // 'mikdevhost': '192.168.21.50:26500',
  // 'mikdemohost': '10.10.20.41:26500',
  'localhost': 'localhost:26500',
  // 'mikacchost': 'localhost:26500' // via SSH tunnel !
}
var zeebehostSELINK = 'localhost';

import '../imports/api/collections.js';
import { Sops } from '../imports/api/collections.js';
import { Forms } from '../imports/api/collections.js';

Meteor.startup(async () => {
  // connect to camunda instance
  let mikAuthClient;
  // if (zeebehostSELINK != 'localhost') {
  //   mikAuthClient = new KeycloakAuthClient({
  //     domain: serverDomain,
  //     realm: 'MIK',
  //     clientId: 'mik-ui-react',
  //     authorizationClientId: 'mik-ui',
  //     username: 'mik',
  //     // password: '1BrugseZot!',
  //     password: secretPassword,
  //   });
  //   try {
  //     console.log('Starting auth for', serverDomain);
  //     await mikAuthClient.start();
  //     // console.log('auth success',`***${mikAuthClient.accessToken}***`);
  //     console.log('auth success');
  //   } catch (error) {
  //     console.log('Could not auth');
  //     throw error;
  //   }
  // }
  SELINK = new ZBInstance('SELINK', hosts[zeebehostSELINK], mikAuthClient);
  zbc['SELINK'] = SELINK.getZBC();
  InitGraphDB();
  // await Forms.removeAsync({});
  // await Sops.removeAsync({});
});

Meteor.methods({
  'get.token'() {
    if (SELINK) {
      let token = SELINK.getToken();
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
  async 'reset.poc'() {
    await Sops.removeAsync({});
    await Forms.removeAsync({});
  },
  async 'release.form'({ zeebe, formId, result }) {
    let form = await Forms.findOneAsync({ _id: formId });
    let variables = form.outputVariables;
    if (form.schema) {
      variables = { ...variables, schemaOutput: result };
    }
    zbc[zeebe].completeJob({
      jobKey: form.jobKey,
      variables: variables
    });
    if (form.leaveMessage)
      Meteor.call('send.message', {
        zeebe: zeebe, name: form.leaveMessage.message, correlationKey: form.leaveMessage.correlationKey, variables: form.leaveMessage.variables
      });
    await Forms.updateAsync({ _id: formId }, { $set: { hold: false, released: true } });
  },
  async 'query.graph'(customerName) {
    let result = await QueryGraph({ customerName: customerName, store: store });
    console.log('query.graph', result);
    return result;
  }
})
