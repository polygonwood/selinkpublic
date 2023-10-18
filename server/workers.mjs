import { Random } from 'meteor/random';
import { Sops, Forms } from '../imports/api/collections.js';
const { ZBClient, Duration } = require('zeebe-node');
import { fetch, Headers, Request, Response } from 'meteor/fetch';
import { EJSON } from 'meteor/ejson';
import executeGraphql from '../imports/mik/executeGraphql.mjs';
import requestDriftSimulation from '../imports/mik/requestDriftSimulation.mjs';
import { DateTime } from 'luxon';

export class ZBInstance {
  #host;
  #local = 'localhost:26500';
  #preparedOutput = {
    IBRD: {
      Vessel: {
        Name: "Aquata",
        IMO: "9651266",
        CallSign: "ORUF",
        TypeGeneral: "High Speed Craft",
        TypeSpecific: "Offshore Supply Ship",
        MMSI: "205079000",
        Flag: "BE"
      },
      Owner: {
        Name: 'Ronny Dewaele',
        Email: 'ronny.dewaele@ebo-enterprises.com',
        Telephone: '+32475325511'
      },
      NOK: {
        PrimaryContact: 'Katrien Maes',
        Telephone: '+32475662211'
      }
    },
    FalseAlarm: false,
    SARInfo: [{
      Resource: 'SAR Heli',
      Playtime: '90',
      ATD: '10:07'
    },
    {
      Resource: 'DAB Vloot',
      Playtime: '300',
      ATD: '10:03'
    }],
    MedEvac: true,
    DriftParameters: {
      type: 'Person in water',
      number: 1
    },
    SearchBoxParameters: {
      datum: {
        Lat: 51.495,
        Lon: 3.058
      },
      playTime: 60,
      type: 'Expanding Square',
      initialCourse: 50,
      legSpacing: 1,
      numberLegs: 16,
      searchSpeed: 10
    },
    RecoveryMedEvac: {
      RecoveryDate: {
        RecoveryTime: new Date(),
        Recoverylocation: [3.058, 51.495]
      },
      MedEvacRequired: true
    },
    IncidentTopic: 'MISSINGVESSEL',
    VesselInfo: {
      Vessel: {
        name: 'Aquatrot',
        owner: 'Steve Schippers',
        type: 'small fishing vessel',
        model: undefined,
        callSign: undefined,
        MMSI: undefined,
        IMO: undefined,
        port: 'Nieuwpoort',
        flag: undefined
      },
      Context: {
        departure: '24/03/2022 08:45',
        from: 'Nieuwpoort'
      }
    },
    BIPT: {
      MMSI: '205123456',
      DSC: false,
      EPRIB: 'ABC87FE',
      NOK: [{
        name: 'Deborah Destoute',
        relation: 'spouse',
        telephone: '058 2167754'
      }, {
        name: 'Bert Schippers',
        relation: 'brother',
        telephone: '0475 325511'
      }]
    },
    EnigLoket: {
      name: 'Aquatrot',
      owner: 'Steve Schippers',
      type: 'small fishing vessel',
      model: 'kotter',
      callSign: 'OPID',
      MMSI: '205123456',
      IMO: undefined,
      flag: 'Belgium',
      port: 'Nieuwpoort'
    },
    Output: {
      CallerName: 'Ronny Dewaele',
      IncidentTopic: 'MISSINGVESSEL',
      MISSINGVESSEL: true,
      UXO: false,
      WHALEASHORE: false
    },
    DSC: {
      channel: "67"
    },
    ABNL: {
      ABNLCase: true,
      ABNLCaseId: "ABNL012345"
    }
  }

  #queries = {
    'COSPAS':
      `query {
      incidents(
        filters: [
        { property: "name", operator: NOT_LIKE, values: ["%COSPAS%"] }
        { property: "vessels", operator: NOT_EMPTY }
      ]
    ) {
      entities {
        id
        name
        vessels {
          mmsi
          name
        }
      }
    }
  }`,
    'SRUSEA': `query {
    resources(filters:[{property:"category.name",operator:EQUAL_IGNORE_CASE,values:"SRU - Sea"}]) {
      entities {
        id
        name
        availabilities {
          location
          startTime
          endTime
        }
        category {
          name
        }
        
      }
    }
  }`,
  'DEFENSE':`query {

    resources(
      filters:[
       {property:"category.name",operator:EQUAL_IGNORE_CASE,values:"Defense"},
        {
          property:"availabilities.type.name",operator:EQUAL_IGNORE_CASE,values:"Varende middelen MIK · Patrouille / MSA / CSD"
        },
        {
          property:"availabilities.type.name",operator:NOT_NULL
        }
      ],
      limit:50
    )
    {
        entities {
          id
          name
          availabilities {
            location
            type {
              id
              name
            }
            startTime
            endTime
          }
          category {
            name
          }
          
        }
      }
    } 
  `,
  'CATEGORY':`query {

    resourceCategories(
  filters:[
    {property:"name",operator:EQUAL_IGNORE_CASE,values:"Defense"},
    {property:"resources",operator:NOT_EMPTY},
     limit:50
  ]
    )
    {
        entities {
          id
          name
          resources {
            name
          }
          #parent
        }
      }
    } `,
    'AVAILABILITIES':`query {
      resourceAvailabilities(
        filters: [
         { property: "resource.category.name", operator: EQUAL_IGNORE_CASE, values: "Defense" },
          {property:"startTime",operator:GREATER_EQUAL,values:"2022-12-01T15:30:00.000Z",valueType:DateTime}
        #  { property: "resources", operator: NOT_EMPTY }
          # limit:50
        ]
      ) {
        entities {
          id
          resource {
            category {
              name
            }
            name
          }
         startTime
          endTime
          type {
            name
          }
          #parent
        }
      }
    }`
  };

  constructor(zeebe, host, authClient) {
    this.zeebe = zeebe;
    this.#host = host;
    this.authClient = authClient;
    this.zbc = new ZBClient(host, {
      onReady: () => console.log('connected to Zeebe ', host),
      onConnectionError: () => console.log('Disconnected from Zeebe ', host)
    });
    this.attachWorkers();
  }

  getZBC() {
    return this.zbc;
  }

  getToken() {
    return this.authClient?.accessToken;
  }

  async attachWorkers() {
    let self = this;
    const topology = await this.zbc.topology();
    console.log('zeebe topology ', this.#host, JSON.stringify(topology, null, 2));

    const zbWorkerCOSPASSARSATAnalyzer = this.zbc.createWorker({
      taskType: 'COSPASSARSATAnalyzer',
      taskHandler: (...args) => {
        this.COSPASSARSATAnalyzerHandler(...args);
      },
      onReady: () => console.log('COSPA249600000SSARSAT Analyzer worker connected'),
      onConnectionError: () => console.log('COSPASSARSAT Analyzer worker disconnected')
    });

    const zbWorkerSendMessage = this.zbc.createWorker({
      taskType: 'SendMessage',
      taskHandler: function (...args) {
        self.SendMessageHandler(...args);
      },
      onReady: () => console.log('Send Message worker connected'),
      onConnectionError: () => console.log('Send Message worker disconnected')
    });

    const zbWorkerPrintData = this.zbc.createWorker({
      taskType: 'PrintData',
      taskHandler: function (...args) {249600000
        self.PrintDataHandler(...args);
      },
      onReady: () => console.log('Print Data worker connected'),
      onConnectionError: () => console.log('Print Data worker disconnected')
    });

    const zbWorkerCollectIBRD = this.zbc.createWorker({
      taskType: 'CollectIBRD',
      taskHandler: function (...args) {
        self.CollectIBRDHandler(...args)
      },
      onReady: () => console.log('Collect IBRD worker connected'),
      onConnectionError: (err) => console.log('Collect IBRD worker disconnected', err)
    });

    const zbWorkerSendSAR = this.zbc.createWorker({
      taskType: 'SendSAR',
      taskHandler: function (...args) {
        self.SendSARHandler(...args)
      },
      onReady: () => console.log('Send SAR worker connected'),
      onConnectionError: () => console.log('Send SAR worker disconnected')
    });

    const zbWorkerSearchBoxCalculator = this.zbc.createWorker({
      taskType: 'SearchBox',
      taskHandler: function (...args) {
        self.SearchBoxHandler(...args)
      },
      onReady: () => console.log('Search Box worker connected'),
      onConnectionError: () => console.log('Search Box worker disconnected')
    });

    const zbWorkerGraphQl = this.zbc.createWorker({
      taskType: 'graphql',
      taskHandler: function (...args) {
        self.GraphQlHandler(...args)
      },
      onReady: () => console.log('GraphQl worker connected'),
      onConnectionError: () => console.log('GraphQl worker disconnected')
    });

    const zbWorkerDSCChannelRequest = this.zbc.createWorker({
      taskType: 'DSCChannelRequest',
      taskHandler: function (...args) {
        self.DSCChannelRequestHandler(...args)
      },
      onReady: () => console.log('DSC Channel Request worker connected'),
      onConnectionError: () => console.log('DSC Channel Request worker disconnected')
    });

    const zbWorkerDriftRequest = this.zbc.createWorker({
      taskType: 'DriftRequest',
      taskHandler: function (...args) {
        self.DriftRequestHandler(...args)
      },
      onReady: () => console.log('Drift Request worker connected'),
      onConnectionError: () => console.log('Drift Request worker disconnected')
    });

    const zbWorkerQualityAnalysis = this.zbc.createWorker({
      taskType: 'QualityAnalysis',
      taskHandler: function (...args) {
        self.QualityAnalysisHandler(...args)
      },
      onReady: () => console.log('Quality Analysis worker connected'),
      onConnectionError: () => console.log('Quality Analysis worker disconnected')
    });

    const zbWorkerMIKSecurityRequest = this.zbc.createWorker({
      taskType: 'MIKSecurityRequest',
      taskHandler: function (...args) {
        self.MIKSecurityRequestHandler(...args)
      },
      onReady: () => console.log('MIK Security Request worker connected'),
      onConnectionError: () => console.log('MIK Security Request worker disconnected')
    });

    const zbWorker = this.zbc.createWorker({
      taskType: 'eta-start-calc',
      taskHandler: function (...args) {
        self.ETAStartCalc(...args)
      },
      onReady: () => console.log('ETA Start Calc worker connected'),
      onConnectionError: () => console.log('ETA Start Calc worker disconnected')
    });

    if (this.#host == this.#local) {
      const zbWorkerForm = self.zbc.createWorker({
        taskType: 'io.camunda.zeebe:userTask',
        timeout: Duration.seconds.of(300),
        taskHandler: function (...args) {
          self.FormHandler(...args);
        },
        onReady: () => console.log('Form worker connected'),
        onConnectionError: () => console.log('Form worker disconnected')
      });

      const zbWorkerEnsureIncident = this.zbc.createWorker({
        taskType: 'ensure-incident',
        taskHandler: function (...args) {
          self.EnsureIncidentHandler(...args);
        },
        onReady: () => console.log('Ensure Incident worker connected'),
        onConnectionError: () => console.log('Ensure Incident worker disconnected')
      });

      const zbWorkerDrain = this.zbc.createWorker({
        taskType: 'Drain',
        taskHandler: function (...args) {
          self.DrainHandler(...args);
        },
        onReady: () => console.log('Drain worker connected'),
        onConnectionError: () => console.log('Drain worker disconnected')
      });
    }
  }

  async PrintDataHandler(job, _, worker) {
    console.log('Task Print Handler', this.zeebe, job.bpmnProcessId);
    // console.log('job variables are', job.variables);
    let headers = Object.keys(job.customHeaders);
    // console.log('headers',headers);
    let variables = EJSON.fromJSONValue(job.variables);

    headers.forEach((tag) => {
      if (!(variables[tag] === undefined)) {
        console.log(`${tag} : ${variables[tag]}`);
        if (variables[tag] instanceof Date) console.log(`${tag} is a date !`);
      }
      else console.log('No variable found for ', tag);
    })
    const updateToBrokerVariables = {};
    return job.complete(updateToBrokerVariables);
  }

  async DSCChannelRequestHandler(job, _, worker) {
    console.log('Task DSC Channel Request', this.zeebe, job.bpmnProcessId, job.variables.channel);
    // console.log('job variables are', job.variables);
    let channel = job.variables.channel;
    try {
      fetch(`https://90a2-185-105-157-65.ngrok.io/api/channelrequest?tenant=vijverzonen&session=green&channel=${channel}`)
        .then(response => response.json())
        .then(data => {
          console.log(data);
        });
    }
    catch (err) {
      console.log(err);
    }
    const updateToBrokerVariables = {};
    return job.complete(updateToBrokerVariables);
  }

  async COSPASSARSATAnalyzerHandler(job, _, worker) {
    console.log('Task COSPASSARSAT', this.zeebe, job.bpmnProcessId);
    console.log('job variables are', job.variables);
    const COSPASSARSAT = job.variables.COSPASSARSAT;
    console.log('The Beacon type is ... ', COSPASSARSAT.Beacon.Type);
    const updateToBrokerVariables = {
      COSPASSARSATType: COSPASSARSAT.Beacon.Type
    }
    return job.complete(updateToBrokerVariables);
  }

  async SendMessageHandler(job, _, worker) {
    console.log('Task SendMessage', this.zeebe, job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    console.log('job headers are', job.customHeaders);
    let variables = EJSON.fromJSONValue(job.variables);
    let key = variables.correlationKey ? variables.correlationKey : undefined;
    let data = {};
    Object.keys(variables.info).forEach((k) => {
      data[k] = variables.info[k];
    })
    // data['info'] = variables.info;
    console.log('sending message with data',data);
    if (variables.entityId) data['entityId'] = variables.entityId;
    let zeebe = this.zeebe;
    let message;
    if (variables.Message) message = variables.Message;
    else message = job.customHeaders.Message;
    await new Promise((resolve, reject) =>
      Meteor.call('send.message', {
        zeebe: zeebe,
        name: message,
        correlationKey: key,
        variables: data
      }, (error, result) => {
        if (error) return reject(error);
        resolve(result)
      })
    );
    const updateToBrokerVariables = {};
    return job.complete(updateToBrokerVariables);
  }

  async FormHandler(job, _, worker) {
    console.log('Task Form', job.bpmnProcessId, job.customHeaders.assemblyCode, job.customHeaders.show);
    // console.log('form headers', job.customHeaders);
    // console.log('form variables', job.variables);
    console.log('job', job);
    Sops.upsert({ name: job.bpmnProcessId }, { $set: { name: job.bpmnProcessId } });
    let data;
    if (job.customHeaders.show) data = job.variables[job.customHeaders.show];
    else data = EJSON.fromJSONValue(job.variables);
    let hold = false;
    if (job.customHeaders.hold) hold = true;
    let variables = {};
    if (job.customHeaders.output) {
      variables[job.customHeaders.output] = this.#preparedOutput[job.customHeaders.output];
      console.log('output variables', variables);
    }
    let leaveMessage = job.variables.leaveMessage ? job.variables.leaveMessage : undefined;
    let zeebe = this.zeebe;
    await Forms.upsertAsync({ jobKey: job.key }, {
      $set: {
        zeebe: zeebe, sop: job.bpmnProcessId, name: job.customHeaders.assemblyCode,
        variables: data, hold: hold, jobKey: job.key, outputVariables: variables, leaveMessage: leaveMessage
      }
    });
    if (hold) return job.forward();
    else return job.complete(variables);
  }

  async CollectIBRDHandler(job, _, worker) {
    console.log('Task IBRD Request', job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    // console.log('beacon', job.variables.BeaconId);
    const updateToBrokerVariables = {
      IBRD: this.#preparedOutput.IBRD
    };
    return job.complete(updateToBrokerVariables);
  }

  async resolveAfterXSeconds(X, zeebe, message, key, data) {
    console.log('delayed response', message, data, key);
    return new Promise(resolve => {
      Meteor.setTimeout(() => {
        Meteor.call('send.message', {
          zeebe: zeebe,
          name: message,
          correlationKey: key,
          variables: data
        });
        resolve('resolved');
      }, X * 1000);
    });
  }

  async SendSARHandler(job, _, worker) {
    console.log('Task Send SAR Request', job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    // console.log('beacon', job.variables.BeaconId);
    this.resolveAfterXSeconds(10, this.zeebe, 'SARInfo', job.variables.entityId, { SARInfo: this.#preparedOutput.SARInfo })
    const updateToBrokerVariables = {};
    return job.complete(updateToBrokerVariables);
  }

  async MIKSecurityRequestHandler(job, _, worker) {
    console.log('Task MIK Security Request', job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    // console.log('beacon', job.variables.BeaconId);
    console.log('search', job.variables.searchVessel, 'MMSI', job.variables.MMSI);
    let securityVessel;
    if (job.variables.searchVessel && job.variables.searchVessel.mmsi) securityVessel = job.variables.searchVessel.mmsi;
    else securityVessel = job.variables.MMSI;
    this.resolveAfterXSeconds(20, this.zeebe, 'MIKResponseSecurity', job.variables.entityId,
      { securityVessel: securityVessel, securityAssessment: true })
    const updateToBrokerVariables = {};
    return job.complete(updateToBrokerVariables);
  }

  async EnsureIncidentHandler(job, _, worker) {
    console.log('Task Ensure Incident', job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    console.log('ensure incident', job.customHeaders.topic);
    const updateToBrokerVariables = {
      entityDefinitionName: 'incident',
      entityId: Math.abs(Math.trunc(Random.fraction() * 1000000))
    };
    return job.complete(updateToBrokerVariables);
  }

  async DriftRequestHandler(job, _, worker) {
    console.log('Task Request Drift Simulation', job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    console.log('request drift simulation', job.customHeaders.topic, job.variables.initial);
    let parameters;
    if (job.variables.initial) {
      parameters = {
        latitude: job.variables.DriftLocation[1],
        longitude: job.variables.DriftLocation[0],
        durationInH: 0,
        timeStepInS: 600,
        authToken: this.authClient.accessToken
      }
    }
    else {
      parameters = {
        latitude: job.variables.DriftLocation[1],
        longitude: job.variables.DriftLocation[0],
        durationInH: 2,
        timeStepInS: 600,
        authToken: this.authClient.accessToken
      }
    }
    try {
      console.log('Starting drift sim');
      await requestDriftSimulation(parameters);
      console.log('Drift simulation requested', job.variables.DriftLocation);
    } catch (error) {
      console.log('Could not request drift sim', error);
      // throw error;
    }
    const updateToBrokerVariables = {};
    return job.complete(updateToBrokerVariables);
  }

  async ETAStartCalc(job, _, worker) {
    console.log('Task ETA Start Calc Calculator', job.bpmnProcessId);
    console.log('job variables are',job.variables);
    const updateToBrokerVariables = {
      ETA: DateTime.fromJSDate(job.variables.StartEvent)
    };
    return job.complete(updateToBrokerVariables);
  }

  async SearchBoxHandler(job, _, worker) {
    console.log('Task Search Box Calculator', job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    const updateToBrokerVariables = {
      searchBoxId: 'BOX7734'
    };
    return job.complete(updateToBrokerVariables);
  }

  async QualityAnalysisHandler(job, _, worker) {
    console.log('Task Quality Analysis Calculator', job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    let variables = EJSON.fromJSONValue(job.variables);
    const elapsedTime = new Date(variables.RecoveryData.RecoveryTime - variables.StartEvent);
    console.log('elapsed time', variables.RecoveryData.RecoveryTime, variables.StartEvent, elapsedTime);
    const updateToBrokerVariables = {
      ElapsedTime: elapsedTime,
      MedEvacRequired: true
    };
    return job.complete(EJSON.toJSONValue(updateToBrokerVariables));
  }

  async GraphQlHandler(job, _, worker) {
    console.log('Task GraphQl request', job.bpmnProcessId, job.variables.query);
    let variables = EJSON.fromJSONValue(job.variables);
    let result;
    try {
      console.log('Executing graphql query', `query : +${variables.query}+`, `token : +${this.authClient.accessToken}+`);
      result = await executeGraphql({
        query: this.#queries[variables.query],
        authToken: this.authClient.accessToken
      });
      console.log('Graphql result', JSON.stringify(result, null, 2));
      // ETL
      let entities = result.data.resourceAvailabilities.entities;
      let cpvtable = [];
      entities.forEach(entity => {
        let vessel = entity.resource.name;
        let startTime = entity.startTime;
        let endTime = entity.endTime;
        cpvtable.push({
          vessel:vessel,
          startTime:startTime,
          endTime:endTime
        })
      });
      result = cpvtable;
      // ETL
    } catch (error) {
      console.log('Could not execute graphql query', error);
      throw error;
    }
    const updateToBrokerVariables = {
      result: result
    };
    return job.complete(EJSON.toJSONValue(updateToBrokerVariables));
  }

  async DrainHandler(job, _, worker) {
    console.log('Task Drain', job.bpmnProcessId);
    // console.log('job variables are',job.variables);
    const updateToBrokerVariables = {};
    return job.complete(EJSON.toJSONValue(updateToBrokerVariables));
  }
}