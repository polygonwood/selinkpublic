import KeycloakAuthClient from './AuthClient.mjs';
import executeGraphql from './executeGraphql.mjs';
import requestDriftSimulation from './requestDriftSimulation.mjs';
import { serverDomain} from  './settings.js';


const mikAuthClient = new KeycloakAuthClient({
  domain: serverDomain,
  realm: 'MIK',
  clientId: 'mik-ui-react',
  authorizationClientId: 'mik-ui',
  username: 'mik',
  // password: '1BrugseZot!',
  password: '2BrugseZotten!',
});

(async () => {
  try {
    console.log('Starting auth for ',serverDomain);
    await mikAuthClient.start();
    console.log('auth success');
  } catch (error) {
    console.log('Could not auth');
    throw error;
  }

  // Request graphql
  try {
    console.log('Executing graphql query');
    const result = await executeGraphql({
      query: 'query { incidents { totalCount } }',
      authToken: mikAuthClient.accessToken
    });
    console.log('Graphql results', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Could not execute graphql query');
    throw error;
  }


  // Request drift sim
  try {
    console.log('Starting drift sim');
    await requestDriftSimulation({
      latitude: 51.34132,
      longitude: 2.63451, 
      authToken: mikAuthClient.accessToken
    });
    console.log('Drift sim requested');
  } catch (error) {
    console.log('Could not request drift sim');
    throw error;
  }
})();
