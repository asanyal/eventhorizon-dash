import { CalendarEvent } from '../types/calendar';

// Generate sample events for demo purposes
const now = new Date();

export const sampleEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Galileo Agent Next Logistics Call',
    startTime: new Date(now.getTime() + 12 * 60 * 60 * 1000 + 33 * 60 * 1000), // In 12h 33m
    duration: 30,
  },
  {
    id: '2',
    title: 'Refrain from scheduling | Ask before scheduling',
    startTime: new Date(now.getTime() + 13 * 60 * 60 * 1000 + 33 * 60 * 1000), // In 13h 33m
    duration: 120,
  },
  {
    id: '3',
    title: 'Kannan / Atin',
    startTime: new Date(now.getTime() + 17 * 60 * 60 * 1000 + 3 * 60 * 1000), // In 17h 3m
    duration: 30,
  },
  {
    id: '4',
    title: 'Engineering All Hands 👋',
    startTime: new Date(now.getTime() + 19 * 60 * 60 * 1000 + 3 * 60 * 1000), // In 19h 3m
    duration: 45,
  },
  {
    id: '5',
    title: 'POC Weekly Review',
    startTime: new Date(now.getTime() + 19 * 60 * 60 * 1000 + 33 * 60 * 1000), // In 19h 33m
    duration: 30,
  },
  // Add some urgent events for demo
  {
    id: '6',
    title: 'Urgent Client Call',
    startTime: new Date(now.getTime() + 30 * 60 * 1000), // In 30 minutes (critical)
    duration: 45,
  },
  {
    id: '7',
    title: 'Team Standup',
    startTime: new Date(now.getTime() + 90 * 60 * 1000), // In 1.5 hours (warning)
    duration: 15,
  },
  {
    id: '8',
    title: 'Product Planning Session',
    startTime: new Date(now.getTime() + 3 * 60 * 60 * 1000), // In 3 hours (normal)
    duration: 60,
  },
  {
    id: '9',
    title: 'Quarterly Business Review',
    startTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), // In 2 days (future)
    duration: 120,
  },
];