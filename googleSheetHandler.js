
import {
  google
} from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const service_account_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
console.log('Environment variables:', Object.keys(process.env));
console.log('service_account_email (from process.env):', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
console.log('service_account_private_key (from process.env):', process.env.GOOGLE_PRIVATE_KEY);
const service_account_private_key = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheet_id = '14Ewx1hGSk4qHrPqO7DeQ0m_TGs14I-u64wOEIb3CGQE';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: service_account_email,
    private_key: service_account_private_key ? service_account_private_key.replace(/\n/g, '\n') : undefined,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export const getSheetData = async (sheetName) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheet_id,
      range: sheetName,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('❌ Failed to read data from Google Sheets:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return [];
  }
};

export const getEventDetailsFromSheet = async (eventName) => {
  try {
    const events = await getSheetData('Event Setting');
    const header = events[0];
    const eventNameColumnIndex = header.indexOf('Event Name');
    const priceColumnIndex = header.indexOf('Price');

    if (eventNameColumnIndex === -1 || priceColumnIndex === -1) {
      console.error('❌ Missing Event Name or Price column in Event Setting sheet.');
      return null;
    }

    const eventRow = events.find(row => row[eventNameColumnIndex] === eventName);

    if (eventRow) {
      const title = eventRow[eventNameColumnIndex];
      const fee = parseInt(eventRow[priceColumnIndex], 10);
      return { title, fee };
    } else {
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to get event details from sheet:', error.message);
    return null;
  }
};

export const updatePaymentStatusInSheet = async (discordUserId, eventName, status) => {
  try {
    const paymentsData = await getSheetData('Payments');
    const usersData = await getSheetData('Users');

    const userIdColumnIndex = usersData[0].indexOf('User ID');
    if (userIdColumnIndex === -1) {
      console.error('❌ Missing User ID column in Users sheet.');
      return false;
    }

    const userRow = usersData.find(row => row[userIdColumnIndex] === discordUserId);
    if (!userRow) {
      console.error(`❌ User with ID ${discordUserId} not found in Users sheet.`);
      return false;
    }
    const userName = userRow[0]; // Assuming User Name is in the first column

    const paymentsHeader = paymentsData[0];
    const userNameColumnIndexInPayments = paymentsHeader.indexOf('User Name');
    const eventColumnIndex = paymentsHeader.indexOf(eventName);

    if (userNameColumnIndexInPayments === -1 || eventColumnIndex === -1) {
      console.error(`❌ Missing User Name column or Event ${eventName} in Payments sheet.`);
      return false;
    }

    const userRowIndexInPayments = paymentsData.findIndex(row => row[userNameColumnIndexInPayments] === userName);

    if (userRowIndexInPayments === -1) {
      console.error(`❌ User ${userName} not found in Payments sheet.`);
      return false;
    }

    const newPaymentsData = paymentsData.map(row => [...row]);
    newPaymentsData[userRowIndexInPayments][eventColumnIndex] = status;

    await updateSheet('Payments', newPaymentsData);
    console.log(`✅ Payment status updated for user ${discordUserId} for event ${eventName} to ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update payment status in sheet:', error.message);
    return false;
  }
};


export const updateSheet = async (sheetName, data) => {
  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheet_id,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: data,
      },
    });
    console.log('✅ Successfully updated data in Google Sheets.');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to update data in Google Sheets:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return null;
  }
};


export const appendToSheet = async (sheetName, values) => {
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheet_id,
      range: `${sheetName}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });
    console.log('✅ Successfully appended data to Google Sheets.');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to append data to Google Sheets:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return null;
  }
};



