import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Random } from 'meteor/random';
import { Form } from '@bpmn-io/form-js';
import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';

import './main.html';

import { Sops, Forms } from '../imports/api/collections.js';
import { messages } from '../imports/messages.mjs';

let schemas = [{
  form: 'Form_Project_Info',
  schema: {
    "components": [
      {
        "label": "Project name",
        "type": "textfield",
        "layout": {
          "row": "Row_14au7cv",
          "columns": 6
        },
        "id": "Field_0opye07",
        "key": "projectName",
        "description": "Enter the name of the project you want to create",
        "defaultValue": "MyProject",
        "validate": {
          "required": true,
          "minLength": 6
        }
      },
      {
        "values": [
          {
            "label": "Factory",
            "value": "F"
          },
          {
            "label": "Product line",
            "value": "P"
          }
        ],
        "label": "Type",
        "type": "radio",
        "layout": {
          "row": "Row_14au7cv",
          "columns": null
        },
        "id": "Field_0x9jm2l",
        "key": "projectType",
        "description": "Selcct the type of the project"
      },
      {
        "label": "Customer",
        "type": "select",
        "layout": {
          "row": "Row_1jn7f47",
          "columns": null
        },
        "id": "Field_0yrll9b",
        "key": "projectCustomer",
        "description": "Plant owner",
        "searchable": true,
        "valuesKey": "customers"
      },
      {
        "values": [
          {
            "label": "Belgium",
            "value": "Belgium"
          },
          {
            "label": "France",
            "value": "France"
          },
          {
            "label": "Germany",
            "value": "Germany"
          },
          {
            "label": "The Netherlands",
            "value": "The Netherlands"
          }
        ],
        "label": "Country",
        "type": "select",
        "layout": {
          "row": "Row_0zdtoup",
          "columns": null
        },
        "id": "Field_149jkxw",
        "key": "projectCountry",
        "description": "Country of the installation",
        "searchable": true
      }
    ],
    "type": "default",
    "id": "Form_Project_Info",
    "executionPlatform": "Camunda Cloud",
    "executionPlatformVersion": "8.3.0",
    "exporter": {
      "name": "Camunda Modeler",
      "version": "5.16.0"
    },
    "schemaVersion": 11
  },
  data: {
    "customers": [
      {
        "label": "Unilin", "value": "Unilin"
      },
      {
        "label": "Bors", "value": "Bors"
      },
      {
        "label": "Sweetspot", "value": "Sweetspot"
      },
      {
        "label": "Agristo", "value": "Agristo"
      }
    ]
  }
}];

Template.MOB.onCreated(function MOBOnCreated() {
  // counter starts at 0
  this.key = new ReactiveVar();
  this.token = new ReactiveVar();
  this.processId = new ReactiveVar();
  Meteor.setInterval(() => {
    Meteor.call('get.token', (err, res) => {
      // console.log('token result', new Date());
      this.token.set(res);
    });
  }, 5000);
  let forms = Forms.find({}).fetch();
  console.log('forms', forms);
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
    let forms = Forms.find({ hold: true, schema: { $exists: false } }).fetch();
    console.log('holded forms', forms);
    return forms;
  },
  launch() {
    if (!Template.instance().processId.get()) {
      return true;
    }
  },
  token() {
    // console.log('token',Template.instance().token.get());
    let token = Template.instance().token.get();
    let value = `Bearer ${token}`;
    return `{ "Authorization": "${value}" }`;
  },
  canceloption() {
    if (Template.instance().processId.get() === 'PROJECTB') {
      return true;
    }
  }
});

Template.MOB.events({
  'click #RESET'(event, instance) {
    Meteor.callAsync('reset.poc');
    instance.key.set(undefined);
    instance.processId.set(undefined);
  },
  'click .messageButton'(event, instance) {
    let messageType = event.target.id;
    console.log('message', messageType, typeof (messages[messageType]));
    Meteor.call('send.message', messages[messageType](instance));
  },
  'click #CANCEL'(event, instance) {
    let key = instance.key.get();
    Meteor.call('send.message', {
      zeebe: 'SELINK',
      name: 'Cancel_Create_Project',
      correlationKey: key,
      variables: {}
    });
    instance.processId.set(undefined);
  },
  'click #PROJECT'(event, instance) {
    instance.key.set(Math.floor(Math.random() * 1000000000).toFixed());
    Meteor.call('send.message', {
      zeebe: 'SELINK',
      name: 'START_CREATE_PROJECT',
      correlationKey: undefined,
      variables: {
        entityId: "12345",
        entityDefinitionName: "project",
        startDate: new Date(),
        uuid: instance.key.get()
      }
    });
    instance.processId.set('PROJECT');
  },
  'click #PROJECTB'(event, instance) {
    instance.key.set(Math.floor(Math.random() * 1000000000).toFixed());
    Meteor.call('send.message', {
      zeebe: 'SELINK',
      name: 'START_CREATE_PROJECT_BOUNDARY',
      correlationKey: undefined,
      variables: {
        entityId: "12345",
        entityDefinitionName: "project",
        startDate: new Date(),
        uuid: instance.key.get()
      }
    });
    instance.processId.set('PROJECTB');

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
    if (form) Meteor.callAsync('release.form', { zeebe: form.zeebe, formId: form._id });
  }
});

Template.SOP.helpers({
  sop() {
    return Template.instance().data.data;
  },
  forms() {
    let forms = Forms.find({ sop: Template.instance().data.data });
    // console.log('help forms', forms);
    return forms;
  }
});

Template.FORM.onCreated(function FORMOnCreated() {
  this.submitted = new ReactiveVar();
  this.submitted.set(false);
  this.active = new ReactiveVar();
  this.active.set(true);
});

Template.FORM.onRendered(function FORMOnRendered() {
  let formId = Template.instance().data.data.jobKey;
  async function renderForm(form, schema, data) {
    await form.importSchema(schema, data);
    form.on('submit', (event) => {
      console.log('on submit', event.data, event.errors);
    });
  }

  if (this.data.data.schema) {

    const form = new Form({
      container: document.querySelector(`#F${formId}`)
    });
    let schema = schemas.find((schema) => schema.form === this.data.data.schema);
    renderForm(form, schema.schema, schema.data);
    this.form = form;
  }
});

Template.FORM.helpers({
  form() {
    return Template.instance().data.data.name;
  },
  formId() {
    return `F${Template.instance().data.data.jobKey}`;
  },
  schema() {
    console.log('schema', Template.instance().data.data.schema);
    return Template.instance().data.data.schema ? !Template.instance().submitted.get() : false;
  },
  active() {
    let form = Forms.findOne({ _id: Template.instance().data.data._id });
    if (form.released) {
      Template.instance().active.set(false);
    }
    return Template.instance().active.get();
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
    let data = Template.instance().data.data.variables;
    if (data.query) {
      data.query = data.query.replace(/\"/g,"");
      data.query = data.query.replace(/&/g, '&amp;').replace(/</g, '+').replace(/>/g, '+')
      // data.query = data.query.replace(/\n/g,"<br>");
      console.log('data.query', data.query);
      return data.query + syntaxHighlight(data.data);
    }
    else return syntaxHighlight(data);
  }
});

Template.FORM.events({
  'click .formSubmitButton'(event, instance) {
    const {
      data,
      errors
    } = instance.form.submit();
    console.log('submitted data', data);
    Meteor.callAsync('release.form', { zeebe: instance.data.data.zeebe, formId: instance.data.data._id, result: data });
    instance.submitted.set(true);
    instance.active.set(false);
  }
});
