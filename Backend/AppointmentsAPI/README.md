# AppointmentsAPI - Technical Solution

## Overview

`AppointmentsAPI` now implements a production-oriented scheduling workflow for Clinix with a clean-architecture-inspired structure inside a single ASP.NET Core service:

- `Domain`: appointment lifecycle, availability, agenda events, conflict rules.
- `Application`: DTOs, current actor abstraction, orchestration services.
- `Infrastructure`: HTTP integrations, internal service auth, clock, exception handling.
- `API`: controller-based REST endpoints and internal integration endpoints.

The service keeps scheduling as the source of truth for:

- invitation workflow
- appointment lifecycle
- doctor agenda management
- availability and public slot projection
- doctor/patient relationship checks for clinical access rules

It does **not** store clinical records and does **not** validate identity outside `UsersAPI`.

## State Model

`AppointmentStatus`

- `PendingAcceptance`
- `Accepted`
- `Rejected`
- `CancelledByPatient`
- `CancelledByDoctor`
- `Completed`

Why this model:

- It separates invitation response from cancellation ownership.
- It keeps audit semantics explicit for compliance and support.
- It avoids hard deletes and keeps lifecycle history in `appointment_status_history`.
- Invitation expiry is modeled as metadata (`InvitationExpiresAt`) instead of a state, because expiry is a time-box on a pending invitation, not a consultation outcome.

Allowed transitions:

- `PendingAcceptance -> Accepted`
- `PendingAcceptance -> Rejected`
- `PendingAcceptance -> CancelledByPatient` (only when the patient created the invitation)
- `PendingAcceptance -> CancelledByDoctor`
- `Accepted -> CancelledByPatient`
- `Accepted -> CancelledByDoctor`
- `Accepted -> Completed`

Blocked transitions:

- patient cannot cancel after appointment start time
- completed appointments cannot be cancelled
- accept/reject after expiry or after start time is rejected
- invitation creator cannot accept or reject their own invitation
- only doctor can complete

## Domain Model

### Appointment

- core consultation aggregate
- owns invitation metadata and status history
- enforces lifecycle rules in domain methods

Main fields:

- `Id`
- `DoctorId`
- `PatientId`
- `Title`
- `Description`
- `Location`
- `StartTime`
- `EndTime`
- `InvitationExpiresAt`
- `Status`
- `AcceptedAt`
- `RejectedAt`
- `CancelledAt`
- `CompletedAt`
- `CreatedAt`
- `UpdatedAt`

### AppointmentInvitationMetadata

- invitation initiator identity and role
- invitation message
- responder note
- auditable invitation timestamps

### AppointmentStatusHistory

- full transition log
- who changed the state
- when
- why

### DoctorAvailability

- doctor-declared time windows
- visibility per slot: `Public` or `Private`
- overlapping availability windows are rejected

### AgendaEvent

- calendar projection for appointments and manual blocks
- types:
  - `Appointment`
  - `ExternalEvent`
  - `BlockedSlot`
  - `PersonalEvent`

Rules:

- platform appointments generate agenda events automatically
- manual events block scheduling
- manual event endpoint cannot edit appointment-backed events

## Conflict Detection

Conflict checks are enforced in the application/domain boundary before persistence:

- appointment vs active appointment
- appointment vs pending non-expired invitation
- appointment vs blocking manual agenda event
- manual agenda event vs active appointment
- manual agenda event vs blocking manual agenda event
- availability vs availability

`GET /doctors/{doctorId}/available-slots` also subtracts:

- accepted appointments
- pending non-expired invitations
- manual blocking events

This handles the edge case where a doctor creates a manual external block over an already published public availability window.

## REST API

### Appointments

- `GET /appointments/health`
- `GET /appointments/{appointmentId}`
- `POST /appointments/invite`
- `POST /appointments/{appointmentId}/accept`
- `POST /appointments/{appointmentId}/reject`
- `POST /appointments/{appointmentId}/cancel`
- `POST /appointments/{appointmentId}/complete`
- `GET /appointments/patient`
- `GET /appointments/doctor`

### Availability

- `POST /doctors/{doctorId}/availability`
- `PUT /availability/{availabilityId}`
- `DELETE /availability/{availabilityId}`
- `GET /doctors/{doctorId}/availability`
- `GET /doctors/{doctorId}/available-slots`

### Calendar

- `POST /doctors/{doctorId}/calendar-events`
- `PUT /calendar-events/{eventId}`
- `DELETE /calendar-events/{eventId}`
- `GET /doctors/{doctorId}/calendar`

### Internal endpoints

- `GET /internal/appointments/relationship-check`
- `GET /internal/appointments/{appointmentId}/ownership`

These internal endpoints are protected with `X-Internal-Api-Key`.

## Authorization Rules

Doctor:

- create invitations
- manage own availability
- manage own calendar events
- cancel own appointments
- complete own appointments
- list own appointments
- view own agenda

Patient:

- create invitations for doctors inside public availability
- accept invitations sent to them
- reject invitations sent to them
- cancel own pending invitation when they created it
- cancel own accepted appointment before start
- list own appointments
- view public slots

Internal services:

- relationship check
- appointment ownership validation

## Database Schema

Tables in schema `appointments`:

- `appointments`
- `appointment_invitation_metadata`
- `appointment_status_history`
- `doctor_availability`
- `agenda_events`

Key indexes:

- `appointments (DoctorId, StartTime)`
- `appointments (DoctorId, Status, StartTime)`
- `appointments (PatientId, StartTime)`
- `doctor_availability (DoctorId, StartTime, EndTime)`
- `agenda_events (DoctorId, StartTime, EndTime)`
- `agenda_events (AppointmentId)` unique
- `appointment_status_history (AppointmentId, ChangedAt)`

## UsersAPI Impact

Implemented in the current repo:

- internal user directory endpoint: `GET /internal/users/{userId}`
- internal API key support for appointments relationship checks
- `User.IsActive`

Required or recommended next steps in `UsersAPI`:

- expose explicit doctor profile validation status instead of relying only on `UserType`
- add administrative endpoints to activate/deactivate doctors and patients
- reject inactive users in more places than login if operational policy requires it
- expose richer doctor metadata if search/discovery needs specialty and CRM filters

## Clinical Record Integration

Conceptually, this belongs to `ClinicalRecordAPI`.

Current repo note:

- the monorepo still stores clinical records inside `UsersAPI`
- `AppointmentsAPI` therefore integrates through internal endpoints hosted in `UsersAPI` for now

Flows implemented:

- `AppointmentAccepted -> POST /internal/patients/{patientId}/clinical-record/access-grants/from-appointment`
- `AppointmentCompleted -> POST /internal/patients/{patientId}/clinical-record/entries/from-appointment`

The internal entry creation is idempotent by appointment/doctor pair and creates a draft anamnesis-style entry linked to the appointment.

## Domain Events

Emitted through `IIntegrationEventPublisher`:

- `AppointmentInvited`
- `AppointmentAccepted`
- `AppointmentRejected`
- `AppointmentCancelled`
- `AppointmentCompleted`
- `DoctorAvailabilityUpdated`
- `CalendarEventCreated`
- `ClinicalRecordAccessGranted`
- `ClinicalRecordEntryCreated`

Today the default publisher logs the event. In production, this should evolve to an outbox-backed bus publisher.

## Edge Cases Covered

- double booking attempts rejected before persistence
- expired invitations cannot be accepted or rejected
- wrong patient cannot accept another patient's invitation
- invitation creator cannot accept or reject their own invitation
- patient invites require public doctor availability
- inactive doctors cannot manage or receive appointments
- completed appointments cannot be cancelled
- patient cancellation after start time is rejected
- public slots hide private schedule details
- ownership endpoint only returns `true` for completed appointments

## Testing

Integration coverage added in `Backend/AppointmentsAPI.Tests`:

- doctor invitation flow
- patient invitation flow
- patient acceptance
- doctor acceptance of patient invitation
- acceptance after expiry
- wrong-patient acceptance
- self-acceptance blocked
- cancellation after completion
- available slot projection with blocking events
- internal relationship check
- internal ownership check for completed appointments

Run:

```powershell
dotnet build Backend/AppointmentsAPI/AppointmentsAPI.csproj
dotnet build Backend/AppointmentsAPI.Tests/AppointmentsAPI.Tests.csproj --no-restore
dotnet test Backend/AppointmentsAPI.Tests/AppointmentsAPI.Tests.csproj --no-build
```

## Assumptions

- datetimes are treated as UTC
- public/private visibility is modeled per availability slot, which is a safe superset of a doctor-level toggle
- patients can view public slots and create pending invitations only inside public doctor availability windows
- outbox/event bus hardening is recommended for production-grade guaranteed delivery
