
import { exec } from 'child_process';
import { getSheetData, updateSheet } from './googleSheetHandler.js';
import { getEventParticipants } from './eventParticipantFetcher.js';

const runScript = (scriptPath) => {
  return new Promise((resolve, reject) => {
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing ${scriptPath}:`, stderr);
        return reject(error);
      }
      console.log(stdout);
      resolve(stdout);
    });
  });
};

const updateRsvp = async () => {
  try {
    console.log('Updating user list...');
    await runScript('discordUserExporter.js');
    console.log('User list updated.');

    console.log('Fetching event participants...');
    const eventParticipants = await getEventParticipants();
    console.log('Event participants fetched.');

    console.log('Updating RSVP sheet...');
    const users = await getSheetData('Users');
    const events = await getSheetData('Event Setting');
    const rsvpData = await getSheetData('RSVP');

    const eventNames = rsvpData[0].slice(1);
    const userNames = rsvpData.map(row => row[0]);

    const newRsvpData = rsvpData.map(row => [...row]);

    for (const eventName in eventParticipants) {
      const eventIndex = eventNames.indexOf(eventName);
      if (eventIndex === -1) continue;

      const participants = eventParticipants[eventName];
      for (const participant of participants) {
        const userIndex = userNames.indexOf(participant.userName);
        if (userIndex === -1) continue;

        newRsvpData[userIndex][eventIndex + 1] = '1';
      }
    }

    await updateSheet('RSVP', newRsvpData);
    console.log('RSVP sheet updated.');

  } catch (error) {
    console.error('❌ Failed to update RSVP sheet:', error);
  }
};

updateRsvp();
