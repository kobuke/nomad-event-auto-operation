
import {
  google
} from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const service_account_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const service_account_private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const spreadsheet_id = '16Ywg7ICqoVhXJqMUpBHQBNb4BuQCWsHwvj7Yq5UJ6_Q';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: service_account_email,
    private_key: service_account_private_key,
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

    // Find user's name from the 'Users' sheet
    const userRowInUsers = usersData.find(row => row[1] === discordUserId); // Assumes userId is in column B (index 1)
    if (!userRowInUsers) {
      console.error(`❌ User with ID ${discordUserId} not found in Users sheet.`);
      return false;
    }
    const userName = userRowInUsers[0]; // Assumes User Name is in column A (index 0)

    const paymentsHeader = paymentsData[0];
    const userIdColIndex = 0; // Assuming 'User ID' is the first column (A) in 'Payments'
    const userNameColIndex = 1; // Assuming 'User Name' is the second column (B) in 'Payments'
    const eventColIndex = paymentsHeader.indexOf(eventName);

    if (eventColIndex === -1) {
      console.error(`❌ Event column "${eventName}" not found in Payments sheet.`);
      return false;
    }

    const userRowIndexInPayments = paymentsData.findIndex(row => row[userIdColIndex] === discordUserId);

    if (userRowIndexInPayments !== -1) {
      // User exists, update their status
      const range = `Payments!${String.fromCharCode(65 + eventColIndex)}${userRowIndexInPayments + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheet_id,
        range: range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[status]],
        },
      });
      console.log(`✅ Payment status updated for user ${userName} (${discordUserId}) for event ${eventName} to ${status}`);

    } else {
      // User does not exist, append a new row
      const newRow = Array(paymentsHeader.length).fill(''); // Create an empty row
      newRow[userIdColIndex] = discordUserId;
      newRow[userNameColIndex] = userName;
      newRow[eventColIndex] = status;

      await appendToSheet('Payments', [newRow]);
      console.log(`✅ New user ${userName} (${discordUserId}) added to Payments sheet with status "${status}" for event ${eventName}.`);
    }
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


export const updateCell = async (sheetName, row, col, value) => {
  try {
    const range = `${sheetName}!${String.fromCharCode(65 + col)}${row + 1}`;
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheet_id,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });
    console.log(`✅ Successfully updated cell ${range} in Google Sheets.`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to update cell ${range} in Google Sheets:`, error.message);
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

export const markUserAsLeft = async (userId) => {
  try {
    const usersData = await getSheetData('Users');
    const userRowIndex = usersData.findIndex(row => row[1] === userId); // Assuming userId is in column B (index 1)

    if (userRowIndex === -1) {
      console.log(`⚠️ User with ID ${userId} not found in 'Users' sheet. Cannot mark as left.`);
      return false;
    }

    // Assuming 'Status' column is the 3rd column (index 2)
    // User needs to ensure this column exists in their sheet
    const statusColumnIndex = 2; 

    // Create a copy to modify
    const newUsersData = usersData.map(row => [...row]);
    // Ensure the row has enough columns
    while (newUsersData[userRowIndex].length <= statusColumnIndex) {
      newUsersData[userRowIndex].push('');
    }
    newUsersData[userRowIndex][statusColumnIndex] = 'Left';

    await updateSheet('Users', newUsersData);
    console.log(`✅ Successfully marked user with ID ${userId} as 'Left' in 'Users' sheet.`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to mark user with ID ${userId} as 'Left' in sheet:`, error.message);
    return false;
  }
};




