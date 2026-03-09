# UsersAPI - Technical Context (Clinix)

## Objective
This file stores high-value technical context for future chats focused on `Backend/UsersAPI`.

## Current service snapshot
- Stack: ASP.NET Core 8 + EF Core (Npgsql) + JWT + BCrypt.
- Startup file: `Backend/UsersAPI/Program.cs`.
- DB schema: `users` (configured in `UsersDbContext`).
- Auto migration on startup: `db.Database.Migrate()`.

## Current API surface
### Auth (`/auth`)
- `POST /auth/patients/register`
  - Input DTO: `RegisterRequestDTO { Email, Password, Name }`
  - Creates `UserType.User`.
- `POST /auth/doctors/register`
  - Input DTO: `RegisterDoctorRequestDTO { Name, ProfessionalRegister, Specialties[], Email, Phone, Password }`
  - Creates `UserType.Doctor` + `DoctorProfile`.
- `POST /auth/login`
  - Input DTO: `LoginRequestDTO { Email, Password }`
  - Returns JWT with `UserType` in the response and role claim in the token.
- Legacy compatibility:
  - `POST /auth/register` -> patient register flow.
- `GET /auth/me` (JWT)
  - Output: `{ userId, email }`.

### Clinical records (`/clinical-records`)
- `GET /clinical-records` (JWT)
  - Returns records where logged user is patient or professional.
- `POST /clinical-records` (JWT)
  - Accepts `ClinicalRecord` directly from body.
  - Sets only `Id` and `CreatedAt` server-side.

## Domain model currently implemented
### User
- Fields: `Id`, `Email`, `PasswordHash`, `Name`, `UserType`, `CreatedAt`.
- `UserType` enum: `Admin`, `User`, `Doctor`.

### DoctorProfile
- Fields: `UserId`, `ProfessionalRegister`, `NormalizedProfessionalRegister`, `Specialties`, `Phone`, `CreatedAt`.
- Constraints:
  - PK = `UserId` (1:1 with `Users`).
  - unique index on `NormalizedProfessionalRegister`.

### ClinicalRecord
- Fields: `Id`, `PatientId`, `ProfessionalId`, `Description`, `CreatedAt`.

## Gap analysis vs product use cases (priority on UsersAPI)
1. UC1 (patient registration): partial.
- Missing patient profile fields from business spec: CPF, phone, birth date, health plan.

2. UC2 (doctor registration): implemented at auth/domain entry level.
- Segmented doctor registration and doctor profile storage are in place.
- Still pending: stronger field-level business rules (CRM format by council/state, phone normalization pattern).

3. UC7/UC8/UC9 (clinical records): partial foundation.
- Missing typed records (prescription/order/exam/report).
- Missing file upload support for reports.
- Missing role-aware authorization policies.
- Missing record ownership/consistency validation on create.

4. UC10 (document extraction with AI): not implemented.

## Security and robustness notes
- Keep `appsettings.json` with safe defaults/placeholders only.
- For local development, prefer `appsettings.Development.json` or environment variables for secrets/connection strings.
- `POST /clinical-records` should use dedicated DTO and server-side validation.
- Missing explicit FluentValidation/DataAnnotations for DTO contracts.
- No pagination/filtering in `GET /clinical-records`.

## Recommended development order (next chats)
1. Identity/profile expansion (UC1 + UC2).
- Split DTOs or include role-specific registration payload.
- Add patient and doctor profile entities/tables.
- Add uniqueness/format validation (email, CPF, CRM).

2. Authorization hardening.
- Add role policies (`Patient`, `Doctor`, `Admin`).
- Restrict record creation/listing by relationship rules.

3. Clinical records v2 (UC7-UC9).
- Introduce typed entries and metadata.
- Add exam/report document storage integration (S3 service already hinted by `IS3StorageService`).

4. API quality.
- Add request validation, error contract, pagination, integration tests.

## Quick run/check commands
```powershell
cd Backend/UsersAPI
dotnet restore
dotnet build
dotnet run
```

## Files to open first in future chats
- `Backend/UsersAPI/Program.cs`
- `Backend/UsersAPI/Controllers/AuthController.cs`
- `Backend/UsersAPI/Controllers/ClinicalRecordController.cs`
- `Backend/UsersAPI/Services/UserService.cs`
- `Backend/UsersAPI/Data/UsersDbContext.cs`
- `Backend/UsersAPI/Models/*`
