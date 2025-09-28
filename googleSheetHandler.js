
import {
  google
} from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const service_account_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const service_account_private_key = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheet_id = '14Ewx1hGSk4qHrPqO7DeQ0m_TGs14I-u64wOEIb3CGQE';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: service_account_email,
    private_key: service_account_private_key.replace(/\n/g, '\n'),
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



