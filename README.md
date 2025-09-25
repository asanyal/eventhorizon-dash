# Event Horizon Dashboard

A React-based dashboard for displaying calendar events with real-time urgency indicators.

## Features

- Real-time calendar events display
- Time-based filtering (today, tomorrow, this week, etc.)
- Urgency indicators based on event proximity
- Responsive table layout
- API-driven data fetching

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Your calendar events API running

### Installation

1. Install dependencies:
```bash
npm install
# or
bun install
```

2. Configure your API endpoint:
Create a `.env` file in the root directory:
```bash
VITE_API_BASE_URL=http://localhost:8000
```

3. Start the development server:
```bash
npm run dev
# or
bun run dev
```

The application will be available at `http://localhost:5173`

## API Integration

The dashboard fetches events from your API endpoint: `GET /get-events?start=YYYY-MM-DD&end=YYYY-MM-DD`

### Expected API Response Format

```json
[
  {
    "event": "Event Name",
    "date": "Jan 15",
    "start_time": "9:30 AM",
    "end_time": "10:00 AM",
    "duration_minutes": 30,
    "time_until": "Past"
  }
]
```

### Configuration

- **API Base URL**: Set via `VITE_API_BASE_URL` environment variable
- **Default**: `http://localhost:8000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Urgency Indicators

- 🔴 **Critical**: Events within 45 minutes
- 🟡 **Warning**: Events within 45 minutes - 2 hours
- 🟢 **Normal**: Events within 2 - 24 hours
- 🔵 **Future**: Events more than 24 hours away