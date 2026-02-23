const axios = require('axios');

const KINTONE_DOMAIN = 'https://can-one.kintone.com';
const APP_ID = 15;
const API_TOKEN = 'jn7AU8XVOdGQd7TOQId9kfkmd34IcwAOoyKEDmgw'; // must have read/write access to App 15
const CODE_FIELD = 'Customer_Code';
const TAG_FIELD = 'Custag';
const SUBTAG_FIELD = 'Subcustag';
const DIGITS = 2;

module.exports = async (req, res) => {
  try {
    const recordId = req.body.recordId;

    // Step 1: Get the newly created record
    const recordResp = await axios.get(`https://${KINTONE_DOMAIN}/k/v1/record.json`, {
      params: { app: APP_ID, id: recordId },
      headers: { 'X-Cybozu-API-Token': API_TOKEN }
    });

    const record = recordResp.data.record;
    const tag = record[TAG_FIELD].value;
    const subTag = record[SUBTAG_FIELD].value;

    if (!tag || !subTag) {
      console.log('Missing tag or subtag, skipping code generation');
      return res.status(200).send();
    }

    const prefix = tag + subTag;

    // Step 2: Query all existing codes with this prefix
    const query = `${CODE_FIELD} like "${prefix}%" limit 500`;
    const existingResp = await axios.get(`https://${KINTONE_DOMAIN}/k/v1/records.json`, {
      params: { app: APP_ID, query },
      headers: { 'X-Cybozu-API-Token': API_TOKEN }
    });

    let maxNumber = 0;

    existingResp.data.records.forEach(r => {
      const code = (r[CODE_FIELD].value || '').trim();
      const match = code.match(/(\d+)$/); // only numeric suffix at the end
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) maxNumber = num;
      }
    });

    // Step 3: Generate next code
    const nextNumber = String(maxNumber + 1).padStart(DIGITS, '0');
    const fullCode = prefix + nextNumber;

    // Step 4: Update the record with the new code
    await axios.put(`https://${KINTONE_DOMAIN}/k/v1/record.json`, {
      app: APP_ID,
      id: recordId,
      record: { [CODE_FIELD]: { value: fullCode } }
    }, { headers: { 'X-Cybozu-API-Token': API_TOKEN } });

    console.log(`Customer_Code updated to ${fullCode}`);
    return res.status(200).send();

  } catch (err) {
    console.error('Error generating Customer_Code:', err);
    return res.status(500).send(err.message);
  }
};
