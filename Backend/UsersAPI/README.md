# UsersAPI - Technical Context (Clinix)

## Objective
This file stores high-value technical context for future chats focused on `Backend/UsersAPI`.

## Current service snapshot
- Stack: ASP.NET Core 8 + EF Core (Npgsql) + JWT + BCrypt + AWS S3.
- Startup file: `Backend/UsersAPI/Program.cs`.
- DB schema: `users` (configured in `UsersDbContext`).
- Auto migration on startup: `db.Database.Migrate()`.
- Integration tests project: `Backend/UsersAPI.Tests`.

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

### Clinical record v2 (`/patients/{patientId}/clinical-record`)
- `GET /patients/{patientId}/clinical-record` (JWT)
  - Returns summary counts and metadata for the patient's clinical record.
- `GET /patients/{patientId}/clinical-record/entries` (JWT)
  - Lists active entries ordered by newest first.
- `GET /patients/{patientId}/clinical-record/entries/{entryId}` (JWT)
  - Returns one active entry with its active documents.
- `POST /patients/{patientId}/clinical-record/entries` (JWT)
  - Input DTO: `CreateClinicalRecordEntryRequestDTO`.
  - Creates anamnesis or document entries.
- `PUT /patients/{patientId}/clinical-record/entries/{entryId}` (JWT)
  - Input DTO: `UpdateClinicalRecordEntryRequestDTO`.
  - Updates only the entry author (or admin).
- `DELETE /patients/{patientId}/clinical-record/entries/{entryId}` (JWT)
  - Soft-deletes the entry and its documents.
- `POST /patients/{patientId}/clinical-record/entries/{entryId}/documents` (JWT, multipart/form-data)
  - Uploads a file to S3 and stores metadata in the DB.
- `GET /patients/{patientId}/clinical-record/documents/{documentId}` (JWT)
  - Downloads the document stream from S3.
- `DELETE /patients/{patientId}/clinical-record/documents/{documentId}` (JWT)
  - Soft-deletes metadata and removes the object from S3.
- `GET /patients/{patientId}/clinical-record/access-grants` (JWT)
  - Lists access grants for the patient.
- `POST /patients/{patientId}/clinical-record/access-grants` (JWT)
  - Input DTO: `CreateClinicalRecordAccessGrantRequestDTO`.
  - Grants a doctor access to the patient's history.
- `PATCH /patients/{patientId}/clinical-record/access-grants/{grantId}/revoke` (JWT)
  - Revokes an access grant.

## Domain model currently implemented
### User
- Fields: `Id`, `Email`, `PasswordHash`, `Name`, `UserType`, `CreatedAt`.
- `UserType` enum: `Admin`, `User`, `Doctor`.

### DoctorProfile
- Fields: `UserId`, `ProfessionalRegister`, `NormalizedProfessionalRegister`, `Specialties`, `Phone`, `CreatedAt`.
- Constraints:
  - PK = `UserId` (1:1 with `Users`).
  - unique index on `NormalizedProfessionalRegister`.

### PatientClinicalRecord
- One clinical record per patient.
- Fields: `Id`, `PatientId`, `CreatedAt`, `UpdatedAt`.

### ClinicalRecordEntry
- Fields: `Id`, `ClinicalRecordId`, `PatientId`, `AuthorUserId`, `AuthorType`, `EntryType`, `Title`, `Description`, `AppointmentId`, `AppointmentOccurredAt`, `IsVisibleToPatient`, `CreatedAt`, `UpdatedAt`, `DeletedAt`.
- `EntryType` enum: `Anamnesis`, `Document`.
- `AuthorType` enum: `Patient`, `Doctor`.

### ClinicalDocument
- Fields: `Id`, `ClinicalRecordEntryId`, `FileName`, `StoredFileName`, `ContentType`, `SizeInBytes`, `S3Key`, `UploadedByUserId`, `CreatedAt`, `DeletedAt`.
- Binary content lives in S3; DB stores metadata only.

### ClinicalRecordAccessGrant
- Fields: `Id`, `PatientId`, `DoctorId`, `GrantedByPatientId`, `Status`, `Reason`, `StartAt`, `EndAt`, `CreatedAt`, `RevokedAt`.
- `Status` enum: `Active`, `Revoked`, `Expired`.

## Authorization rules currently implemented
- Patient can read and write only their own clinical record.
- Patient can create and revoke access grants.
- Doctor can read only if:
  - the patient has an active grant for that doctor, and
  - the appointments relationship service confirms a scheduled or completed appointment.
- Doctor can write entries/documents only if:
  - the patient has an active grant for that doctor, and
  - the appointments relationship service confirms a completed appointment.
- When an `AppointmentId` is provided for doctor writes, the relationship service must validate that the appointment belongs to that patient/doctor pair.
- Only the original author can update/delete an entry.
- Only the original uploader can delete a document.

## External integrations
### S3
- `IS3StorageService` is implemented by `S3StorageService`.
- Bucket name comes from `Aws:S3BucketName`.
- Region comes from `Aws:Region`.
- Object key pattern:
  - `clinical-records/{patientId}/{entryId}/{guid}-{originalFileName}`

### AppointmentsAPI
- `IAppointmentRelationshipService` is implemented by `AppointmentRelationshipService`.
- `Appointments:BaseUrl` is optional, but if missing the relationship checks fail closed for doctor access.
- The current implementation expects internal endpoints to exist in `AppointmentsAPI`:
  - `GET /internal/appointments/relationship-check?patientId={patientId}&doctorId={doctorId}&mode={mode}`
  - `GET /internal/appointments/{appointmentId}/ownership?patientId={patientId}&doctorId={doctorId}`
- Because those internal endpoints do not exist yet in `AppointmentsAPI`, doctor access in non-test environments requires that integration to be implemented next.

## Database changes
- Migration added: `20260310212458_ClinicalRecordsV2`.
- This migration replaces the old `ClinicalRecords` table with the v2 clinical record structure.
- Review the migration carefully before applying it to environments with existing data because the scaffolded migration drops the legacy table.

## Testing status
- Integration tests cover every current auth endpoint.
- Integration tests cover every clinical record v2 endpoint.
- Every new feature/endpoint must include automated tests validating happy path, input validation, and authorization/security behavior.
- Whenever code changes are made, run the automated tests and confirm nothing regressed before committing.
- Test project: `Backend/UsersAPI.Tests`.
- Main command:
```powershell
dotnet test Backend/UsersAPI.Tests/UsersAPI.Tests.csproj
```

## Code style rules
- Do not use `var` in `UsersAPI` and `UsersAPI.Tests`; always use explicit class/interface types when available.

## Security and robustness notes
- Keep `appsettings.json` with safe defaults/placeholders only.
- For local development, prefer `appsettings.Development.json` or environment variables for secrets/connection strings.
- `appsettings.json` currently contains sensitive values and should be cleaned up before shared use.
- Clinical documents are soft-deleted in the DB and deleted from S3.
- Authorization is resource-aware, but pagination/filtering is still missing for entries and grants.
- No antivirus/content inspection is applied to uploaded files yet.

## Known follow-ups
1. Add internal appointment validation endpoints in `AppointmentsAPI`.
2. Expand patient profile fields for UC1.
3. Harden field-level validation for doctor registration.
4. Add pagination, filtering, and error contract standardization.
5. Add audit trail/read access logging if compliance requires it.

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
- `Backend/UsersAPI/Controllers/PatientClinicalRecordsController.cs`
- `Backend/UsersAPI/Services/ClinicalRecordAuthorizationService.cs`
- `Backend/UsersAPI/Services/AppointmentRelationshipService.cs`
- `Backend/UsersAPI/Services/S3StorageService.cs`
- `Backend/UsersAPI/Data/UsersDbContext.cs`
- `Backend/UsersAPI/Models/*`
- `Backend/UsersAPI.Tests/*`
