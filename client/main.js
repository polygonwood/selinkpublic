import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Random } from 'meteor/random';
import { _ } from 'meteor/underscore';

import './main.html';

import { Sops, Forms } from '../imports/api/collections.js';
import { messages } from '../imports/messages.mjs';

Template.MOB.onCreated(function MOBOnCreated() {
  // counter starts at 0
  this.key = new ReactiveVar();
  this.token = new ReactiveVar();
  Meteor.setInterval(() => {
    Meteor.call('get.token', (err, res) => {
      // console.log('token result', new Date());
      this.token.set(res);
    });
  }, 5000);
});

Template.MOB.helpers({
  key() {
    return Template.instance().key.get();
  },
  sops() {
    let sops = Sops.find({}).fetch();
    sops = _.chain(sops)
      .pluck("name")
      .unique()
      .value();
    console.log('sops', sops);
    return sops;
  },
  holdedForms() {
    let forms = Forms.find({ hold: true }).fetch();
    return forms;
  },
  token() {
    // console.log('token',Template.instance().token.get());
    let token = Template.instance().token.get();
    let value = `Bearer ${token}`;
    return `{ "Authorization": "${value}" }`;
  }
});

Template.MOB.events({
  'click #RESET'(event, instance) {
    Meteor.call('reset.poc');
    instance.key.set(undefined);
  },
  'click .messageButton'(event, instance) {
    let messageType = event.target.id;
    console.log('message', messageType, typeof (messages[messageType]));
    Meteor.call('send.message', messages[messageType](instance));
  },
  // 'click #RHS'(event, instance) {
  //   Meteor.call('send.message', {
  //     zeebe: 'MRCC',
  //     name: 'raised/type/OAI_AND_RHS',
  //     correlationKey: undefined,
  //     variables: {
  //       alarmId: 12345,
  //       vesselId: "235112806",
  //       StartEvent: new Date(),
  //       processId: Math.floor(Math.random() * 1000000000)
  //     }
  //   })
  // },
  'click #RHS'(event, instance) {
    Meteor.call('send.message', {
      zeebe: 'MRCC',
      name: 'start/topic/SOP241',
      correlationKey: undefined,
      variables: {
        entityId: "12345",
        entityDefinitionName: "incident",
        msgDate: new Date(),
        uuid: Math.floor(Math.random() * 1000000000).toFixed()
      }
    })
  },
  'click #RHSGONE'(event, instance) {
    Meteor.call('send.message', {
      zeebe: 'MRCC',
      name: 'cleared/type/AND_RHS',
      correlationKey: "mmsi.235112806",
      variables: {}
    })
  },
  'click #EMERGENCY'(event, instance) {
    let beacon = Math.abs(Math.trunc(Random.fraction() * 1000000));
    instance.key.set(beacon);
    let variables = {
      CallInfo: {
        Caller: {
          Telephone: '058 216754',
          Country: 'Belgium',
        },
        Date: new Date()
      },
      StartEvent: new Date()
    };
    Meteor.call('send.message', {
      zeebe: 'MRCC',
      name: 'EmergencyCall',
      correlationKey: undefined,
      variables: variables
    })
  },
  'click #TESTUNIT'(event, instance) {
    let start = new Date();
    let variables = {
      StartDate: start
    };
    Meteor.call('send.message', {
      zeebe: 'MRCC',
      name: 'StartTestForm',
      correlationKey: undefined,
      variables: variables
    })
  },
  'click #positionUpdate'(event, instance) {
    let key = instance.key.get();
    let variables = {
      COSPASSARSAT: {
        Beacon: {
          BeaconId: key,
          Type: 'PLB',
          Country: 205, Homing: "121.5 MHz",
          Model: "PLB-375",
          Activation: "Category 2 (Manual only)"
        },
        Location: [2.70997222, 51.70663889]
      },
      UpdateTimestamp: new Date()
    };
    Meteor.call('send.message', {
      zeebe: 'MRCC',
      name: 'COSPASSARSATUpdate',
      correlationKey: key,
      variables: variables
    })
  },
  'click #skipUpdates'(event, instance) {
    let key = instance.key.get();
    Meteor.call('send.message', {
      zeebe: 'MRCC',
      name: 'SkipWaitingBeaconUpdates',
      correlationKey: key,
      variables: {}
    })
  },
  'click #endActionMOB'(event, instance) {
    let key = instance.key.get();
    Meteor.call('send.message', {
      zeebe: 'MRCC',
      name: 'EndActionMOB',
      correlationKey: key,
      variables: {}
    })
  },
  'click .formButton'(event, instance) {
    // console.log('clicked on dynamic button',event.target.id);
    let formId = event.target.id;
    let form = Forms.findOne({ _id: formId });
    if (form) Meteor.call('release.form', { zeebe: form.zeebe, formId: form._id });
  }
});

Template.SOP.helpers({
  sop() {
    return Template.instance().data.data;
  },
  forms() {
    return Forms.find({ sop: Template.instance().data.data });
  }
});

Template.FORM.helpers({
  form() {
    return Template.instance().data.data.name;
  },
  data() {
    function syntaxHighlight(json) {
      if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
      }
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'key';
          } else {
            cls = 'string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'boolean';
        } else if (/null/.test(match)) {
          cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });
    }
    return syntaxHighlight(Template.instance().data.data.variables);
  }
});
