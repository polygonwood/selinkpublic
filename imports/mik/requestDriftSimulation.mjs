import { fetch } from 'meteor/fetch';
import { serverURL} from  './settings.js';

const requestDriftSimulation = async ({
  latitude,
  longitude,
  authToken,
  startTimeEpoch = Math.round(Date.now() / 1000),
  durationInH = 2,
  uncertaintyPercentage = 0,
  timeStepInS = 600,
  objectType = 'PIW-1',
  spreadRadiusInMeters = 1,
  quantityOfUnits = 1,
}) => {
  const res = await fetch(`${serverURL}/ws/api/opendrift/driftRequest`, {
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      startTimeEpoch,
      durationInH: `${durationInH}`,
      latitude,
      longitude,
      objectType,
      timeStepInS,
      spreadRadiusInMeters,
      quantityOfUnits,
      uncertaintyPercentage,
    }),
    method: 'POST',
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
};

export default requestDriftSimulation;
