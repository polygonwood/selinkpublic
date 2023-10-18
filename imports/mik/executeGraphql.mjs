import { fetch } from 'meteor/fetch';
import { serverURL} from  './settings.js';

const executeGraphql = async ({ operationName = '', variables = {}, query, authToken }) => {
  const res = await fetch(`${serverURL}/graphql`, {
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      operationName,
      variables,
      query,

    }),
    method: 'POST',
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
};

export default executeGraphql;
