# Timezone Conversion Tests

This directory contains tests to verify that the calendar events timezone handling works correctly.

## Test Files

### 1. `calendar-events-timezone.test.ts`
A comprehensive Vitest test suite that covers:
- Date parameter calculation based on system time
- PST to local timezone conversion
- Edge cases and different timezone scenarios
- Integration testing

**Note**: This requires Vitest to be installed. To set up testing:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### 2. `browser-console-test.js`
A simple JavaScript test that can be run directly in the browser console.

**How to run:**
1. Open your app in the browser
2. Open Developer Tools (F12)
3. Go to the Console tab
4. Copy and paste the contents of `browser-console-test.js`
5. Press Enter to run the test

### 3. `manual-timezone-test.ts`
A TypeScript version of the manual test with additional functionality.

## What the Tests Verify

### 1. Date Parameter Passing
- ✅ System time is used to determine "today's" date
- ✅ Date is formatted as YYYY-MM-DD for API calls
- ✅ API receives correct date parameters

**Example:**
```
System time: 9/28/2025, 6:13:00 AM
API call: GET /get-events?start=2025-09-28&end=2025-09-28
```

### 2. Timezone Conversion
- ✅ PST times from API are correctly converted to local timezone
- ✅ Events display at the correct local time
- ✅ Time until calculations are accurate

**Example:**
```
API time: "4:30 AM" (PST)
London display: "1:30 PM" (4:30 AM + 8 hours PST + 1 hour London)
Status: "In 3 hours" (future event)
```

## Expected Results

### For London Timezone (UTC+1)
- **API Event**: `"start_time": "4:30 AM"` (PST)
- **Local Display**: `1:30 PM` (London time)
- **Time Until**: `"In 3 hours"` (if current time is 10:30 AM London)

### For New York Timezone (UTC-5)
- **API Event**: `"start_time": "4:30 AM"` (PST)
- **Local Display**: `7:30 AM` (New York time)
- **Time Until**: `"In 3 hours"` (if current time is 4:30 AM New York)

### For Tokyo Timezone (UTC+9)
- **API Event**: `"start_time": "4:30 AM"` (PST)
- **Local Display**: `9:30 PM` (Tokyo time, next day)
- **Time Until**: `"In 3 hours"` (if current time is 6:30 PM Tokyo)

## Troubleshooting

### If tests fail:

1. **Date Parameter Issues:**
   - Check that `toLocaleDateString('en-CA')` returns YYYY-MM-DD format
   - Verify system time is correct

2. **Timezone Conversion Issues:**
   - Check that PST offset (+8 hours) is applied correctly
   - Verify local timezone detection
   - Ensure Date objects are created properly

3. **Time Until Calculation Issues:**
   - Verify event times are in the future
   - Check that time differences are calculated correctly

## Manual Verification

You can also manually verify the functionality by:

1. **Checking Network Tab:**
   - Open Developer Tools → Network tab
   - Look for `/get-events` API calls
   - Verify the `start` and `end` parameters use today's date

2. **Checking Event Display:**
   - Look at event times in the UI
   - Verify they match your local timezone
   - Check that "time until" calculations are correct

3. **Testing Different Timezones:**
   - Change your system timezone
   - Refresh the app
   - Verify events display in the new timezone
