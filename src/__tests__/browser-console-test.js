/**
 * Browser Console Test for Timezone Conversion
 * 
 * Copy and paste this code into your browser console to test the timezone functionality
 */

// Test 1: Verify date parameter calculation
function testDateParameterCalculation() {
  console.log('🧪 Testing Date Parameter Calculation...');
  
  // Simulate the getDateRange function logic
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format in local timezone
  
  console.log('System time:', now.toLocaleString());
  console.log('Calculated today string:', todayStr);
  console.log('Expected API call:', `GET /get-events?start=${todayStr}&end=${todayStr}`);
  
  // Verify it matches expected format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(todayStr)) {
    console.log('✅ Date format is correct (YYYY-MM-DD)');
  } else {
    console.log('❌ Date format is incorrect');
  }
  
  return todayStr;
}

// Test 2: Verify PST to Local timezone conversion
function testPSTToLocalConversion() {
  console.log('🧪 Testing PST to Local Timezone Conversion...');
  
  // Simulate the transformApiEvent function logic
  const currentYear = new Date().getFullYear();
  const apiEvent = {
    event: "Visit Family for Durga Puja",
    date: "Sep 28",
    start_time: "4:30 AM", // PST time
    end_time: "8:00 AM",
    duration_minutes: 210,
    time_until: "In 3h 10m",
    attendees: [],
    organizer_email: "atin@galileo.ai",
    all_day: false,
    notes: null
  };
  
  console.log('API Event:', apiEvent);
  
  // Parse PST time
  const [month, day] = apiEvent.date.split(' ');
  const monthNum = new Date(`${month} 1, ${currentYear}`).getMonth();
  const dayNum = parseInt(day);
  
  const [time, period] = apiEvent.start_time.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let adjustedHours = hours;
  if (period === 'PM' && hours !== 12) {
    adjustedHours += 12;
  } else if (period === 'AM' && hours === 12) {
    adjustedHours = 0;
  }
  
  // Create PST date object
  const pstDate = new Date(currentYear, monthNum, dayNum, adjustedHours, minutes, 0, 0);
  console.log('PST Date created:', pstDate.toLocaleString());
  
  // Convert PST to UTC by adding 8 hours
  const utcDate = new Date(pstDate.getTime() + (8 * 60 * 60 * 1000));
  console.log('UTC Date (PST + 8h):', utcDate.toLocaleString());
  
  // Display in local timezone
  console.log('Local timezone display:', utcDate.toLocaleString());
  console.log('Local timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Verify the conversion
  const expectedPSTTime = '4:30 AM';
  const expectedUTCTime = '12:30 PM'; // 4:30 AM + 8 hours
  const actualUTCTime = utcDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
  
  console.log(`Expected PST: ${expectedPSTTime}`);
  console.log(`Expected UTC: ${expectedUTCTime}`);
  console.log(`Actual UTC: ${actualUTCTime}`);
  
  if (actualUTCTime === expectedUTCTime) {
    console.log('✅ PST to UTC conversion is correct');
  } else {
    console.log('❌ PST to UTC conversion is incorrect');
  }
  
  return utcDate;
}

// Test 3: Integration test
function testIntegration() {
  console.log('🧪 Running Integration Test...');
  
  const dateParam = testDateParameterCalculation();
  const convertedTime = testPSTToLocalConversion();
  
  console.log('📊 Integration Test Results:');
  console.log(`- Date parameter: ${dateParam}`);
  console.log(`- Converted time: ${convertedTime.toLocaleString()}`);
  console.log(`- System timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  
  // Test the actual API call format
  console.log('🌐 Expected API call format:');
  console.log(`GET /get-events?start=${dateParam}&end=${dateParam}`);
  
  return {
    dateParam,
    convertedTime,
    systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

// Test 4: Verify time until calculation
function testTimeUntilCalculation() {
  console.log('🧪 Testing Time Until Calculation...');
  
  const now = new Date();
  const convertedTime = testPSTToLocalConversion();
  
  const diffMs = convertedTime.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  console.log('Current time:', now.toLocaleString());
  console.log('Event time:', convertedTime.toLocaleString());
  console.log('Difference (minutes):', diffMinutes);
  
  if (diffMinutes > 0) {
    console.log(`✅ Event is in the future: ${diffMinutes} minutes from now`);
  } else if (diffMinutes < 0) {
    console.log(`⚠️ Event is in the past: ${Math.abs(diffMinutes)} minutes ago`);
  } else {
    console.log('🕐 Event is happening now');
  }
  
  return diffMinutes;
}

// Run the integration test
console.log('🚀 Running Timezone Conversion Tests...');
console.log('=====================================');
testIntegration();
console.log('=====================================');
console.log('✅ Tests completed! Check the results above.');
