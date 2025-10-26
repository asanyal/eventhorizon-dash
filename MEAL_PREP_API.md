# Meal Prep API Documentation

This document describes the backend API endpoints needed for the Meal Prep feature in the Health section.

## Base URL
All endpoints are prefixed with your API base URL (e.g., `http://localhost:8000`)

---

## Ingredients API

### 1. Get All Ingredients
**Endpoint:** `GET /get-ingredients`

**Description:** Retrieve all ingredients from the database.

**Request:**
```
GET /get-ingredients
```

**Response:**
```json
[
  {
    "id": "uuid-or-id",
    "name": "Chicken Breast",
    "quantity": "2",
    "unit": "lbs",
    "created_at": "2025-01-15T10:30:00Z"
  },
  {
    "id": "uuid-or-id",
    "name": "Rice",
    "quantity": "1",
    "unit": "cup",
    "created_at": "2025-01-15T10:35:00Z"
  }
]
```

**Response Schema:**
```typescript
interface Ingredient {
  id?: string;
  name: string;
  quantity?: string;
  unit?: string;
  created_at?: string;
}
```

---

### 2. Create Ingredient
**Endpoint:** `POST /add-ingredient`

**Description:** Add a new ingredient to the database.

**Request:**
```json
{
  "name": "Broccoli",
  "quantity": "1",
  "unit": "bunch"
}
```

**Request Schema:**
```typescript
interface CreateIngredientRequest {
  name: string;          // Required
  quantity?: string;     // Optional
  unit?: string;         // Optional
}
```

**Response:**
```json
{
  "id": "new-uuid-or-id",
  "name": "Broccoli",
  "quantity": "1",
  "unit": "bunch",
  "created_at": "2025-01-15T11:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Ingredient created successfully
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

---

### 3. Delete Ingredient
**Endpoint:** `DELETE /delete-ingredient/{id}`

**Description:** Delete an ingredient by its ID.

**Request:**
```
DELETE /delete-ingredient/uuid-or-id
```

**Response:**
```json
{
  "message": "Ingredient deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Ingredient deleted successfully
- `404 Not Found` - Ingredient not found
- `500 Internal Server Error` - Server error

---

## Meals API

### 4. Get All Meals
**Endpoint:** `GET /get-meals`

**Description:** Retrieve all meals from the database.

**Request:**
```
GET /get-meals
```

**Response:**
```json
[
  {
    "id": "uuid-or-id",
    "name": "Chicken Stir Fry",
    "ingredients": ["Chicken Breast", "Broccoli", "Rice"],
    "created_at": "2025-01-15T12:00:00Z"
  }
]
```

**Response Schema:**
```typescript
interface Meal {
  id?: string;
  name: string;
  ingredients: string[];  // Array of ingredient names or IDs
  created_at?: string;
}
```

---

### 5. Create Meal
**Endpoint:** `POST /add-meal`

**Description:** Create a new meal with associated ingredients.

**Request:**
```json
{
  "name": "Pasta Carbonara",
  "ingredients": ["Pasta", "Bacon", "Eggs", "Parmesan"]
}
```

**Request Schema:**
```typescript
interface CreateMealRequest {
  name: string;          // Required
  ingredients: string[]; // Required - array of ingredient names or IDs
}
```

**Response:**
```json
{
  "id": "new-uuid-or-id",
  "name": "Pasta Carbonara",
  "ingredients": ["Pasta", "Bacon", "Eggs", "Parmesan"],
  "created_at": "2025-01-15T12:30:00Z"
}
```

**Status Codes:**
- `200 OK` - Meal created successfully
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

---

### 6. Delete Meal
**Endpoint:** `DELETE /delete-meal/{id}`

**Description:** Delete a meal by its ID.

**Request:**
```
DELETE /delete-meal/uuid-or-id
```

**Response:**
```json
{
  "message": "Meal deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Meal deleted successfully
- `404 Not Found` - Meal not found
- `500 Internal Server Error` - Server error

---

## Weekly Meal Plan API

### 7. Get Weekly Meal Plan
**Endpoint:** `GET /get-weekly-meal-plan`

**Description:** Retrieve the meal plan for a specific week.

**Query Parameters:**
- `week_start_date` (required): Monday of the week in `YYYY-MM-DD` format

**Request:**
```
GET /get-weekly-meal-plan?week_start_date=2025-01-13
```

**Response (if plan exists):**
```json
{
  "id": "uuid-or-id",
  "week_start_date": "2025-01-13",
  "sunday_lunch": "meal-id-1",
  "tuesday_lunch": "meal-id-2",
  "monday_dinner": "meal-id-3",
  "wednesday_dinner": "meal-id-4",
  "created_at": "2025-01-13T08:00:00Z",
  "updated_at": "2025-01-14T10:00:00Z"
}
```

**Response (if no plan exists):**
```
Status: 404 Not Found
```

**Response Schema:**
```typescript
interface WeeklyMealPlan {
  id?: string;
  week_start_date: string;      // Monday in YYYY-MM-DD format
  sunday_lunch?: string;         // Meal ID or name
  tuesday_lunch?: string;        // Meal ID or name
  monday_dinner?: string;        // Meal ID or name
  wednesday_dinner?: string;     // Meal ID or name
  created_at?: string;
  updated_at?: string;
}
```

**Status Codes:**
- `200 OK` - Plan found and returned
- `404 Not Found` - No plan exists for this week
- `400 Bad Request` - Invalid week_start_date format
- `500 Internal Server Error` - Server error

---

### 8. Create or Update Weekly Meal Plan
**Endpoint:** `POST /upsert-weekly-meal-plan`

**Description:** Create a new weekly meal plan or update an existing one (upsert operation).

**Request:**
```json
{
  "week_start_date": "2025-01-13",
  "sunday_lunch": "meal-id-1",
  "tuesday_lunch": "meal-id-2",
  "monday_dinner": "meal-id-3",
  "wednesday_dinner": "meal-id-4"
}
```

**Request Schema:**
```typescript
interface CreateWeeklyMealPlanRequest {
  week_start_date: string;      // Required - Monday in YYYY-MM-DD
  sunday_lunch?: string;         // Optional - Meal ID or name
  tuesday_lunch?: string;        // Optional - Meal ID or name
  monday_dinner?: string;        // Optional - Meal ID or name
  wednesday_dinner?: string;     // Optional - Meal ID or name
}
```

**Response:**
```json
{
  "id": "uuid-or-id",
  "week_start_date": "2025-01-13",
  "sunday_lunch": "meal-id-1",
  "tuesday_lunch": "meal-id-2",
  "monday_dinner": "meal-id-3",
  "wednesday_dinner": "meal-id-4",
  "created_at": "2025-01-13T08:00:00Z",
  "updated_at": "2025-01-14T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Plan created or updated successfully
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

---

### 9. Update Meal Slot
**Endpoint:** `PATCH /update-meal-slot`

**Description:** Update a specific meal slot in the weekly plan. This is used for drag-and-drop functionality.

**Request:**
```json
{
  "week_start_date": "2025-01-13",
  "day_field": "sunday_lunch",
  "meal_id": "meal-id-or-null"
}
```

**Request Schema:**
```typescript
interface UpdateWeeklyMealPlanRequest {
  week_start_date: string;                                                           // Required
  day_field: 'sunday_lunch' | 'tuesday_lunch' | 'monday_dinner' | 'wednesday_dinner'; // Required
  meal_id?: string;                                                                  // Optional - null to remove
}
```

**Response:**
```json
{
  "id": "uuid-or-id",
  "week_start_date": "2025-01-13",
  "sunday_lunch": "new-meal-id",
  "tuesday_lunch": "meal-id-2",
  "monday_dinner": "meal-id-3",
  "wednesday_dinner": "meal-id-4",
  "created_at": "2025-01-13T08:00:00Z",
  "updated_at": "2025-01-15T14:00:00Z"
}
```

**Notes:**
- If `meal_id` is `null` or `undefined`, the slot will be cleared
- If no plan exists for the week, one will be created automatically
- This endpoint is optimized for drag-and-drop updates

**Status Codes:**
- `200 OK` - Slot updated successfully
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

---

### 10. Delete Weekly Meal Plan
**Endpoint:** `DELETE /delete-weekly-meal-plan`

**Description:** Delete a weekly meal plan.

**Query Parameters:**
- `week_start_date` (required): Monday of the week in `YYYY-MM-DD` format

**Request:**
```
DELETE /delete-weekly-meal-plan?week_start_date=2025-01-13
```

**Response:**
```json
{
  "message": "Weekly meal plan deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Plan deleted successfully
- `404 Not Found` - Plan not found
- `400 Bad Request` - Invalid week_start_date format
- `500 Internal Server Error` - Server error

---

## Database Schema Suggestions

### Ingredients Table
```sql
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  quantity VARCHAR(50),
  unit VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Meals Table
```sql
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Meal Ingredients Junction Table
```sql
CREATE TABLE meal_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Weekly Meal Plans Table
```sql
CREATE TABLE weekly_meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL UNIQUE,  -- Monday of the week
  sunday_lunch UUID REFERENCES meals(id) ON DELETE SET NULL,
  tuesday_lunch UUID REFERENCES meals(id) ON DELETE SET NULL,
  monday_dinner UUID REFERENCES meals(id) ON DELETE SET NULL,
  wednesday_dinner UUID REFERENCES meals(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Implementation Notes

1. **Week Start Date**: Always use Monday as the week start date in `YYYY-MM-DD` format
2. **Meal References**: The `ingredients` array in meals can store either ingredient IDs or names (your choice)
3. **Caching**: The frontend caches all data with a 10-minute TTL to reduce API calls
4. **Drag-and-Drop**: The `/update-meal-slot` endpoint is called when users drag meals to different days
5. **Upsert Logic**: The `/upsert-weekly-meal-plan` endpoint should create a new plan if none exists, or update the existing one
6. **Timezone**: All timestamps should be in UTC; the frontend will handle timezone conversion

---

## Testing the API

You can use curl or Postman to test the endpoints:

```bash
# Get all ingredients
curl http://localhost:8000/get-ingredients

# Add an ingredient
curl -X POST http://localhost:8000/add-ingredient \
  -H "Content-Type: application/json" \
  -d '{"name": "Tomato", "quantity": "5", "unit": "pieces"}'

# Get all meals
curl http://localhost:8000/get-meals

# Get weekly plan
curl "http://localhost:8000/get-weekly-meal-plan?week_start_date=2025-01-13"

# Update a meal slot
curl -X PATCH http://localhost:8000/update-meal-slot \
  -H "Content-Type: application/json" \
  -d '{"week_start_date": "2025-01-13", "day_field": "sunday_lunch", "meal_id": "meal-id-123"}'
```

---

## Error Handling

All endpoints should return consistent error responses:

```json
{
  "error": "Error message description",
  "status": 400
}
```

Common error scenarios:
- Missing required fields: `400 Bad Request`
- Resource not found: `404 Not Found`
- Database errors: `500 Internal Server Error`
- Invalid date format: `400 Bad Request`
