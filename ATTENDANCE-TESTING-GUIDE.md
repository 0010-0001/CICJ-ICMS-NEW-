# Attendance System Testing Guide

## ✅ Features Implemented

### Employee Dashboard
- **GPS-enabled Clock In/Out** with real-time location tracking
- **Geo-fencing validation** - Employees can only clock in/out when at construction sites
- **Attendance history** - View past clock-ins/outs grouped by date
- **Location permission handling** - Clear error messages for GPS issues
- **Accuracy warnings** - Alerts when GPS accuracy is low

### Admin Dashboard
- **Attendance Management Tab** - View all employee attendance logs
- **Construction Site Management** - Create, edit, activate/deactivate sites
- **GPS Geo-Fencing** - Configure site locations and perimeter radius
- **Attendance Statistics** - Currently clocked in, today's count, monthly totals
- **Export to CSV** - Download attendance data with GPS coordinates
- **Filters** - Filter by date, employee, or view all

---

## 🧪 Testing Instructions

### 1. Start the Backend Server

```powershell
cd backend
npm run dev
```

Server should start on **http://localhost:5000**

---

### 2. Test Employee Attendance (GPS Geo-Fencing)

#### A. Login as Employee
1. Open **http://localhost:5000/employee.html**
2. Use employee credentials or create a new employee account
3. Navigate to **My Attendance** tab (should be default)

#### B. Test Clock-In with GPS

**Expected Flow:**
1. Click **"Clock In"** button
2. Browser requests GPS permission → **Allow**
3. Button text changes: `Getting GPS...` → `Clocking In...`
4. GPS coordinates submitted to backend
5. Backend checks against construction sites using Haversine formula

**Test Scenarios:**

**Scenario 1: No Construction Sites Configured**
- **Result:** `⚠️ No construction sites configured. Please contact your administrator.`
- **Status Code:** 503

**Scenario 2: Outside Geo-Fence** (e.g., at home)
- **Result:** 
  ```
  ❌ Outside construction site perimeter
  
  📍 Nearest Site: CICJ Main Site
  📏 Your Distance: 1,234 meters
  ✅ Required: Within 100 meters
  ❗ You are 1,134 meters too far
  ```
- **Status Code:** 403

**Scenario 3: Inside Geo-Fence** (at construction site)
- **Result:**
  ```
  ✅ Clocked in successfully at 9:15 AM!
  
  📍 Site: CICJ Main Construction Site
  📏 Distance: 23m from center
  ```
- **Status Code:** 200
- **UI Updates:**
  - Today's Status: `Clocked In` (green)
  - Time In: `9:15 AM`
  - Attendance history refreshes

#### C. Test Clock-Out
1. Click **"Clock Out"** button
2. Same GPS validation process
3. If successful, Time Out updates

#### D. Test GPS Permission Denied
1. Click "Clock In"
2. When browser asks for permission → **Block**
3. **Result:** `❌ Clock-in failed: Location permission denied. Please enable GPS in your browser settings.`

#### E. Test Low GPS Accuracy
1. If GPS accuracy > 50 meters:
   ```
   GPS accuracy is low (±75m).
   This might affect geo-fence validation.
   
   Continue anyway?
   ```
2. Choose "Cancel" or "OK"

---

### 3. Test Admin Attendance Management

#### A. Login as Admin
1. Open **http://localhost:5000/admin.html**
2. Login with admin credentials (kpaysan.a12345472@umak.edu.ph)
3. Click **"Attendance Management"** in sidebar

#### B. View Attendance Dashboard

**Statistics Cards:**
- **Currently Clocked In:** Live count of employees at work
- **Today's Attendance:** Total logs today
- **Total This Month:** Monthly attendance count
- **Construction Sites:** Number of active sites

**Attendance Logs Table:**
- Employee name
- Action (Clock In / Clock Out)
- Timestamp
- GPS coordinates (latitude, longitude)
- Status (Valid / No GPS)
- Actions (View button)

#### C. Filter Attendance

**By Date:**
1. Select date in date picker
2. Table updates to show only that date's logs

**By Employee:**
1. Select employee from dropdown
2. Table filters to that user

**Clear Filters:**
- Click "Clear Filters" to reset

#### D. Export Attendance to CSV

1. Click **"Export CSV"** button
2. File downloads: `attendance_2026-03-11.csv`
3. Open in Excel/Sheets:
   ```csv
   Employee,Action,Timestamp,Latitude,Longitude
   "John Doe","clock_in","3/11/2026, 9:15:23 AM","14.599500","120.984200"
   ```

---

### 4. Test Construction Site Management

#### A. Add New Construction Site

1. In **Attendance Management** tab, scroll to "Construction Sites (Geo-Fencing)" section
2. Click **"+ Add Site"** button
3. Modal opens with form

**Fill in Details:**
```
Site Name: CICJ Main Construction Site
Site Address: Manila, Philippines
Center Latitude: 14.5995
Center Longitude: 120.9842
Geo-Fence Radius: 100 (meters)
```

4. Click **"Save Site"**
5. **Result:** `✅ Site created successfully!`
6. Table refreshes with new site

**Sample Coordinates for Testing:**

| Location | Latitude | Longitude | Use Case |
|----------|----------|-----------|----------|
| Manila (UMAK) | 14.5995 | 120.9842 | Main site |
| Quezon City | 14.6760 | 121.0437 | Secondary site |
| Makati | 14.5547 | 121.0244 | Office location |

#### B. Edit Construction Site

1. Click **"Edit"** button on any site row
2. Modal opens with pre-filled data
3. Modify fields (e.g., change radius to 150m)
4. Click **"Update Site"**
5. **Result:** `✅ Site updated successfully!`

#### C. Activate/Deactivate Site

1. Click **"Deactivate"** button on active site
2. Confirm action
3. **Result:** Site status changes to "Inactive"
4. Badge color changes from green to gray
5. Inactive sites won't be used for geo-fence validation

#### D. Test Site Validation

**Invalid Coordinates:**
- Latitude > 90 or < -90
- Longitude > 180 or < -180
- **Result:** `❌ Error: Invalid GPS coordinates`

**Invalid Radius:**
- Radius < 10m or > 10,000m
- **Result:** `❌ Error: Geo-fence radius must be between 10 and 10,000 meters`

---

## 🧮 Haversine Formula Testing

### How It Works
The backend calculates the great-circle distance between user GPS and site center using:

```javascript
a = sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1−a))
distance = 6,371,000 × c  // Earth radius in meters
```

### Accuracy Test

Create a site and test with these coordinates relative to **Manila (14.5995, 120.9842)**:

| Test Point | Latitude | Longitude | Expected Distance | Should Pass (100m radius)? |
|------------|----------|-----------|-------------------|---------------------------|
| Same location | 14.5995 | 120.9842 | 0m | ✅ Yes |
| 11m north-east | 14.5996 | 120.9843 | ~15m | ✅ Yes |
| 100m away | 14.5996 | 120.9851 | ~100m | ⚠️ Borderline |
| 1.2km away | 14.6100 | 120.9900 | ~1,324m | ❌ No |

---

## 🐛 Common Issues & Solutions

### Issue 1: "GPS coordinates required"
**Cause:** Frontend not capturing GPS
**Fix:** Check browser console for errors, ensure HTTPS or localhost

### Issue 2: "Outside construction site perimeter" (but actually inside)
**Cause:** GPS accuracy issue or wrong site coordinates
**Fix:** 
- Check GPS accuracy (should be < 20m)
- Verify site center coordinates are correct
- Increase geo-fence radius temporarily for testing

### Issue 3: "Cannot find path 'backend'" error
**Cause:** Running commands from wrong directory
**Fix:** `cd backend` before running npm commands

### Issue 4: Modal doesn't close
**Cause:** JavaScript error
**Fix:** Check browser console, ensure admin-attendance.js is loaded

### Issue 5: Attendance logs not loading
**Cause:** Permission issue or API error
**Fix:**
- Check browser network tab for failed requests
- Verify admin has `can_view_all_attendance` permission
- Check server logs for database errors

---

## 📊 Expected API Responses

### POST /api/attendance (Success)
```json
{
  "message": "Clock-in recorded successfully.",
  "log": {
    "log_id": 1,
    "user_id": 5,
    "action": "clock_in",
    "timestamp": "2026-03-11T01:15:23.456Z",
    "location_lat": "14.599500",
    "location_lng": "120.984200"
  },
  "geoFenceCheck": {
    "nearestSite": "CICJ Main Construction Site",
    "distance": 23,
    "radiusMeters": 100,
    "withinFence": true
  }
}
```

### GET /api/sites
```json
[
  {
    "site_id": 1,
    "site_name": "CICJ Main Construction Site",
    "site_address": "Manila, Philippines",
    "center_lat": "14.599500",
    "center_lng": "120.984200",
    "geo_fence_radius_meters": 100,
    "is_active": true,
    "created_at": "2026-03-11T00:00:00.000Z",
    "updated_at": "2026-03-11T00:00:00.000Z"
  }
]
```

### GET /api/attendance/me
```json
{
  "attendance": [
    {
      "log_id": 1,
      "user_id": 5,
      "action": "clock_in",
      "timestamp": "2026-03-11T01:15:23.000Z",
      "location_lat": "14.599500",
      "location_lng": "120.984200"
    }
  ]
}
```

---

## ✅ Checklist Before Testing

- [ ] MySQL database running
- [ ] Backend server started (`npm run dev`)
- [ ] Admin user has all attendance permissions
- [ ] At least one construction site created
- [ ] GPS/location services enabled in browser
- [ ] Using HTTPS or localhost (required for geolocation API)

---

## 🎯 Success Criteria

- [x] Employee can clock in/out with GPS coordinates
- [x] Geo-fencing rejects attendance outside perimeter
- [x] Admin can view all attendance logs with GPS
- [x] Admin can create/edit construction sites
- [x] Attendance exports to CSV with coordinates
- [x] Haversine formula calculates distances accurately
- [x] Error messages are clear and helpful
- [x] UI updates in real-time after actions

---

**Ready to test!** Start with creating a construction site, then test employee clock-in from different locations.
