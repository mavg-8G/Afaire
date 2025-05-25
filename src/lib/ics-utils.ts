
// Removed 'use server'; directive

import type { Activity } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { addHours, parseISO } from 'date-fns';

/**
 * Formats a JavaScript Date object into the iCalendar UTC datetime format (YYYYMMDDTHHMMSSZ).
 * @param date The Date object to format.
 * @returns The formatted ICS date string.
 */
export function formatToICSDate(date: Date): string {
  const pad = (num: number): string => (num < 10 ? '0' : '') + num;
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Generates the content for an .ics (iCalendar) file for a given activity.
 * @param activity The activity to generate the ICS file for.
 * @param instanceDate Optional: The specific date of the instance for recurring activities.
 * @returns The string content of the .ics file.
 */
export function generateICSContent(activity: Activity, instanceDate?: Date): string {
  const eventDate = instanceDate || new Date(activity.createdAt);
  let startDate: Date;
  let endDate: Date;

  if (activity.time) {
    const [hours, minutes] = activity.time.split(':').map(Number);
    startDate = new Date(eventDate);
    startDate.setHours(hours, minutes, 0, 0); // Set local time
  } else {
    // If no specific time, default to start of the day (00:00) in local time
    startDate = new Date(eventDate);
    startDate.setHours(0, 0, 0, 0);
  }
  // Default duration of 1 hour
  endDate = addHours(startDate, 1);

  const uid = uuidv4();
  const dtstamp = formatToICSDate(new Date()); // Current time in UTC
  const dtstart = formatToICSDate(startDate); // Converts local startDate to UTC
  const dtend = formatToICSDate(endDate);     // Converts local endDate to UTC

  let description = activity.notes || '';
  if (activity.todos && activity.todos.length > 0) {
    description += '\\n\\nTodos:\\n';
    activity.todos.forEach(todo => {
      description += `- ${todo.text} (${todo.completed ? 'Completed' : 'Pending'})\\n`;
    });
  }
  // Escape special characters for ICS
  description = description.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
  const summary = (activity.title || 'Activity').replace(/,/g, '\\,').replace(/;/g, '\\;');


  // VTIMEZONE component for local timezone (simplified example)
  // A more robust solution would use a library or more complete VTIMEZONE data
  // For simplicity, this assumes the calendar client will handle timezone conversion from UTC well.

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YourAppName//ToDoFlow//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return icsContent;
}

/**
 * Triggers a browser download for a file.
 * @param filename The desired filename for the download.
 * @param content The string content of the file.
 * @param contentType The MIME type of the file.
 */
export function downloadFile(filename: string, content: string, contentType: string = 'text/calendar;charset=utf-8'): void {
  if (typeof window === "undefined") return; // Guard for non-browser environments

  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
