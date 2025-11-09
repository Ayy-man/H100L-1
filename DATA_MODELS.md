# SniperZone H100L: Data Models & Database Schema

This document outlines the complete data architecture for the SniperZone Hockey Training registration system. It includes data models, relational database schema, and key business logic for managing registrations, capacity, and bookings.

---

## 1. Primary Data Model: `Registration`

This model represents a single player's complete registration record.

| Field                   | Type                                           | Description                                                                    | Constraints / Notes                                     |
|-------------------------|------------------------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------|
| **Player Info**         |                                                |                                                                                |                                                         |
| `id`                    | UUID                                           | Unique identifier for the registration.                                        | Primary Key                                             |
| `playerFullName`        | String                                         | Player's full legal name.                                                      | NOT NULL                                                |
| `dateOfBirth`           | Date                                           | Player's date of birth.                                                        | NOT NULL                                                |
| `age`                   | Integer                                        | Player's age, auto-calculated from `dateOfBirth`.                              | Calculated field                                        |
| `category`              | Enum                                           | Age category (`M9`, `M11`, `M13`, `M15`, `M18`, `Junior`).                       | NOT NULL, auto-assigned based on `age`.                 |
| **Parent/Guardian Info**|                                                |                                                                                |                                                         |
| `parentEmail`           | String                                         | Primary contact email for billing and communication.                           | NOT NULL, UNIQUE, must be a valid email format.         |
| `parentPhone`           | String                                         | Primary contact phone number.                                                  | NOT NULL                                                |
| `emergencyContactName`  | String                                         | Name of the emergency contact.                                                 | NOT NULL                                                |
| `emergencyContactPhone` | String                                         | Phone number for the emergency contact.                                        | NOT NULL, must be different from `parentPhone`.         |
| `emergencyRelationship` | String                                         | Relationship of the emergency contact to the player (e.g., Grandparent).       | NOT NULL                                                |
| `address`               | JSON/Object                                    | Full street address: `{ street, city, province, postalCode }`.                 | NOT NULL                                                |
| `language`              | Enum (`FR`, `EN`)                              | Preferred language for communication.                                          | NOT NULL, default `FR`.                                 |
| **Program Selection**   |                                                |                                                                                |                                                         |
| `programType`           | Enum (`group`, `private`, `semi-private`)      | The type of training program selected.                                         | NOT NULL                                                |
| **Health & Hockey Info**|                                                |                                                                                |                                                         |
| `position`              | String                                         | Player's primary position (e.g., Forward, Defence, Goalie).                    |                                                         |
| `dominantHand`          | String                                         | e.g., "Left" or "Right".                                                       |                                                         |
| `currentLevel`          | String                                         | Player's current competitive level (e.g., AA, AAA, School).                    | NOT NULL                                                |
| `primaryObjective`      | Text                                           | Player's main goal for the training.                                           |                                                         |
| `allergies`             | JSON/Object                                    | `{ hasAllergies: boolean, details: string }`.                                  | NOT NULL                                                |
| `medicalConditions`     | JSON/Object                                    | `{ hasConditions: boolean, details: string }`.                                 | NOT NULL                                                |
| `medication`            | JSON/Object                                    | `{ takesMedication: boolean, details: string }`.                               | NOT NULL                                                |
| **Logistics**           |                                                |                                                                                |                                                         |
| `sundayPractice`        | Enum (`yes`, `no`, `tbc`)                      | Indicates if the player will attend the Sunday real ice sessions.              | NOT NULL                                                |
| `jerseySize`            | String                                         | e.g., "Youth L", "Adult M".                                                    | NOT NULL                                                |
| `photoVideoConsent`     | Boolean                                        | Consent for using player's photo/video for promotional purposes.               | NOT NULL, must be `true` to proceed.                    |
| `policyAcceptance`      | Boolean                                        | Agreement to the terms, conditions, and waiver.                                | NOT NULL, must be `true` to proceed.                    |
| **System IDs & Timestamps**|                                                |                                                                                |                                                         |
| `stripeCustomerId`      | String                                         | ID from Stripe for the customer object.                                        | Indexed                                                 |
| `subscriptionId`        | String                                         | ID from Stripe for the active subscription.                                    | Indexed                                                 |
| `paymentMethod`         | String                                         | Last 4 digits and brand of the payment method (e.g., "Visa **** 4242").        |                                                         |
| `crmContactId`          | String                                         | ID from the CRM (GoHighLevel).                                                 | Indexed                                                 |
| `crmStatus`             | String                                         | Current status in the CRM pipeline (e.g., "New Lead", "Active Subscriber").    |                                                         |
| `createdAt`             | Timestamp                                      | Record creation timestamp.                                                     | NOT NULL, `DEFAULT NOW()`                               |
| `updatedAt`             | Timestamp                                      | Record last update timestamp.                                                  | NOT NULL, `DEFAULT NOW()`                               |

---

## 2. Relational Database Schema (PostgreSQL)

To avoid nullable fields and enforce data integrity, we use a normalized structure with separate tables for program-specific details.

### `registrations` Table
```sql
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    parent_email VARCHAR(255) NOT NULL UNIQUE,
    parent_phone VARCHAR(50) NOT NULL,
    emergency_contact_name VARCHAR(255) NOT NULL,
    emergency_contact_phone VARCHAR(50) NOT NULL,
    emergency_relationship VARCHAR(100) NOT NULL,
    address JSONB NOT NULL,
    language VARCHAR(2) NOT NULL DEFAULT 'FR',
    program_type VARCHAR(50) NOT NULL,
    "position" VARCHAR(100),
    dominant_hand VARCHAR(50),
    current_level VARCHAR(100) NOT NULL,
    primary_objective TEXT,
    allergies JSONB NOT NULL,
    medical_conditions JSONB NOT NULL,
    medication JSONB NOT NULL,
    sunday_practice VARCHAR(20) NOT NULL,
    jersey_size VARCHAR(50) NOT NULL,
    photo_video_consent BOOLEAN NOT NULL,
    policy_acceptance BOOLEAN NOT NULL,
    stripe_customer_id VARCHAR(255),
    subscription_id VARCHAR(255),
    payment_method VARCHAR(100),
    crm_contact_id VARCHAR(255),
    crm_status VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_emergency_phone CHECK (parent_phone <> emergency_contact_phone)
);
```

### Program-Specific Detail Tables

#### `group_registrations` Table
```sql
CREATE TABLE group_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    frequency VARCHAR(10) NOT NULL, -- '1x' or '2x'
    time_slot_id UUID NOT NULL REFERENCES time_slots(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `private_registrations` Table
```sql
CREATE TABLE private_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL, -- '1x', '2x', 'one-time'
    selected_days TEXT[] NOT NULL, -- Array of strings e.g., ['Monday', 'Wednesday']
    time_slot VARCHAR(100) NOT NULL, -- e.g., '5:00 PM'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `semi_private_registrations` Table
```sql
CREATE TABLE semi_private_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    availability TEXT[] NOT NULL, -- e.g., ['Weekdays', 'Weekends']
    time_windows TEXT[] NOT NULL, -- e.g., ['Mornings', 'Afternoons']
    matching_preference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Capacity Tracking Model & Booking Logic

### `time_slots` Table
This table is the single source of truth for group session availability.

```sql
CREATE TABLE time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week VARCHAR(20) NOT NULL, -- e.g., 'Monday', 'Tuesday'
    start_time TIME NOT NULL, -- e.g., '16:00:00'
    category VARCHAR(50) NOT NULL, -- 'M9', 'M11', etc.
    capacity INT NOT NULL DEFAULT 10,
    current_registrations INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);
```

### Booking Availability Logic (for Group Sessions)
1.  **Calculate Category:** Determine the player's `category` based on their `dateOfBirth` (see validation rules below).
2.  **Query Available Slots:**
    ```sql
    SELECT id, day_of_week, start_time
    FROM time_slots
    WHERE category = $1
      AND current_registrations < capacity
      AND is_active = true;
    ```
    (Where `$1` is the player's calculated category).
3.  **Process Registration:**
    -   If the query returns available slots, the registration can proceed.
    -   On successful payment and registration confirmation, run an atomic transaction:
        -   Create the record in the `registrations` table.
        -   Create the corresponding record in the `group_registrations` table, linking to the `time_slot_id`.
        -   Increment the `current_registrations` count for that `time_slot_id`:
            ```sql
            UPDATE time_slots
            SET current_registrations = current_registrations + 1
            WHERE id = $1;
            ```
4.  **Handle Full Slots:** If the initial query returns no slots, display a "Session Full" message to the user and suggest they contact administration or join a waitlist.

---

## 4. Business Logic & Validation Rules

### Age-to-Category Validation
This logic determines a player's category for the current hockey season (e.g., 2024-2025). The cut-off is typically based on the player's age as of **December 31st of the registration year**.

-   **Logic:** `age = (RegistrationYear - Year(dateOfBirth))`
-   **Example Year:** 2024

| Age on Dec 31, 2024 | Category | Born In         |
|---------------------|----------|-----------------|
| 7, 8                | `M9`     | 2016, 2017      |
| 9, 10               | `M11`    | 2014, 2015      |
| 11, 12              | `M13`    | 2012, 2013      |
| 13, 14              | `M15`    | 2010, 2011      |
| 15, 16, 17          | `M18`    | 2007, 2008, 2009|
| 18, 19, 20          | `Junior` | 2004, 2005, 2006|

This calculation must be performed server-side during form submission to prevent client-side manipulation and accurately assign the category.

### Time Slot Assignment Logic (for Group Sessions)
Time slots are automatically determined by the player's `category`. This simplifies the user experience by removing the need for them to select a time.

-   The system maintains a schedule in the `time_slots` table.
-   **Example Schedule:**
    -   M9 -> Monday, 4:00 PM
    -   M11 -> Monday, 5:00 PM
    -   M13 -> Tuesday, 4:00 PM
    -   M15 -> Tuesday, 5:00 PM
    -   M18 -> Wednesday, 4:00 PM
-   When a player registers, the system uses their calculated category to find the corresponding `time_slot_id` and assigns it in the `group_registrations` table.
-   If the `frequency` is `2x`, a second, pre-determined time slot for that category (e.g., M9 -> Thursday, 4:00 PM) would also be assigned.
