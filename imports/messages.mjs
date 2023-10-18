function _COSPASSARSAT(instance) {
    const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    const beacon = genRanHex(15).toUpperCase();
    instance.key.set(beacon);
    return {
        zeebe: 'MRCC',
        name: 'COSPASSARSAT',
        correlationKey: undefined,
        variables: {
            COSPASSARSAT: {
                Beacon: {
                    BeaconId: beacon,
                    Type: 'PLB',
                    Country: 205,
                    Homing: "121.5 MHz",
                    Model: "PLB-375",
                    Activation: "Category 2 (Manual only)"
                },
                Location: [2.71727778, 51.71491667],
                StartEvent: new Date()
            }
        }
    }
}

export const messages = {
    'COSPAS': _COSPASSARSAT
}