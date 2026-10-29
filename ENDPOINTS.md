# API Endpoints

Every endpoint of the Sanad Youth API: who can call it, what to send, what it does, and what it returns.

- **Base URL:** `http://localhost:3000/api`
- **Auth:** every endpoint except register and login needs the header `Authorization: Bearer <accessToken>`. The token comes from `POST /auth/login`.
- **Roles:** `YOUTH` (student), `SUPERVISOR`, `ADMIN`.
- **Owner** means "the supervisor who runs this program". An admin can do everything an owner can.
- **Lists** accept `?page=1&limit=10` (`limit` max 50) and return:
  ```json
  { "data": [...], "meta": { "total": 16, "page": 1, "limit": 10, "totalPages": 2, "hasNextPage": true, "hasPreviousPage": false } }
  ```
- **Errors** always look like `{ "statusCode": 409, "message": "No seats left in this program" }`.

### Status codes used

| Code | Meaning in this API |
|---|---|
| 200 / 201 | OK / created |
| 400 | Invalid input (validation, unknown field, wrong file type, bad dates) |
| 401 | No token, bad or expired token, or wrong email/password |
| 403 | Logged in, but your role or ownership doesn't allow this |
| 404 | Not found, or not visible to you (e.g. another student's application) |
| 409 | Conflict: no seats left, already applied, already exists, invalid status change |
| 413 | Uploaded file is too large |
| 429 | Too many requests (rate limit) |

---

## 1. Auth

### `POST /auth/register`: create a student account
- **Who:** public. Rate limit: 10 per minute per IP.
- **Body (JSON):**
  ```json
  { "email": "ahmad@test.com", "password": "Demo@12345", "firstName": "Ahmad", "lastName": "Ali", "phone": "+963933000000" }
  ```
  `phone` is optional. `password` must be 8 to 72 characters.
- **What it does:** hashes the password with bcrypt and creates a user whose role is always `YOUTH`. Sending `role` (or any unknown field) is rejected with 400.
- **Returns:** `201` with `{ message, user }`. The password is never included.
- **Errors:** `400` invalid data · `409` email already exists.

### `POST /auth/login`: log in
- **Who:** public. Rate limit: **5 per minute per email + IP** (anti brute force).
- **Body:** `{ "email": "youth1@sanad.org", "password": "Youth@1234" }`
- **What it does:** checks the password against the bcrypt hash and signs a JWT containing `{ sub: userId, email, role }`.
- **Returns:** `200` with `{ accessToken, user }`.
- **Errors:** `401` "Invalid email or password". It's the same message for an unknown email and a wrong password, so nobody can discover which emails exist. `429` after too many attempts.

### `GET /auth/me`: my profile
- **Who:** any logged-in user.
- **Returns:** `200` with the current user (no password).

---

## 2. Users

### `PATCH /users/me`: update my profile
- **Who:** any logged-in user.
- **Body:** any of `{ "firstName", "lastName", "phone" }`. Email, password and role cannot be changed here.
- **Returns:** `200` with the updated user.

### `POST /users/supervisors`: create a supervisor
- **Who:** `ADMIN`.
- **Body:** same as register: `{ email, password, firstName, lastName, phone? }`.
- **What it does:** creates a user with role `SUPERVISOR`.
- **Returns:** `201` with the new supervisor. **Errors:** `409` email exists.

### `GET /users`: list users
- **Who:** `ADMIN`.
- **Query:** `page`, `limit`, `role` (`ADMIN` | `SUPERVISOR` | `YOUTH`), `search` (matches email, first or last name).
- **Returns:** `200` paginated list, newest first.

---

## 3. Programs

### `GET /programs`: browse and search programs
- **Who:** any logged-in user.
- **Query:** `page`, `limit`, `search` (title or description, case-insensitive), `status` (`ACTIVE` | `CLOSED`, staff only).
- **What it does:** students only see `ACTIVE` programs; staff can see and filter all.
- **Returns:** `200` paginated list. Each program includes the supervisor's name, `capacity`, `availableSeats` and `imageUrl`.

### `GET /programs/mine`: my programs
- **Who:** `SUPERVISOR`.
- **Returns:** `200` paginated list of the programs you run, each with its number of applications.

### `GET /programs/:id`: program details
- **Who:** any logged-in user.
- **Returns:** `200` with description, image URL, supervisor name, **remaining seats**, and **sessions** (date, time, place or link) sorted by date.
- **Caching:** the details are cached for 5 minutes and cleared whenever the program, its sessions or its image change. `availableSeats` is never cached; it's always read fresh.
- **Errors:** `404` not found.

### `POST /programs`: create a program
- **Who:** `SUPERVISOR` or `ADMIN`.
- **Body:**
  ```json
  { "title": "Backend with NestJS", "description": "At least 10 characters...", "capacity": 20, "status": "ACTIVE", "supervisorId": 2 }
  ```
  `status` is optional (default `ACTIVE`). `supervisorId` is **required for an admin** (and must be a supervisor's ID); a supervisor creates programs for themselves.
- **What it does:** creates the program with `availableSeats = capacity`.
- **Returns:** `201`. **Errors:** `400` missing or invalid `supervisorId` · `403` a supervisor creating a program for someone else.

### `PATCH /programs/:id`: update a program
- **Who:** owner or `ADMIN`.
- **Body:** any of `{ title, description, capacity, status }`.
- **What it does:** changing `capacity` is atomic: free seats are recalculated, and the new capacity can't be lower than the seats already taken. Clears the cache.
- **Returns:** `200` with the updated program. **Errors:** `403` not your program · `409` capacity below taken seats.

### `DELETE /programs/:id`: delete a program
- **Who:** owner or `ADMIN`.
- **What it does:** deletes the program and its sessions, materials and announcements. **Blocked** while the program has `PENDING` or `ACCEPTED` applications; set `status: CLOSED` instead.
- **Returns:** `200` `{ message }`. **Errors:** `403` · `404` · `409` program has active applications.

### `POST /programs/:id/image`: upload the program image
- **Who:** owner or `ADMIN`.
- **Body:** `multipart/form-data` with field **`image`**: `.jpg` `.jpeg` `.png` `.webp`, max **2 MB**.
- **What it does:** saves the file on disk under a random name, stores only the path in the database, and deletes the old image.
- **Returns:** `201` with the program, including a public `imageUrl` such as `/uploads/images/<uuid>.png`.
- **Errors:** `400` wrong type or no file · `413` too large · `403` not your program.

---

## 4. Sessions (inside a program)

### `POST /programs/:id/sessions`: add a session
- **Who:** owner or `ADMIN`.
- **Body:**
  ```json
  { "title": "Intro", "startsAt": "2026-12-01T10:00:00Z", "endsAt": "2026-12-01T12:00:00Z", "location": "Hall B", "meetingUrl": "https://meet.google.com/xyz" }
  ```
  You need a `location` **or** a `meetingUrl` (or both). `endsAt` must be after `startsAt`.
- **Returns:** `201`. **Errors:** `400` bad dates or no place/link · `403`.

### `PATCH /programs/:id/sessions/:sessionId`: update a session
- **Who:** owner or `ADMIN`. **Body:** any session field. The same rules are re-checked.
- **Returns:** `200`. **Errors:** `400` · `403` · `404` session isn't in this program.

### `DELETE /programs/:id/sessions/:sessionId`: delete a session
- **Who:** owner or `ADMIN`. **Returns:** `200` `{ message }`.

---

## 5. Materials (course files)

### `POST /programs/:id/materials`: upload a material
- **Who:** owner or `ADMIN`.
- **Body:** `multipart/form-data` with **`title`** (text) and **`file`**: `.pdf` `.pptx` `.docx` `.zip` `.jpg` `.png`, max **20 MB**.
- **What it does:** saves the file on disk; the database keeps the title, original name, type and size.
- **Returns:** `201`. **Errors:** `400` wrong type or no file · `413` too large · `403`.

### `GET /programs/:id/materials`: list materials
- **Who:** owner, `ADMIN`, or a student whose application to this program is **ACCEPTED**.
- **Returns:** `200` with the list (the server file path is never shown).
- **Errors:** `403` for students who are not accepted (PENDING, REJECTED, CANCELLED, or never applied).

### `GET /programs/:id/materials/:materialId/download`: download a material
- **Who:** same as above.
- **Returns:** the file itself, downloaded under its original name.
- **Errors:** `403` · `404`.

### `DELETE /programs/:id/materials/:materialId`: delete a material
- **Who:** owner or `ADMIN`.
- **What it does:** deletes the database row and the file on disk.
- **Returns:** `200` `{ message }`.

---

## 6. Applications

**Status flow**

```
PENDING ──accept (admin)──> ACCEPTED ──cancel (student)──> CANCELLED   (seat returned)
   ├──reject (admin)──> REJECTED                                       (seat returned)
   └──cancel (student)──> CANCELLED                                    (seat returned)
```

`PENDING` and `ACCEPTED` hold a seat. `REJECTED` and `CANCELLED` give it back.

### `POST /programs/:id/applications`: apply to a program
- **Who:** `YOUTH`.
- **Body:** `multipart/form-data`, all optional: **`cv`** (PDF, max **5 MB**) and **`motivation`** (text, max 1000 characters). An empty form is valid.
- **What it does:** inside one **transaction**:
  1. Reserves a seat with a single atomic SQL statement: `UPDATE "Program" SET "availableSeats" = "availableSeats" - 1 WHERE id = ? AND status = 'ACTIVE' AND "availableSeats" > 0`.
  2. Creates the application with status `PENDING`.

  If 100 students click at the same moment for the last seat, exactly **one** gets `201` and the rest get `409`. If anything fails, the seat is rolled back and the uploaded CV is deleted.
- **Returns:** `201` with the application (`status: "PENDING"`).
- **Errors:** `409` "No seats left in this program" · `409` "You already applied to this program" (also enforced by a database unique constraint) · `400` program is closed, or invalid CV type · `413` CV too large · `404` program not found.

### `GET /applications/me`: my applications
- **Who:** `YOUTH`.
- **Query:** `page`, `limit`, `status`, `programId`.
- **Returns:** `200` paginated list of **only your** applications, with program and supervisor info.

### `GET /applications/:id`: one application
- **Who:** the student who owns it, the program's supervisor, or `ADMIN`.
- **Returns:** `200` with the application, the student, the program and `hasCv: true/false`.
- **Errors:** `404` for anyone else. It's 404 rather than 403, so other users can't even tell the application exists.

### `GET /applications/:id/cv`: download the CV
- **Who:** same as above.
- **Returns:** the PDF file. **Errors:** `404` no CV, or not visible to you.

### `GET /applications`: all applications
- **Who:** `ADMIN`.
- **Query:** `page`, `limit`, `status` (`PENDING` | `ACCEPTED` | `REJECTED` | `CANCELLED`), `programId`.
- **Returns:** `200` paginated list.

### `GET /programs/:id/applications`: applicants of a program
- **Who:** owner or `ADMIN`.
- **Query:** `page`, `limit`, `status`.
- **Returns:** `200` paginated list. **Errors:** `403` another supervisor's program.

### `PATCH /applications/:id/accept`: accept
- **Who:** `ADMIN` only.
- **What it does:** `PENDING` → `ACCEPTED` and records who reviewed it and when. The student can now see the materials and the program's announcements.
- **Returns:** `200`. **Errors:** `409` the application isn't `PENDING` · `403` not admin.

### `PATCH /applications/:id/reject`: reject
- **Who:** `ADMIN` only.
- **What it does:** `PENDING` → `REJECTED` and **returns the seat** (same transaction).
- **Returns:** `200`. **Errors:** `409` not `PENDING` (so rejecting twice can't free two seats).

### `PATCH /applications/:id/cancel`: cancel my application
- **Who:** `YOUTH`, and only the owner.
- **What it does:** `PENDING` or `ACCEPTED` → `CANCELLED` and **returns the seat**.
- **Returns:** `200`. **Errors:** `403` not your application · `409` already cancelled or rejected.

---

## 7. Announcements

### `POST /announcements`: general announcement
- **Who:** `ADMIN`.
- **Body:** `{ "title": "Holiday notice", "content": "The center is closed on Friday." }`
- **What it does:** creates a `GENERAL` announcement for all students and clears the announcements cache.
- **Returns:** `201`.

### `POST /programs/:id/announcements`: program announcement
- **Who:** owner or `ADMIN`.
- **Body:** `{ title, content }`.
- **What it does:** creates a `PROGRAM` announcement visible only to that program's accepted students and its staff.
- **Returns:** `201`. **Errors:** `403` another supervisor's program.

### `GET /announcements`: my announcement feed
- **Who:** any logged-in user.
- **Query:** `page`, `limit`.
- **What it does:**
  - **Student:** general announcements + announcements of programs they're **accepted** in.
  - **Supervisor:** general + their own programs.
  - **Admin:** everything.
- **Returns:** `200` paginated, newest first.
- **Caching:** the feed is cached for 2 minutes. Any create, edit or delete of an announcement, and any accept or cancel, clears it immediately, so nobody sees an old version.

### `GET /programs/:id/announcements`: announcements of one program
- **Who:** owner, `ADMIN`, or an accepted student.
- **Returns:** `200` paginated (cached the same way). **Errors:** `403` not a member.

### `PATCH /announcements/:id`: edit an announcement
- **Who:** the author, or `ADMIN`.
- **Body:** any of `{ title, content }`.
- **Returns:** `200`. The next read shows the new version. **Errors:** `403` not the author.

### `DELETE /announcements/:id`: delete an announcement
- **Who:** the author, or `ADMIN`.
- **Returns:** `200` `{ message }`.

---

## 8. Public files

### `GET /uploads/images/<file>`: program images
- **Who:** public (no token, and no `/api` prefix). For example: `http://localhost:3000/uploads/images/<uuid>.png`.
- Only images are public. CVs and materials are **never** served publicly; they're only available through the protected download endpoints above.

---

## Summary table

| # | Method | Path | Who |
|---|---|---|---|
| 1 | POST | /auth/register | public |
| 2 | POST | /auth/login | public |
| 3 | GET | /auth/me | any |
| 4 | PATCH | /users/me | any |
| 5 | POST | /users/supervisors | ADMIN |
| 6 | GET | /users | ADMIN |
| 7 | GET | /programs | any |
| 8 | GET | /programs/mine | SUPERVISOR |
| 9 | GET | /programs/:id | any |
| 10 | POST | /programs | SUPERVISOR, ADMIN |
| 11 | PATCH | /programs/:id | owner, ADMIN |
| 12 | DELETE | /programs/:id | owner, ADMIN |
| 13 | POST | /programs/:id/image | owner, ADMIN |
| 14 | POST | /programs/:id/sessions | owner, ADMIN |
| 15 | PATCH | /programs/:id/sessions/:sessionId | owner, ADMIN |
| 16 | DELETE | /programs/:id/sessions/:sessionId | owner, ADMIN |
| 17 | POST | /programs/:id/materials | owner, ADMIN |
| 18 | GET | /programs/:id/materials | owner, ADMIN, accepted YOUTH |
| 19 | GET | /programs/:id/materials/:materialId/download | owner, ADMIN, accepted YOUTH |
| 20 | DELETE | /programs/:id/materials/:materialId | owner, ADMIN |
| 21 | POST | /programs/:id/applications | YOUTH |
| 22 | GET | /programs/:id/applications | owner, ADMIN |
| 23 | GET | /applications/me | YOUTH |
| 24 | GET | /applications | ADMIN |
| 25 | GET | /applications/:id | owner YOUTH, program supervisor, ADMIN |
| 26 | GET | /applications/:id/cv | owner YOUTH, program supervisor, ADMIN |
| 27 | PATCH | /applications/:id/cancel | owner YOUTH |
| 28 | PATCH | /applications/:id/accept | ADMIN |
| 29 | PATCH | /applications/:id/reject | ADMIN |
| 30 | POST | /announcements | ADMIN |
| 31 | POST | /programs/:id/announcements | owner, ADMIN |
| 32 | GET | /announcements | any |
| 33 | GET | /programs/:id/announcements | owner, ADMIN, accepted YOUTH |
| 34 | PATCH | /announcements/:id | author, ADMIN |
| 35 | DELETE | /announcements/:id | author, ADMIN |

All 35 endpoints are called and checked by `postman/sanad-youth.postman_collection.json` (79 requests, 106 assertions). Run it with `npm run test:api`.
