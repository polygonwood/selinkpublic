const { QueryEngine } = require("@comunica/query-sparql");
import { store } from './graphdb.js';

export async function QueryGraph(customerName) {
    const myEngine = new QueryEngine();

    // let customerName = 'Sweetspot';
    const query = `
    PREFIX schema: <http://schema.org/>
    PREFIX se: <https://selink.be/>
    PREFIX eu: <http://eu.org/>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    SELECT ?project ?country WHERE {
        ?customerId rdf:type se:customer .
        ?customerId foaf:name "${customerName}" .
        ?customerId se:hasProject ?projectId .
        ?projectId foaf:name ?project .
        ?projectId schema:addressCountry ?countryId .
        ?countryId foaf:name ?country .
    }
  `;

    const bindingsStream = await myEngine.queryBindings(query, { sources: [store] });
    let results = [];
    bindingsStream.on('data', (binding) => {
        console.log(binding.toString('application/json')); // Quick way to print bindings for testing
        results.push({ "country": binding.get('country').value, "project": binding.get('project').value });
    });
    return new Promise((resolve, reject) => {
        bindingsStream.on('end',() => {
            // console.log('end',results);
            resolve(results);
        });
    });
}
